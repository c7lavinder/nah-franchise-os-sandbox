/**
 * Reconcile missing per-territory jps rows.
 *
 * The initial journeys backfill materialized one jps row per (journey,
 * runway/onboarding) for every pipeline-enrolled contact. When a contact
 * owns multiple active territories, only one territory_ms_slug made it
 * into jps — so Phil Dunbar (3 territories) has 1 runway jps row instead
 * of 3. This script adds the missing rows.
 *
 * Logic: for every active territory_owners row whose ghl_contact is the
 * primary of a journey, ensure a matching active jps row exists for
 * runway AND onboarding. Missing rows are inserted with the same stage
 * and sub-task state as the "canonical" existing jps row for that
 * (journey, pipeline). No existing data is mutated.
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

const RUNWAY_PIPELINE_ID = "a0000000-0000-0000-0000-000000000004";
const ONBOARDING_PIPELINE_ID = "a0000000-0000-0000-0000-000000000003";

async function fetchAll<T>(
  table: string,
  select: string,
  filter?: (q: ReturnType<typeof supabase.from>) => ReturnType<typeof supabase.from>,
): Promise<T[]> {
  const pageSize = 1000;
  let offset = 0;
  const out: T[] = [];
  while (true) {
    let q = supabase.from(table).select(select).range(offset, offset + pageSize - 1);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    out.push(...(data as T[]));
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return out;
}

async function main(dryRun: boolean) {
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);

  // 1) Every active territory ownership → GHL id → contact id.
  const owners = await fetchAll<{ ghl_contact_id: string | null; ms_slug: string }>(
    "territory_owners", "ghl_contact_id, ms_slug",
    // @ts-expect-error - is not typed on the builder chain here
    (q) => q.is("end_date", null),
  );
  const ghlContactIds = [...new Set(owners.map((o) => o.ghl_contact_id).filter(Boolean) as string[])];
  const contacts = await fetchAll<{ id: string; ghl_contact_id: string | null }>(
    "contacts", "id, ghl_contact_id",
    // @ts-expect-error builder
    (q) => q.in("ghl_contact_id", ghlContactIds),
  );
  const ghlToContactId = new Map(contacts.map((c) => [c.ghl_contact_id as string, c.id]));

  // 2) Journeys by primary_contact_id.
  const contactIds = [...new Set(contacts.map((c) => c.id))];
  const journeys = await fetchAll<{ id: string; primary_contact_id: string }>(
    "journeys", "id, primary_contact_id",
    // @ts-expect-error builder
    (q) => q.in("primary_contact_id", contactIds).eq("status", "active"),
  );
  const contactToJourneyId = new Map(journeys.map((j) => [j.primary_contact_id, j.id]));

  // 3) Current jps rows for runway + onboarding for these journeys.
  const journeyIds = [...new Set(journeys.map((j) => j.id))];
  const jps = await fetchAll<{
    journey_id: string; pipeline_id: string; territory_ms_slug: string | null;
    current_stage_id: string; current_sub_task_id: string | null;
    current_sub_task_started_at: string | null; entered_pipeline_at: string;
    entered_current_stage_at: string; assigned_user_id: string | null; is_active: boolean;
  }>("journey_pipeline_state",
    "journey_id, pipeline_id, territory_ms_slug, current_stage_id, current_sub_task_id, current_sub_task_started_at, entered_pipeline_at, entered_current_stage_at, assigned_user_id, is_active",
    // @ts-expect-error builder
    (q) => q.in("journey_id", journeyIds).eq("is_active", true).in("pipeline_id", [RUNWAY_PIPELINE_ID, ONBOARDING_PIPELINE_ID]),
  );

  // Build per-(journey, pipeline) index: existing territories + canonical row.
  type Key = string;
  const existing = new Map<Key, Set<string>>();
  const canonical = new Map<Key, typeof jps[number]>();
  for (const row of jps) {
    const key: Key = `${row.journey_id}::${row.pipeline_id}`;
    if (!canonical.has(key)) canonical.set(key, row);
    const set = existing.get(key) ?? new Set<string>();
    if (row.territory_ms_slug) set.add(row.territory_ms_slug);
    existing.set(key, set);
  }

  // 4) Group owners by journey. For each journey × (runway, onboarding), insert
  // any territories that exist in owners but missing from jps.
  const ownedByJourney = new Map<string, Set<string>>();
  for (const o of owners) {
    if (!o.ghl_contact_id) continue;
    const contactId = ghlToContactId.get(o.ghl_contact_id);
    if (!contactId) continue;
    const journeyId = contactToJourneyId.get(contactId);
    if (!journeyId) continue;
    const set = ownedByJourney.get(journeyId) ?? new Set<string>();
    set.add(o.ms_slug);
    ownedByJourney.set(journeyId, set);
  }

  let inserts = 0;
  for (const [journeyId, ownedSlugs] of ownedByJourney) {
    for (const pipelineId of [RUNWAY_PIPELINE_ID, ONBOARDING_PIPELINE_ID]) {
      const key = `${journeyId}::${pipelineId}`;
      const canon = canonical.get(key);
      if (!canon) continue; // no existing row for this pipeline → nothing to clone
      const have = existing.get(key) ?? new Set<string>();
      const missing = [...ownedSlugs].filter((s) => !have.has(s));
      for (const slug of missing) {
        const row = {
          journey_id: journeyId,
          territory_ms_slug: slug,
          pipeline_id: pipelineId,
          current_stage_id: canon.current_stage_id,
          current_sub_task_id: canon.current_sub_task_id,
          current_sub_task_started_at: canon.current_sub_task_started_at,
          entered_pipeline_at: canon.entered_pipeline_at,
          entered_current_stage_at: canon.entered_current_stage_at,
          assigned_user_id: canon.assigned_user_id,
          is_active: true,
        };
        if (dryRun) {
          console.log(`  WOULD INSERT: journey=${journeyId.slice(0,8)}.. pipeline=${pipelineId === RUNWAY_PIPELINE_ID ? "runway" : "onboarding"} territory=${slug}`);
        } else {
          const { error } = await supabase.from("journey_pipeline_state").insert(row);
          if (error) console.error(`  FAIL: ${slug}: ${error.message}`);
        }
        inserts++;
      }
    }
  }
  console.log(`\n${dryRun ? "Would insert" : "Inserted"} ${inserts} jps rows.`);
}

void main(process.argv.includes("--live") ? false : true);
