/**
 * Full integrity audit after the journeys restructure.
 * Runs 14 checks against prod. Anything with a ✗ needs attention.
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const envRaw = fs.readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8");
const env: Record<string, string> = {};
for (const line of envRaw.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

let failures = 0;
function result(name: string, ok: boolean, detail: string) {
  const icon = ok ? "✓" : "✗";
  if (!ok) failures += 1;
  console.log(`${icon} ${name.padEnd(58)} ${detail}`);
}

async function fetchAll<T>(table: string, select: string): Promise<T[]> {
  const pageSize = 1000;
  let offset = 0;
  const all: T[] = [];
  while (true) {
    const { data, error } = await supabase.from(table).select(select).range(offset, offset + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

async function main() {
  console.log("─── Schema integrity ───");

  // 1. contact_pipeline_state table should be gone.
  {
    const { error } = await supabase.from("contact_pipeline_state").select("id").limit(1);
    result("cps table dropped", !!error, error ? "gone" : "STILL PRESENT");
  }

  // 2. contacts.territory + territory_slug columns should be gone.
  {
    const { error: e1 } = await supabase.from("contacts").select("territory").limit(1);
    const { error: e2 } = await supabase.from("contacts").select("territory_slug").limit(1);
    result("contacts.territory dropped", !!e1, e1 ? "gone" : "STILL PRESENT");
    result("contacts.territory_slug dropped", !!e2, e2 ? "gone" : "STILL PRESENT");
  }

  console.log("\n─── Journey shape ───");

  // 3. Every contact with an active journey_pipeline_state row has exactly
  //    one 'primary' member in journey_contacts.
  const journeys = await fetchAll<{ id: string; primary_contact_id: string; status: string }>(
    "journeys", "id, primary_contact_id, status"
  );
  const activeJourneys = journeys.filter((j) => j.status === "active");
  const members = await fetchAll<{ journey_id: string; contact_id: string; role: string; left_at: string | null }>(
    "journey_contacts", "journey_id, contact_id, role, left_at"
  );
  const activeMembers = members.filter((m) => m.left_at === null);
  {
    const primaryByJourney = new Map<string, number>();
    for (const m of activeMembers) {
      if (m.role === "primary") primaryByJourney.set(m.journey_id, (primaryByJourney.get(m.journey_id) ?? 0) + 1);
    }
    const missing = activeJourneys.filter((j) => (primaryByJourney.get(j.id) ?? 0) === 0).length;
    const extra = [...primaryByJourney.values()].filter((n) => n > 1).length;
    result(
      "each active journey has exactly one primary",
      missing === 0 && extra === 0,
      `missing=${missing}  duplicate=${extra}`
    );
  }

  // 4. Every journey has at least one active member.
  {
    const withMembers = new Set(activeMembers.map((m) => m.journey_id));
    const empty = activeJourneys.filter((j) => !withMembers.has(j.id)).length;
    result("each active journey has ≥1 active member", empty === 0, `empty journeys=${empty}`);
  }

  // 5. journeys.primary_contact_id should match an active primary member.
  {
    const primarySet = new Set(activeMembers.filter((m) => m.role === "primary").map((m) => `${m.journey_id}:${m.contact_id}`));
    const mismatch = activeJourneys.filter((j) => !primarySet.has(`${j.id}:${j.primary_contact_id}`)).length;
    result("journeys.primary_contact_id matches member", mismatch === 0, `drift=${mismatch}`);
  }

  console.log("\n─── Pipeline state (jps) ───");

  const jps = await fetchAll<{
    id: string; journey_id: string; pipeline_id: string; territory_ms_slug: string | null; is_active: boolean;
  }>("journey_pipeline_state", "id, journey_id, pipeline_id, territory_ms_slug, is_active");
  const activeJps = jps.filter((r) => r.is_active);

  // 6. Every active jps references a live journey.
  {
    const journeyIds = new Set(journeys.map((j) => j.id));
    const orphan = activeJps.filter((r) => !journeyIds.has(r.journey_id)).length;
    result("jps rows attach to a real journey", orphan === 0, `orphaned=${orphan}`);
  }

  // 7. At most one active sales/followup jps per (journey, pipeline) with NULL territory.
  {
    const bucket = new Map<string, number>();
    for (const r of activeJps.filter((r) => r.territory_ms_slug === null)) {
      const k = `${r.journey_id}:${r.pipeline_id}`;
      bucket.set(k, (bucket.get(k) ?? 0) + 1);
    }
    const dupes = [...bucket.values()].filter((n) => n > 1).length;
    result("no dup NULL-territory jps per (journey,pipeline)", dupes === 0, `duplicates=${dupes}`);
  }

  // 8. Per-territory runway/onboarding jps vs territory_owners.
  const { data: pipelinesMeta } = await supabase.from("pipelines").select("id, slug");
  const runwayOnboardIds = new Set(
    (pipelinesMeta ?? []).filter((p) => p.slug === "runway" || p.slug === "onboarding").map((p) => p.id)
  );
  const fanoutJps = activeJps.filter((r) => runwayOnboardIds.has(r.pipeline_id) && r.territory_ms_slug);
  {
    // Multi-territory franchisees: compare their active territory_owners count
    // to their active runway jps count per journey.
    const owners = await fetchAll<{ ghl_contact_id: string; ms_slug: string; end_date: string | null }>(
      "territory_owners", "ghl_contact_id, ms_slug, end_date"
    );
    const activeOwners = owners.filter((o) => o.end_date === null);
    const contacts = await fetchAll<{ id: string; ghl_contact_id: string }>("contacts", "id, ghl_contact_id");
    const ghlToLocal = new Map(contacts.map((c) => [c.ghl_contact_id, c.id]));
    const ownerSlugsByJourney = new Map<string, Set<string>>();
    for (const o of activeOwners) {
      const localId = ghlToLocal.get(o.ghl_contact_id);
      if (!localId) continue;
      const journeysForContact = activeJourneys.filter((j) => j.primary_contact_id === localId);
      for (const j of journeysForContact) {
        const set = ownerSlugsByJourney.get(j.id) ?? new Set();
        set.add(o.ms_slug);
        ownerSlugsByJourney.set(j.id, set);
      }
    }
    const jpsSlugsByJourney = new Map<string, Set<string>>();
    for (const r of fanoutJps) {
      const set = jpsSlugsByJourney.get(r.journey_id) ?? new Set();
      set.add(r.territory_ms_slug as string);
      jpsSlugsByJourney.set(r.journey_id, set);
    }
    let drift = 0;
    for (const [journeyId, ownerSlugs] of ownerSlugsByJourney) {
      const jpsSlugs = jpsSlugsByJourney.get(journeyId) ?? new Set();
      const missing = [...ownerSlugs].filter((s) => !jpsSlugs.has(s)).length;
      if (missing > 0) drift += 1;
    }
    result("franchisees have jps row per owned territory", drift === 0, `journeys missing territory jps=${drift}`);
  }

  console.log("\n─── Data lake (extractions + actions + logs) ───");

  // 9. chk_extraction_has_scope should hold — every row has at least one pointer.
  {
    const { count } = await supabase
      .from("call_data_extractions")
      .select("id", { count: "exact", head: true })
      .is("contact_id", null).is("journey_id", null).is("territory_ms_slug", null);
    result("extraction_has_scope: no orphans", (count ?? 0) === 0, `orphans=${count ?? 0}`);
  }

  // 10. Extraction journey_id coverage (should be populated on recent rows).
  {
    const { count: withJourney } = await supabase
      .from("call_data_extractions").select("id", { count: "exact", head: true })
      .not("journey_id", "is", null);
    const { count: total } = await supabase
      .from("call_data_extractions").select("id", { count: "exact", head: true });
    result("extractions carrying journey_id", (withJourney ?? 0) > 0, `${withJourney}/${total} rows`);
  }

  // 11. sub_task_logs must have jps_id (NOT NULL constraint enforces this).
  {
    const { count } = await supabase
      .from("contact_sub_task_logs").select("id", { count: "exact", head: true })
      .is("journey_pipeline_state_id", null);
    result("every sub_task_log has jps_id", (count ?? 0) === 0, `nulls=${count ?? 0}`);
  }

  // 12. stage_history must have jps_id.
  {
    const { count } = await supabase
      .from("pipeline_stage_history").select("id", { count: "exact", head: true })
      .is("journey_pipeline_state_id", null);
    result("every stage_history has jps_id", (count ?? 0) === 0, `nulls=${count ?? 0}`);
  }

  console.log("\n─── EOS carry-forward ───");

  // 13. Territory-owning franchisees should have EOS seeded on their territory.
  //     (Best-effort: warn if a primary contact has EOS contact goals but no
  //      corresponding territory goals.)
  const { data: contactGoals } = await supabase
    .from("eos_contact_goals").select("contact_id");
  const contactsWithGoals = new Set((contactGoals ?? []).map((r) => r.contact_id));
  // Franchisees currently working territories
  const { data: territoryOwners } = await supabase
    .from("territory_owners").select("ghl_contact_id, ms_slug").is("end_date", null);
  const contactsLookup = await fetchAll<{ id: string; ghl_contact_id: string }>("contacts", "id, ghl_contact_id");
  const ghl2Local = new Map(contactsLookup.map((c) => [c.ghl_contact_id, c.id]));
  const { data: tGoals } = await supabase.from("eos_territory_goals").select("territory_slug");
  const territoriesWithGoals = new Set((tGoals ?? []).map((g) => g.territory_slug));
  let carryGaps = 0;
  for (const o of territoryOwners ?? []) {
    const local = ghl2Local.get(o.ghl_contact_id);
    if (!local) continue;
    if (contactsWithGoals.has(local) && !territoriesWithGoals.has(o.ms_slug)) carryGaps += 1;
  }
  result("EOS carry-forward gaps", carryGaps === 0, `territory-owner pairs missing carry=${carryGaps}`);

  console.log("\n─── Summary ───");
  console.log(`Failures: ${failures}`);
  process.exit(failures === 0 ? 0 : 1);
}

void main().catch((err) => { console.error(err); process.exit(2); });
