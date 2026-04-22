/**
 * Backfill calls.contact_id / territory_ms_slug / journey_pipeline_state_id /
 * match_confidence / match_reason for rows that existed before the matching
 * sprints, plus the call_territories + call_journeys junctions.
 *
 * Default mode is DRY RUN — prints old/new values and the reason, writes
 * nothing. Pass --live to apply the updates.
 *
 *   DRY RUN:  npx tsx scripts/rematch-calls.ts
 *   LIVE:     npx tsx scripts/rematch-calls.ts --live
 *
 * Skips rows whose match_reason starts with "manual override" — those were
 * corrected by a human and must not be overwritten.
 */

import { createClient } from "@supabase/supabase-js";
import {
  resolveCallParticipants,
  createSupabaseResolverDb,
  type ParticipantSignal,
} from "../lib/calls/resolve-participants";
import { upsertCallJunctions } from "../lib/calls/processors/upsert-call-junctions";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const LIVE = process.argv.includes("--live");

async function main() {
  console.log(`Mode: ${LIVE ? "LIVE (writing)" : "DRY RUN (no writes)"}\n`);

  // Scope: rows where match_confidence IS NULL (pre-sprint) OR
  // journey_pipeline_state_id IS NULL (pre-journey-sprint). The journey
  // columns are newer, so some calls already have a contact/territory match
  // but are still missing their journey link.
  const { data: calls, error } = await supabase
    .from("calls")
    .select(
      "id, title, contact_id, territory_ms_slug, journey_pipeline_state_id, match_confidence, match_reason, source",
    )
    .or("match_confidence.is.null,journey_pipeline_state_id.is.null")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) { console.error("Fetch failed:", error.message); process.exit(1); }
  if (!calls?.length) { console.log("No calls with NULL match_confidence."); return; }
  console.log(`Found ${calls.length} calls to rematch.\n`);

  const db = createSupabaseResolverDb(supabase);

  let wouldUpdate = 0;
  let skippedManual = 0;
  let skippedNoChange = 0;
  const tierCounts: Record<string, number> = {};

  for (const call of calls) {
    if (call.match_reason?.startsWith("manual override")) {
      skippedManual++;
      console.log(`[skip-manual] ${call.id}`);
      continue;
    }

    const { data: participants } = await supabase
      .from("call_participants")
      .select("email, display_name")
      .eq("call_id", call.id);

    const signals: ParticipantSignal[] = (participants ?? []).map((p) => ({
      email: p.email,
      name: p.display_name,
      phone: null,
    }));

    const source = (call.source === "read_ai" || call.source === "ghl_calendar" || call.source === "manual")
      ? call.source
      : "manual";

    const result = await resolveCallParticipants(
      { participants: signals, meeting_title: call.title ?? null, source },
      db,
    );

    const changed =
      result.contact_id !== call.contact_id ||
      result.territory_ms_slug !== call.territory_ms_slug ||
      result.journey_pipeline_state_id !== call.journey_pipeline_state_id ||
      call.match_confidence !== result.confidence;

    if (!changed && result.confidence === 0 && call.match_confidence === null) {
      // Still write match_confidence=0 + reason so the row is marked "processed".
    } else if (!changed) {
      skippedNoChange++;
      continue;
    }

    const tier = result.confidence === 1 ? "email"
      : result.confidence === 0.9 ? "phone"
      : result.confidence === 0.6 ? "name"
      : "none";
    tierCounts[tier] = (tierCounts[tier] ?? 0) + 1;
    wouldUpdate++;

    console.log(
      `[${LIVE ? "write" : "dry"}] ${call.id} ` +
        `contact: ${call.contact_id ?? "null"} → ${result.contact_id ?? "null"} | ` +
        `territory: ${call.territory_ms_slug ?? "null"} → ${result.territory_ms_slug ?? "null"} | ` +
        `jps: ${call.journey_pipeline_state_id ?? "null"} → ${result.journey_pipeline_state_id ?? "null"} | ` +
        `conf=${result.confidence} (${result.reason})`,
    );

    if (LIVE) {
      const { error: updateErr } = await supabase
        .from("calls")
        .update({
          contact_id: result.contact_id,
          territory_ms_slug: result.territory_ms_slug,
          journey_pipeline_state_id: result.journey_pipeline_state_id,
          match_confidence: result.confidence,
          match_reason: result.reason,
        })
        .eq("id", call.id);
      if (updateErr) {
        console.error(`[error] ${call.id}: ${updateErr.message}`);
        continue;
      }
      await upsertCallJunctions(supabase, call.id, result);
    }
  }

  console.log("\n--- summary ---");
  console.log(`Total candidates:            ${calls.length}`);
  console.log(`Would update:                ${wouldUpdate}`);
  console.log(`Skipped (manual override):   ${skippedManual}`);
  console.log(`Skipped (no change):         ${skippedNoChange}`);
  for (const [tier, n] of Object.entries(tierCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${tier.padEnd(8)} ${n}`);
  }
  if (!LIVE) {
    console.log("\nDry run complete. Re-run with --live to apply.");
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
