/**
 * Phase 2 dual-write layer for the journeys restructure.
 *
 * After every write to contact_pipeline_state, callers invoke
 * syncJourneyForContact() to mirror the state onto journey_pipeline_state.
 * The sync is idempotent and one-directional (cps → jps). If the contact
 * has no journey yet, one is created with primary membership.
 *
 * Removed in Phase 4 after the read cutover.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

type SB = SupabaseClient;

/** Find or create a journey for the contact. Returns journey id. */
export async function ensureJourneyForContact(supabase: SB, contactId: string): Promise<string | null> {
  const { data: existing } = await supabase
    .from("journeys")
    .select("id")
    .eq("primary_contact_id", contactId)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: contact } = await supabase
    .from("contacts")
    .select("first_name, last_name, email")
    .eq("id", contactId)
    .maybeSingle();
  const name = `${contact?.first_name ?? ""} ${contact?.last_name ?? ""}`.trim()
    || contact?.email
    || "Unnamed";

  const { data: journey, error } = await supabase
    .from("journeys")
    .insert({ primary_contact_id: contactId, name, status: "active" })
    .select("id")
    .single();
  if (error || !journey) {
    console.error("[journeys.sync] failed to create journey for contact", contactId, error?.message);
    return null;
  }

  const { error: memberErr } = await supabase
    .from("journey_contacts")
    .insert({ journey_id: journey.id, contact_id: contactId, role: "primary" });
  if (memberErr && !memberErr.message.includes("uniq_active_journey_contact")) {
    console.warn("[journeys.sync] primary membership insert warn:", memberErr.message);
  }

  return journey.id;
}

/** Return the territory slugs this contact owns currently (end_date IS NULL). */
async function activeTerritoriesForContact(supabase: SB, contactId: string): Promise<string[]> {
  const { data: contact } = await supabase
    .from("contacts")
    .select("ghl_contact_id")
    .eq("id", contactId)
    .maybeSingle();
  if (!contact?.ghl_contact_id) return [];

  const { data } = await supabase
    .from("territory_owners")
    .select("ms_slug")
    .eq("ghl_contact_id", contact.ghl_contact_id)
    .is("end_date", null);
  return (data ?? []).map((r) => r.ms_slug);
}

/**
 * Mirror contact_pipeline_state rows for (contact, pipeline) onto
 * journey_pipeline_state. Called AFTER the cps write so the source-of-truth
 * row already reflects the caller's change. Idempotent.
 *
 * For runway / onboarding pipelines, we fan out one jps row per active
 * territory the contact owns (handles Phil-style multi-territory franchisees).
 * For every other pipeline, we write one jps row with territory_ms_slug = NULL.
 */
export async function syncJourneyForContact(
  supabase: SB,
  contactId: string,
  pipelineId: string,
): Promise<void> {
  const journeyId = await ensureJourneyForContact(supabase, contactId);
  if (!journeyId) return;

  const { data: cpsRows } = await supabase
    .from("contact_pipeline_state")
    .select("pipeline_id, current_stage_id, current_sub_task_id, current_sub_task_started_at, entered_pipeline_at, entered_current_stage_at, assigned_user_id, is_active, closed_reason, closed_at")
    .eq("contact_id", contactId)
    .eq("pipeline_id", pipelineId);

  if (!cpsRows || cpsRows.length === 0) return;

  const { data: pipeline } = await supabase
    .from("pipelines")
    .select("slug")
    .eq("id", pipelineId)
    .maybeSingle();
  const isTerritoryPipeline = pipeline?.slug === "runway" || pipeline?.slug === "onboarding";

  const territories = isTerritoryPipeline ? await activeTerritoriesForContact(supabase, contactId) : [];
  const targetSlugs: (string | null)[] = territories.length > 0 ? territories : [null];

  for (const cps of cpsRows) {
    for (const slug of targetSlugs) {
      const row = {
        journey_id: journeyId,
        territory_ms_slug: slug,
        pipeline_id: cps.pipeline_id,
        current_stage_id: cps.current_stage_id,
        current_sub_task_id: cps.current_sub_task_id,
        current_sub_task_started_at: cps.current_sub_task_started_at,
        entered_pipeline_at: cps.entered_pipeline_at,
        entered_current_stage_at: cps.entered_current_stage_at,
        assigned_user_id: cps.assigned_user_id,
        is_active: cps.is_active,
        closed_reason: cps.closed_reason,
        closed_at: cps.closed_at,
      };

      const matchQuery = supabase
        .from("journey_pipeline_state")
        .select("id")
        .eq("journey_id", journeyId)
        .eq("pipeline_id", cps.pipeline_id);
      const scopedMatch = slug === null
        ? matchQuery.is("territory_ms_slug", null)
        : matchQuery.eq("territory_ms_slug", slug);

      const { data: existingRows } = await scopedMatch;
      const existing = existingRows?.[0];

      if (existing?.id) {
        await supabase.from("journey_pipeline_state").update(row).eq("id", existing.id);
      } else {
        await supabase.from("journey_pipeline_state").insert(row);
      }
    }
  }
}

/** Lookup helper used by post-call writers to tag extractions / actions. */
export async function resolveJourneyIdForContact(supabase: SB, contactId: string | null): Promise<string | null> {
  if (!contactId) return null;
  const { data } = await supabase
    .from("journeys")
    .select("id")
    .eq("primary_contact_id", contactId)
    .maybeSingle();
  return data?.id ?? null;
}
