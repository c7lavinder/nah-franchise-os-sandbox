/**
 * Move territories (+ their journeys) to the Inactive stage on the territories
 * pipeline, and deactivate their onboarding/runway pipeline-state rows.
 *
 * Input: list of territory TerritorySlugs to mark inactive.
 * Per territory:
 *   1. territories.status → 'inactive'
 *   2. All active onboarding + runway journey_pipeline_state rows for the
 *      owning journey → is_active = false
 *   3. Insert a new territories-pipeline JPS row at the "Inactive" stage
 *      (if one doesn't already exist) so the journey shows as inactive
 *      on the board.
 *
 * Usage:
 *   pnpm tsx scripts/move-territories-inactive.ts          (dry-run)
 *   pnpm tsx scripts/move-territories-inactive.ts --apply  (write)
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const DRY = !process.argv.includes("--apply");

const envRaw = fs.readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8");
const env: Record<string, string> = {};
for (const line of envRaw.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

const TARGET_SLUGS = ["MONRLA", "OAKRTN", "JVLLES"];

const TERRITORIES_PIPELINE = "d0000000-0000-0000-0000-000000000004";
const INACTIVE_STAGE = "d1000000-0000-0000-0000-000000000002";
const ONBOARDING_PIPELINE = "a0000000-0000-0000-0000-000000000003";
const RUNWAY_PIPELINE = "a0000000-0000-0000-0000-000000000004";

async function main() {
  console.log(`[${DRY ? "DRY-RUN" : "LIVE"}] moving territories to inactive:`, TARGET_SLUGS);

  const { data: jpsRows, error: jpsErr } = await s
    .from("journey_pipeline_state")
    .select("id, journey_id, TerritorySlug, pipeline_id, current_stage_id, is_active")
    .in("TerritorySlug", TARGET_SLUGS)
    .eq("is_active", true);
  if (jpsErr) throw jpsErr;

  const journeysByTerritory = new Map<string, Set<string>>();
  for (const row of jpsRows ?? []) {
    if (!row.TerritorySlug) continue;
    if (!journeysByTerritory.has(row.TerritorySlug)) {
      journeysByTerritory.set(row.TerritorySlug, new Set());
    }
    journeysByTerritory.get(row.TerritorySlug)!.add(row.journey_id);
  }

  const deactivations: Array<{ id: string; territory: string; pipeline: string }> = [];
  const inserts: Array<{ journey_id: string; TerritorySlug: string }> = [];

  for (const slug of TARGET_SLUGS) {
    const journeyIds = Array.from(journeysByTerritory.get(slug) ?? []);
    console.log(`\n--- ${slug} → journeys: ${journeyIds.length} ---`);
    for (const journeyId of journeyIds) {
      const toDeactivate = (jpsRows ?? []).filter(
        (r) =>
          r.journey_id === journeyId &&
          r.TerritorySlug === slug &&
          (r.pipeline_id === ONBOARDING_PIPELINE || r.pipeline_id === RUNWAY_PIPELINE)
      );
      for (const row of toDeactivate) {
        const pipelineName = row.pipeline_id === ONBOARDING_PIPELINE ? "onboarding" : "runway";
        console.log(`   deactivate ${pipelineName} JPS ${row.id}`);
        deactivations.push({ id: row.id, territory: slug, pipeline: pipelineName });
      }

      const { data: existingInactive } = await s
        .from("journey_pipeline_state")
        .select("id, current_stage_id, is_active")
        .eq("journey_id", journeyId)
        .eq("TerritorySlug", slug)
        .eq("pipeline_id", TERRITORIES_PIPELINE)
        .eq("is_active", true)
        .maybeSingle();

      if (existingInactive) {
        if (existingInactive.current_stage_id === INACTIVE_STAGE) {
          console.log(`   already at Inactive (JPS ${existingInactive.id}) — skip`);
        } else {
          console.log(`   update existing territories JPS ${existingInactive.id} → Inactive`);
          deactivations.push({ id: existingInactive.id, territory: slug, pipeline: "territories (update)" });
          inserts.push({ journey_id: journeyId, TerritorySlug: slug });
        }
      } else {
        console.log(`   insert territories JPS (journey=${journeyId}, Inactive)`);
        inserts.push({ journey_id: journeyId, TerritorySlug: slug });
      }
    }
  }

  console.log(`\nSummary: ${deactivations.length} JPS deactivations, ${inserts.length} territories JPS inserts`);

  if (DRY) {
    console.log("\n[DRY-RUN] — no writes. Re-run with --apply.");
    return;
  }

  // 1. Deactivate runway/onboarding rows
  for (const d of deactivations) {
    const { error } = await s
      .from("journey_pipeline_state")
      .update({ is_active: false, closed_at: new Date().toISOString() })
      .eq("id", d.id);
    if (error) {
      console.error(`FAIL deactivate ${d.id}:`, error.message);
    } else {
      console.log(`ok deactivate ${d.pipeline} ${d.territory} (${d.id})`);
    }
  }

  // 2. Insert territories-pipeline JPS rows at Inactive
  for (const ins of inserts) {
    const { error } = await s.from("journey_pipeline_state").insert({
      journey_id: ins.journey_id,
      TerritorySlug: ins.TerritorySlug,
      pipeline_id: TERRITORIES_PIPELINE,
      current_stage_id: INACTIVE_STAGE,
      is_active: true,
    });
    if (error) {
      console.error(`FAIL insert territories JPS ${ins.TerritorySlug}:`, error.message);
    } else {
      console.log(`ok insert territories JPS ${ins.TerritorySlug} at Inactive`);
    }
  }

  // 3. Flip territories.status
  const { error: terrErr } = await s
    .from("territories")
    .update({ status: "inactive" })
    .in("TerritorySlug", TARGET_SLUGS);
  if (terrErr) {
    console.error("FAIL territories.status update:", terrErr.message);
  } else {
    console.log(`ok territories.status → inactive for ${TARGET_SLUGS.join(", ")}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
