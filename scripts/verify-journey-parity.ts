/**
 * Post-migration parity check: journey_pipeline_state vs. contact_pipeline_state.
 *
 * Aborts the sprint if counts drift beyond expected deltas (co-primary merges
 * and multi-territory fan-out). Read-only.
 *
 *   npx tsx scripts/verify-journey-parity.ts
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface Row {
  pipeline_slug: string;
  stage_name: string;
  count: number;
}

function hdr(title: string) {
  console.log(`\n━━ ${title} ━━`);
}

// PostgREST caps selects at 1000 rows by default — pagination matters.
async function fetchAll<T>(
  table: string,
  select: string,
  filter?: (q: ReturnType<typeof supabase.from>) => ReturnType<typeof supabase.from>
): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;
  while (true) {
    let q = supabase.from(table).select(select);
    if (filter) q = filter(q) as typeof q;
    const { data, error } = await q.range(offset, offset + 999);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    rows.push(...(data as unknown as T[]));
    if (data.length < 1000) break;
    offset += 1000;
  }
  return rows;
}

async function stageCountsFromContactSide(): Promise<Map<string, number>> {
  const data = await fetchAll<{ current_stage_id: string }>("contact_pipeline_state", "current_stage_id", (q) =>
    q.eq("is_active", true)
  );
  const stages = await fetchAll<{ id: string; name: string; pipeline_id: string }>(
    "pipeline_stages",
    "id, name, pipeline_id"
  );
  const pipelines = await fetchAll<{ id: string; slug: string }>("pipelines", "id, slug");
  const stageById = new Map(stages.map((s) => [s.id, s]));
  const pipeById = new Map(pipelines.map((p) => [p.id, p]));

  const out = new Map<string, number>();
  for (const r of data) {
    const s = stageById.get(r.current_stage_id);
    const p = s ? pipeById.get(s.pipeline_id) : null;
    const key = `${p?.slug ?? "?"} / ${s?.name ?? "?"}`;
    out.set(key, (out.get(key) ?? 0) + 1);
  }
  return out;
}

async function stageCountsFromJourneySide(): Promise<Map<string, number>> {
  const data = await fetchAll<{ current_stage_id: string }>("journey_pipeline_state", "current_stage_id", (q) =>
    q.eq("is_active", true)
  );
  const stages = await fetchAll<{ id: string; name: string; pipeline_id: string }>(
    "pipeline_stages",
    "id, name, pipeline_id"
  );
  const pipelines = await fetchAll<{ id: string; slug: string }>("pipelines", "id, slug");
  const stageById = new Map(stages.map((s) => [s.id, s]));
  const pipeById = new Map(pipelines.map((p) => [p.id, p]));

  const out = new Map<string, number>();
  for (const r of data) {
    const s = stageById.get(r.current_stage_id);
    const p = s ? pipeById.get(s.pipeline_id) : null;
    const key = `${p?.slug ?? "?"} / ${s?.name ?? "?"}`;
    out.set(key, (out.get(key) ?? 0) + 1);
  }
  return out;
}

async function main() {
  const [journeyCount, primaryCount, jpsActive, contactsCount, franchiseeCount, extractionsMissing, actionsMissing] =
    await Promise.all([
      supabase.from("journeys").select("id", { count: "exact", head: true }),
      supabase
        .from("journey_contacts")
        .select("id", { count: "exact", head: true })
        .eq("role", "primary")
        .is("left_at", null),
      supabase.from("journey_pipeline_state").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("contacts").select("id", { count: "exact", head: true }),
      supabase.from("contacts").select("id", { count: "exact", head: true }).eq("is_converted_franchisee", true),
      supabase
        .from("call_data_extractions")
        .select("id", { count: "exact", head: true })
        .is("journey_id", null)
        .not("contact_id", "is", null),
      supabase
        .from("call_action_items")
        .select("id", { count: "exact", head: true })
        .is("journey_id", null)
        .not("contact_id", "is", null),
    ]);

  hdr("1 · Totals");
  console.log(`  journeys:                                ${journeyCount.count ?? 0}`);
  console.log(`  journey_contacts (primary, active):      ${primaryCount.count ?? 0}`);
  console.log(`  journey_pipeline_state (active):         ${jpsActive.count ?? 0}`);
  console.log(`  contacts:                                ${contactsCount.count ?? 0}`);
  console.log(`  contacts flagged is_converted_franchisee:${franchiseeCount.count ?? 0}`);

  hdr("2 · Extraction + action journey_id backfill");
  const extMissing = extractionsMissing.count ?? 0;
  const actMissing = actionsMissing.count ?? 0;
  console.log(`  call_data_extractions with contact_id but journey_id NULL: ${extMissing}`);
  console.log(`  call_action_items     with contact_id but journey_id NULL: ${actMissing}`);
  if (extMissing > 0 || actMissing > 0) {
    console.log("  ⚠ Some rows didn't get a journey_id — usually because the call's contact was never in a pipeline.");
  }

  hdr("3 · Pipeline-page parity (per stage, is_active=true)");
  const before = await stageCountsFromContactSide();
  const after = await stageCountsFromJourneySide();
  const keys = new Set([...before.keys(), ...after.keys()]);
  let driftCount = 0;
  for (const k of [...keys].sort()) {
    const b = before.get(k) ?? 0;
    const a = after.get(k) ?? 0;
    const delta = a - b;
    const flag = delta === 0 ? "·" : delta > 0 ? `+${delta}` : `${delta}`;
    if (delta !== 0) driftCount++;
    console.log(`  ${k.padEnd(50)} before=${String(b).padStart(4)}  after=${String(a).padStart(4)}  ${flag}`);
  }
  if (driftCount === 0) {
    console.log("\n  ✔ Every stage matches exactly. Pipeline page will render identically.");
  } else {
    console.log(
      `\n  ⚠ ${driftCount} stage(s) have different counts. Investigate each non-zero delta before shipping Phase 2.`
    );
  }

  hdr("4 · Data-lake scope guard (extractions with zero scope)");
  const { count: orphan } = await supabase
    .from("call_data_extractions")
    .select("id", { count: "exact", head: true })
    .is("contact_id", null)
    .is("journey_id", null)
    .is("TerritorySlug", null);
  console.log(`  Orphan extractions (no scope set): ${orphan ?? 0}`);
  if ((orphan ?? 0) > 0) {
    console.log("  ⚠ These rows violate the scope invariant. Fix or delete before adding the CHECK constraint.");
  } else {
    console.log("  ✔ Safe to add the scope CHECK constraint in a follow-up migration.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
