/**
 * Backfill script — re-runs the shared resolver + the new journey-based
 * classifier against every non-deleted call and brings all of these in line:
 *
 *   - calls.contact_id / territory_ms_slug / journey_pipeline_state_id
 *     (NULL for group + internal; primary from resolver for sales/onboarding/
 *     coaching)
 *   - calls.call_type_id (moved into its category under the new rule:
 *     sales subdivides; onboarding/coaching/group/internal are single-slug)
 *   - calls.match_confidence / match_reason (resolver's reason string)
 *   - call_territories / call_journeys junctions (via upsertCallJunctions)
 *
 * Default mode is DRY RUN — prints old/new values per call, writes nothing.
 * Pass --live to apply.
 *
 *   DRY RUN:  npx tsx scripts/rematch-calls.ts
 *   LIVE:     npx tsx scripts/rematch-calls.ts --live
 *
 * Skips rows whose match_reason starts with "manual override" so human
 * corrections survive.
 */

import { createClient } from "@supabase/supabase-js";
import {
  resolveCallParticipants,
  createSupabaseResolverDb,
  type ParticipantSignal,
  type ResolverDb,
} from "../lib/calls/resolve-participants";
import { upsertCallJunctions } from "../lib/calls/processors/upsert-call-junctions";
import type { CallCategory } from "../lib/calls/classifier";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const LIVE = process.argv.includes("--live");

/** Derive the category label the classifier would pick. Mirrors the rule in
 *  lib/calls/classifier.ts so the backfill converges on the same answer. */
async function deriveCategory(
  externals: { journey_id: string | null }[],
  nahCount: number,
  territoryMsSlug: string | null,
  db: ResolverDb,
): Promise<{ category: CallCategory; distinctJourneys: number }> {
  const distinctIds = new Set(externals.map((p) => p.journey_id).filter((id): id is string => !!id));
  const count = distinctIds.size;

  // INTERNAL — NAH team present, nobody on the call is in a journey.
  // Covers team-only calls AND team + vendor/supplier/observer calls.
  if (nahCount > 0 && count === 0) return { category: "internal", distinctJourneys: 0 };
  if (count >= 2) return { category: "group", distinctJourneys: count };
  if (count === 1 && externals.length > 0) {
    const journeyId = [...distinctIds][0];
    const hasTerritory = !!territoryMsSlug;
    if (!hasTerritory) return { category: "prospect", distinctJourneys: 1 };
    const inRunway = await db.isJourneyInRunway(journeyId);
    return { category: inRunway ? "coaching" : "onboarding", distinctJourneys: 1 };
  }
  // No team, no journey, but externals present — brand-new prospect where
  // nothing is in the CRM yet.
  if (count === 0 && externals.length > 0) return { category: "prospect", distinctJourneys: 0 };
  return { category: "unknown", distinctJourneys: 0 };
}

/** Pick a call_types.slug for a category. Only sales subdivides; other
 *  categories get a single marker slug. */
function slugForCategory(category: CallCategory, existingSlugInSales: string | null): string {
  if (category === "internal") return "team_call";
  if (category === "onboarding") return "onboarding_call";
  if (category === "coaching") return "coaching_call";
  if (category === "group") return "group_call";
  if (category === "prospect") {
    // Preserve the sales sub-type the call already carries (intro/matt/sam/
    // mark/matt_final). If it had a non-sales slug before, default to intro_call.
    const salesSlugs = ["intro_call", "matt_call", "sam_call", "mark_call", "matt_final_call"];
    if (existingSlugInSales && salesSlugs.includes(existingSlugInSales)) return existingSlugInSales;
    return "intro_call";
  }
  return "unclassified";
}

async function main() {
  console.log(`Mode: ${LIVE ? "LIVE (writing)" : "DRY RUN (no writes)"}\n`);

  // Pre-load call_types for slug → id mapping.
  const { data: types } = await supabase.from("call_types").select("id, slug, category");
  const slugToTypeId = new Map((types ?? []).map((t) => [t.slug, t.id]));
  const idToSlug = new Map((types ?? []).map((t) => [t.id, t.slug]));

  // Scope: every non-deleted call. The no-change short-circuit handles rows
  // that already match the resolver's output so we only write what changed.
  const { data: calls, error } = await supabase
    .from("calls")
    .select(
      "id, title, contact_id, territory_ms_slug, journey_pipeline_state_id, call_type_id, match_confidence, match_reason, source",
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) { console.error("Fetch failed:", error.message); process.exit(1); }
  if (!calls?.length) { console.log("No calls to rematch."); return; }
  console.log(`Scanning ${calls.length} calls.\n`);

  const db = createSupabaseResolverDb(supabase);

  let wouldUpdate = 0;
  let skippedManual = 0;
  let skippedNoChange = 0;
  const categoryCounts: Record<string, number> = {};

  for (const call of calls) {
    if (call.match_reason?.startsWith("manual override")) {
      skippedManual++;
      continue;
    }

    const { data: participants } = await supabase
      .from("call_participants")
      .select("email, display_name, role")
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

    // Derive category from the resolver's output + participant roles.
    const externals = result.participants.filter((p) => p.role !== "nah_team");
    const nahCount = result.participants.filter((p) => p.role === "nah_team").length;
    const { category, distinctJourneys } = await deriveCategory(
      externals,
      nahCount,
      result.territory_ms_slug,
      db,
    );

    const oldSlug = call.call_type_id ? idToSlug.get(call.call_type_id) ?? null : null;
    const newSlug = slugForCategory(category, oldSlug);
    const newCallTypeId = slugToTypeId.get(newSlug) ?? call.call_type_id;

    // For group/internal categories, the primary fields on calls MUST be
    // NULL — the junctions carry the full multi-entity truth.
    const forceNullPrimary = category === "group" || category === "internal";
    const targetContactId = forceNullPrimary ? null : result.contact_id;
    const targetTerritory = forceNullPrimary ? null : result.territory_ms_slug;
    const targetJps = forceNullPrimary ? null : result.journey_pipeline_state_id;

    const changed =
      targetContactId !== call.contact_id ||
      targetTerritory !== call.territory_ms_slug ||
      targetJps !== call.journey_pipeline_state_id ||
      newCallTypeId !== call.call_type_id ||
      call.match_confidence !== result.confidence;

    if (!changed) {
      skippedNoChange++;
      continue;
    }

    categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;
    wouldUpdate++;

    console.log(
      `[${LIVE ? "write" : "dry"}] ${call.id} ` +
        `category=${category.padEnd(10)} ` +
        `journeys=${distinctJourneys} ` +
        `slug: ${(oldSlug ?? "null").padEnd(20)} → ${newSlug.padEnd(20)} | ` +
        `contact ${(call.contact_id ?? "null").slice(0, 8)} → ${(targetContactId ?? "null").toString().slice(0, 8)} | ` +
        `terr ${(call.territory_ms_slug ?? "null").padEnd(7)} → ${(targetTerritory ?? "null").toString().padEnd(7)} | ` +
        `jps ${(call.journey_pipeline_state_id ?? "null").slice(0, 8)} → ${(targetJps ?? "null").toString().slice(0, 8)}`,
    );

    if (LIVE) {
      const { error: updateErr } = await supabase
        .from("calls")
        .update({
          contact_id: targetContactId,
          territory_ms_slug: targetTerritory,
          journey_pipeline_state_id: targetJps,
          call_type_id: newCallTypeId,
          match_confidence: result.confidence,
          match_reason: result.reason,
        })
        .eq("id", call.id);
      if (updateErr) {
        console.error(`[error] ${call.id}: ${updateErr.message}`);
        continue;
      }
      // Update junctions per the resolver's output (even for group — we want
      // every journey / territory attached at the junction level).
      await upsertCallJunctions(supabase, call.id, result);
    }
  }

  console.log("\n--- summary ---");
  console.log(`Total candidates:            ${calls.length}`);
  console.log(`Would update:                ${wouldUpdate}`);
  console.log(`Skipped (manual override):   ${skippedManual}`);
  console.log(`Skipped (no change):         ${skippedNoChange}`);
  console.log("Categories:");
  for (const [cat, n] of Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat.padEnd(12)} ${n}`);
  }
  if (!LIVE) {
    console.log("\nDry run complete. Re-run with --live to apply.");
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
