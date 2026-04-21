/**
 * One-off: generate plain-English slugs for every row in the journeys
 * table and write them back. Names are already user-facing (e.g.
 * "Ryan Decker + Shannon Smylie"), so slugifying them gives
 * "ryan-decker-and-shannon-smylie". Dedup via trailing numeric suffix.
 *
 * Run with --live to apply. Dry-run by default.
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { slugifyBase } from "../lib/journeys/slug";

const envRaw = fs.readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8");
const env: Record<string, string> = {};
for (const line of envRaw.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

async function main(dryRun: boolean) {
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);

  const { data: journeys, error } = await supabase
    .from("journeys")
    .select("id, name, slug, created_at")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  if (!journeys) throw new Error("no journeys returned");

  const taken = new Set<string>();
  for (const j of journeys) if (j.slug) taken.add(j.slug);

  let wrote = 0;
  let skipped = 0;
  for (const j of journeys) {
    if (j.slug) { skipped += 1; continue; }
    const base = slugifyBase(j.name ?? "journey");
    let candidate = base;
    let n = 2;
    while (taken.has(candidate)) {
      candidate = `${base}-${n}`;
      n += 1;
    }
    taken.add(candidate);

    if (dryRun) {
      console.log(`  ${j.id.slice(0, 8)} "${j.name}" → ${candidate}`);
    } else {
      const { error: upErr } = await supabase.from("journeys").update({ slug: candidate }).eq("id", j.id);
      if (upErr) { console.error(`  FAIL ${j.id}: ${upErr.message}`); continue; }
    }
    wrote += 1;
  }

  console.log(`\n${dryRun ? "Would write" : "Wrote"}: ${wrote}`);
  console.log(`Skipped (already had slug): ${skipped}`);
}

void main(process.argv.includes("--live") ? false : true);
