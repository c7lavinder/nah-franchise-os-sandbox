/**
 * Helpers to mark journey briefs as stale when material events happen.
 * Called from pipeline advance/revert, call grading, and MasterSuite sync.
 */

import { createServerClient } from "@/lib/supabase/server";

/**
 * Mark a specific journey's brief as stale (by journey ID).
 */
export async function markJourneyBriefStale(journeyId: string): Promise<void> {
  const supabase = createServerClient();
  await supabase.from("journey_briefs").update({ stale: true }).eq("journey_id", journeyId);
}

/**
 * Mark journey briefs stale for all journeys a contact belongs to.
 * Resolves contactId → journey_contacts → journey_id.
 */
export async function markJourneyBriefStaleByContact(contactId: string): Promise<void> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("journey_contacts")
    .select("journey_id")
    .eq("contact_id", contactId)
    .is("left_at", null);

  if (!data || data.length === 0) return;

  const journeyIds = data.map((r) => r.journey_id);
  await supabase.from("journey_briefs").update({ stale: true }).in("journey_id", journeyIds);
}

/**
 * Mark journey briefs stale for all journeys linked to a territory slug.
 */
export async function markJourneyBriefStaleByTerritory(territorySlug: string): Promise<void> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("journey_pipeline_state")
    .select("journey_id")
    .eq("TerritorySlug", territorySlug);

  if (!data || data.length === 0) return;

  const journeyIds = [...new Set(data.map((r) => r.journey_id))];
  await supabase.from("journey_briefs").update({ stale: true }).in("journey_id", journeyIds);
}
