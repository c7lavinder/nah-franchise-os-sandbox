/**
 * One-off: for every call that has multiple call_journeys rows pointing at
 * the same journey_id (one per pipeline — e.g. Sales + Follow-up), keep only
 * the primary row and drop the rest. The Reassign modal now collapses to
 * one chip per journey, so the extra rows are noise on the call detail page.
 *
 * Dry run by default; --live to apply.
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
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_KEY!);

const LIVE = process.argv.includes("--live");

async function main() {
  console.log(`Mode: ${LIVE ? "LIVE" : "DRY RUN"}\n`);

  const { data: rows } = await supabase
    .from("call_journeys")
    .select("id, call_id, journey_id, journey_pipeline_state_id, is_primary");

  // Group per (call_id, journey_id) — duplicates are pairs where there are
  // multiple rows for the same call + journey.
  const groups = new Map<string, typeof rows>();
  for (const r of rows ?? []) {
    const key = `${r.call_id}|${r.journey_id}`;
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }

  const deletions: { id: string; call_id: string; journey_id: string }[] = [];
  for (const [, list] of groups) {
    if (!list || list.length < 2) continue;
    // Keep the primary, or the first if no primary flagged.
    const sorted = [...list].sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));
    const keep = sorted[0];
    for (const r of sorted.slice(1)) {
      deletions.push({ id: r.id, call_id: r.call_id, journey_id: r.journey_id });
    }
    console.log(`call=${keep.call_id.slice(0, 8)} journey=${keep.journey_id.slice(0, 8)}: keep ${keep.id.slice(0, 8)}, drop ${sorted.length - 1}`);
  }

  if (deletions.length === 0) {
    console.log("\nNo duplicates.");
    return;
  }

  console.log(`\n${LIVE ? "Deleting" : "Would delete"} ${deletions.length} row(s).`);
  if (!LIVE) return;

  for (const d of deletions) {
    const { error } = await supabase.from("call_journeys").delete().eq("id", d.id);
    if (error) console.log(`  ${d.id.slice(0, 8)} ERR: ${error.message}`);
  }
  console.log("Done.");
}

void main();
