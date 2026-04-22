/**
 * Upserts `call_territories` and `call_journeys` rows from a resolver result.
 *
 * Idempotent — safe to call after insert or during reconcile/backfill. Every
 * unique territory and journey seen across the resolver's participants is
 * added to the call with the primary flag mirroring the resolver's top-level
 * winner. Existing rows keep their is_primary flag untouched so a manual
 * override on the call isn't clobbered by a later webhook/cron re-run.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ResolveResult } from "../resolve-participants";

export async function upsertCallJunctions(
  supabase: SupabaseClient,
  callId: string,
  match: ResolveResult,
): Promise<void> {
  await upsertTerritories(supabase, callId, match);
  await upsertJourneys(supabase, callId, match);
}

async function upsertTerritories(
  supabase: SupabaseClient,
  callId: string,
  match: ResolveResult,
): Promise<void> {
  const slugs = new Set<string>();
  for (const p of match.participants) {
    if (p.territory_ms_slug) slugs.add(p.territory_ms_slug);
  }
  if (match.territory_ms_slug) slugs.add(match.territory_ms_slug);
  if (slugs.size === 0) return;

  const { data: existing } = await supabase
    .from("call_territories")
    .select("territory_ms_slug, is_primary")
    .eq("call_id", callId);

  const existingSlugs = new Set((existing ?? []).map((r) => r.territory_ms_slug));
  const hasPrimary = (existing ?? []).some((r) => r.is_primary);

  const rowsToInsert: {
    call_id: string;
    territory_ms_slug: string;
    is_primary: boolean;
  }[] = [];
  for (const slug of slugs) {
    if (existingSlugs.has(slug)) continue;
    rowsToInsert.push({
      call_id: callId,
      territory_ms_slug: slug,
      is_primary: !hasPrimary && slug === match.territory_ms_slug,
    });
  }

  if (rowsToInsert.length > 0) {
    await supabase.from("call_territories").insert(rowsToInsert);
  }
}

async function upsertJourneys(
  supabase: SupabaseClient,
  callId: string,
  match: ResolveResult,
): Promise<void> {
  const picks = new Map<string, { journey_id: string }>();
  for (const p of match.participants) {
    if (p.journey_pipeline_state_id && p.journey_id) {
      picks.set(p.journey_pipeline_state_id, { journey_id: p.journey_id });
    }
  }
  if (match.journey_pipeline_state_id && match.journey_id) {
    picks.set(match.journey_pipeline_state_id, { journey_id: match.journey_id });
  }
  if (picks.size === 0) return;

  const { data: existing } = await supabase
    .from("call_journeys")
    .select("journey_pipeline_state_id, is_primary")
    .eq("call_id", callId);

  const existingJpsIds = new Set((existing ?? []).map((r) => r.journey_pipeline_state_id));
  const hasPrimary = (existing ?? []).some((r) => r.is_primary);

  const rowsToInsert: {
    call_id: string;
    journey_id: string;
    journey_pipeline_state_id: string;
    is_primary: boolean;
  }[] = [];
  for (const [jpsId, { journey_id }] of picks) {
    if (existingJpsIds.has(jpsId)) continue;
    rowsToInsert.push({
      call_id: callId,
      journey_id,
      journey_pipeline_state_id: jpsId,
      is_primary: !hasPrimary && jpsId === match.journey_pipeline_state_id,
    });
  }

  if (rowsToInsert.length > 0) {
    await supabase.from("call_journeys").insert(rowsToInsert);
  }
}
