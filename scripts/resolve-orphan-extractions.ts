/**
 * Final data-lake integrity pass for the journeys restructure.
 *
 * The plan requires: every call_data_extractions row must carry at least
 * one scope pointer (contact_id, journey_id, or territory_ms_slug).
 *
 * Two classes of orphan were found in prod:
 *   - "Rescuable" (107 rows, 2 calls): the call itself has a contact_id.
 *     These are backfilled with contact_id + matching journey_id.
 *   - "Unrescuable" (951 rows, 21 calls): team/group calls pre-dating the
 *     current extraction prompt. These are low-signal mashups of multiple
 *     prospects and don't attach cleanly to any scope. Hard-deleted.
 *
 * Run with --live to apply. Dry-run by default.
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

async function main(dryRun: boolean) {
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);

  // 1. Fetch all orphan extractions paginated.
  const pageSize = 1000;
  let offset = 0;
  const orphans: { id: string; call_id: string }[] = [];
  while (true) {
    const { data, error } = await supabase
      .from("call_data_extractions")
      .select("id, call_id")
      .is("contact_id", null)
      .is("journey_id", null)
      .is("territory_ms_slug", null)
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    orphans.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  console.log(`Total orphans: ${orphans.length}`);

  // 2. Group by call.
  const byCall = new Map<string, string[]>();
  for (const r of orphans) {
    const set = byCall.get(r.call_id) ?? [];
    set.push(r.id);
    byCall.set(r.call_id, set);
  }
  const callIds = [...byCall.keys()];

  // 3. Pull call scope (contact_id, territory).
  const { data: calls } = await supabase
    .from("calls").select("id, contact_id, territory_ms_slug").in("id", callIds);
  const callMap = new Map((calls ?? []).map((c) => [c.id, c]));

  // 4. For rescuable calls (have contact_id or territory_ms_slug), resolve journey.
  const rescuableContactIds = [...new Set((calls ?? []).map((c) => c.contact_id).filter(Boolean) as string[])];
  const { data: journeys } = await supabase
    .from("journeys").select("id, primary_contact_id").in("primary_contact_id", rescuableContactIds.length > 0 ? rescuableContactIds : ["__none__"]);
  const contactToJourney = new Map((journeys ?? []).map((j) => [j.primary_contact_id, j.id]));

  // 5. Classify + execute.
  let rescued = 0, deleted = 0;
  for (const [callId, extractionIds] of byCall) {
    const call = callMap.get(callId);
    if (!call) {
      // Call row missing — just delete the orphan extractions.
      if (dryRun) console.log(`  WOULD DELETE ${extractionIds.length} (no call row for ${callId.slice(0,8)})`);
      else {
        const { error } = await supabase.from("call_data_extractions").delete().in("id", extractionIds);
        if (error) console.error(`delete failed: ${error.message}`);
        else deleted += extractionIds.length;
      }
      continue;
    }

    const rescuable = call.contact_id || call.territory_ms_slug;
    if (rescuable) {
      const patch: { contact_id?: string; journey_id?: string; territory_ms_slug?: string } = {};
      if (call.contact_id) patch.contact_id = call.contact_id;
      if (call.contact_id && contactToJourney.has(call.contact_id)) patch.journey_id = contactToJourney.get(call.contact_id);
      if (call.territory_ms_slug) patch.territory_ms_slug = call.territory_ms_slug;
      if (dryRun) console.log(`  WOULD RESCUE ${extractionIds.length} (call ${callId.slice(0,8)}) patch=${JSON.stringify(patch)}`);
      else {
        const { error } = await supabase.from("call_data_extractions").update(patch).in("id", extractionIds);
        if (error) console.error(`rescue failed for call ${callId.slice(0,8)}: ${error.message}`);
        else rescued += extractionIds.length;
      }
    } else {
      if (dryRun) console.log(`  WOULD DELETE ${extractionIds.length} (unrescuable call ${callId.slice(0,8)})`);
      else {
        const { error } = await supabase.from("call_data_extractions").delete().in("id", extractionIds);
        if (error) console.error(`delete failed for call ${callId.slice(0,8)}: ${error.message}`);
        else deleted += extractionIds.length;
      }
    }
  }
  console.log(`\n${dryRun ? "Would rescue" : "Rescued"}: ${rescued}`);
  console.log(`${dryRun ? "Would delete" : "Deleted"}: ${deleted}`);
}

void main(process.argv.includes("--live") ? false : true);
