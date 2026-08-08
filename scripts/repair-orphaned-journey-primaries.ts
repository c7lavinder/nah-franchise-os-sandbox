import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import WebSocket from "ws";
import { createClient } from "@supabase/supabase-js";

/**
 * Repairs journeys whose `primary_contact_id` points at a contact that has been
 * merged away — the gap that step 3b of `app/api/contacts/[contactId]/merge/route.ts`
 * now closes for FUTURE merges. This script is for the rows already in that state.
 *
 * Found on production Supabase 2026-08-08: 3 journeys, all 3 created by the 5 merges
 * this route had performed. Step 3 of the route closed journey MEMBERSHIPS, which is a
 * different table, and that is what made the hole look handled.
 *
 * ⚠⚠ IT ONLY REPAIRS THE UNAMBIGUOUS CASE, and refuses the rest on purpose.
 *
 * Repointing assumes the merge itself was correct. Two of the three do not look
 * correct — the duplicate and the keeper are different PEOPLE:
 *
 *     "Vince Vitale"      -> merged into "jo Vitale"      (archived journey)
 *     "Courtney McDonald" -> merged into "Michael Scott"  (both have active journeys)
 *
 * If those merges are wrong, the fix is to UNDO the merge, not to hand one person's
 * journey to another. Repointing them would bury the mistake under a second one. So
 * this script requires the keeper's name to match the duplicate's, which is the
 * signature of a true same-person duplicate (e.g. "Jarrod Turner" -> "Jarrod Turner",
 * whose keeper has no journey of its own). Anything else is REPORTED and SKIPPED for a
 * human to rule on.
 *
 * Dry run by default. Pass --apply to write.
 *
 *   npx tsx scripts/repair-orphaned-journey-primaries.ts
 *   npx tsx scripts/repair-orphaned-journey-primaries.ts --apply
 */

const APPLY = process.argv.includes("--apply");

const norm = (first?: string | null, last?: string | null) =>
  `${first ?? ""} ${last ?? ""}`.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Different-people merges a human has explicitly ruled correct.
 *
 * The name-match rule below is the safety net, and it stays. This list is the ONLY way
 * past it, and it is deliberately not a flag like `--force`: a flag would wave through
 * whatever happens to be orphaned on the day someone runs this. Each entry names the
 * exact row it authorises.
 *
 * A row must match on ALL THREE of slug, from-name and to-name to be repointed. If the
 * underlying data shifts — a rename, a re-merge, a different keeper — the entry stops
 * matching and the script goes back to refusing. Silence is the right failure here.
 *
 * Ruled by Corey on 2026-08-08, asked directly and answered "think those are correct":
 * both pairs are the same person under two records despite the names reading differently.
 */
const RULED_BY_HUMAN = [
  {
    slug: "vince-vitale",
    from: "vince vitale",
    to: "jo vitale",
    note: "Corey 2026-08-08 — merge confirmed correct; journey is archived",
  },
  {
    slug: "courtney-mcdonald",
    from: "courtney mcdonald",
    to: "michael scott",
    note: "Corey 2026-08-08 — merge confirmed correct; keeper already holds an active journey, which is allowed",
  },
] as const;

const ruling = (slug: string | null, from: string, to: string) =>
  RULED_BY_HUMAN.find((r) => r.slug === slug && r.from === from.toLowerCase() && r.to === to.toLowerCase());

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
  });

  console.log(APPLY ? "MODE: APPLY (writing)\n" : "MODE: dry run — pass --apply to write\n");

  const { data: merged, error: e1 } = await sb
    .from("contacts")
    .select("id, first_name, last_name, merged_into_contact_id, merged_at")
    .not("merged_into_contact_id", "is", null);
  if (e1) throw new Error("contacts: " + e1.message);
  if (!merged?.length) {
    console.log("No merged-away contacts. Nothing to do.");
    return;
  }

  const loserById = new Map(merged.map((m) => [m.id, m]));
  const { data: orphans, error: e2 } = await sb
    .from("journeys")
    .select("id, name, status, slug, primary_contact_id")
    .in(
      "primary_contact_id",
      merged.map((m) => m.id)
    );
  if (e2) throw new Error("journeys: " + e2.message);

  if (!orphans?.length) {
    console.log("No journeys point at a merged-away contact. Nothing to do.");
    return;
  }

  console.log(`${orphans.length} journey(s) point at a merged-away contact.\n`);
  let repaired = 0;
  let skipped = 0;

  for (const j of orphans) {
    const loser = loserById.get(j.primary_contact_id as string);
    if (!loser) continue;

    const { data: keeper } = await sb
      .from("contacts")
      .select("id, first_name, last_name")
      .eq("id", loser.merged_into_contact_id as string)
      .maybeSingle();

    const label = `"${j.name}" [${j.status}] (slug ${j.slug})`;
    const from = `${loser.first_name ?? ""} ${loser.last_name ?? ""}`.trim();
    const to = keeper ? `${keeper.first_name ?? ""} ${keeper.last_name ?? ""}`.trim() : null;

    if (!keeper) {
      console.log(
        `SKIP  ${label}\n      keeper ${loser.merged_into_contact_id} does not exist — a broken merge pointer, not an orphan.`
      );
      skipped++;
      continue;
    }

    const namesMatch = norm(loser.first_name, loser.last_name) === norm(keeper.first_name, keeper.last_name);
    const ruled = namesMatch ? undefined : ruling(j.slug as string | null, from, to);

    if (!namesMatch && !ruled) {
      console.log(
        `SKIP  ${label}\n` +
          `      "${from}" was merged into "${to}" — DIFFERENT PEOPLE. Not repointing.\n` +
          `      If that merge was wrong, undo the merge; do not hand this journey to ${to}.\n` +
          `      If it was right, add this row to RULED_BY_HUMAN at the top of this file.`
      );
      skipped++;
      continue;
    }

    const { data: keeperJourneys } = await sb
      .from("journeys")
      .select("id, name, status")
      .eq("primary_contact_id", keeper.id);
    const note = keeperJourneys?.length
      ? `keeper already has ${keeperJourneys.length} journey(s) — that is allowed, a person can hold several`
      : "keeper has no journey of its own";

    const basis = ruled ? `RULED: ${ruled.note}` : "same person";

    if (!APPLY) {
      console.log(`WOULD REPAIR  ${label}\n      "${from}" -> "${to}" (${basis}); ${note}`);
      repaired++;
      continue;
    }

    const { error } = await sb.from("journeys").update({ primary_contact_id: keeper.id }).eq("id", j.id);
    if (error) {
      console.log(`FAILED  ${label}: ${error.message}`);
      skipped++;
      continue;
    }
    console.log(`REPAIRED  ${label}\n      "${from}" -> "${to}" (${basis}); ${note}`);
    repaired++;
  }

  console.log(`\n${APPLY ? "repaired" : "would repair"}: ${repaired}   skipped for a human: ${skipped}`);
  if (skipped) {
    console.log("The skipped rows are a judgement call about whether the MERGE was right, not about this pointer.");
  }
}

main().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
