export const dynamic = "force-dynamic";

/**
 * GET /api/journeys/:journeyId/brief
 *
 * Returns the stored journey brief. If no brief exists yet, generates one
 * inline (~3-5s) so the user sees it on first visit without waiting for cron.
 * Subsequent loads are instant (cached in DB).
 *
 * Query params:
 *   ?refresh=true — force regeneration (ignores cache)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { generateAndStoreJourneyBrief } from "@/lib/briefs/journey-brief-agent";

export async function GET(request: NextRequest, { params }: { params: Promise<{ journeyId: string }> }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const { journeyId } = await params;
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "true";
  const supabase = createServerClient();

  // Force refresh — regenerate inline regardless of cache
  if (forceRefresh) {
    try {
      const result = await generateAndStoreJourneyBrief(journeyId);
      if (result) {
        return NextResponse.json({
          empty: false,
          narrative: result.narrative,
          next_actions: result.nextActions,
          stale: false,
          updated_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error(`[brief] refresh failed for ${journeyId}:`, err);
    }
  }

  const { data } = await supabase
    .from("journey_briefs")
    .select("narrative, next_actions, stale, updated_at")
    .eq("journey_id", journeyId)
    .maybeSingle();

  // Cached brief exists and is fresh — return immediately
  if (data && !data.stale) {
    return NextResponse.json({
      empty: false,
      narrative: data.narrative,
      next_actions: data.next_actions,
      stale: false,
      updated_at: data.updated_at,
    });
  }

  // Cached but stale — return cached version, regenerate in background
  if (data && data.stale) {
    void generateAndStoreJourneyBrief(journeyId).catch((err) => {
      console.error(`[brief] background regen failed for ${journeyId}:`, err);
    });
    return NextResponse.json({
      empty: false,
      narrative: data.narrative,
      next_actions: data.next_actions,
      stale: true,
      updated_at: data.updated_at,
    });
  }

  // No brief exists — generate inline (first visit)
  try {
    const result = await generateAndStoreJourneyBrief(journeyId);
    if (result) {
      return NextResponse.json({
        empty: false,
        narrative: result.narrative,
        next_actions: result.nextActions,
        stale: false,
        updated_at: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error(`[brief] inline generation failed for ${journeyId}:`, err);
  }

  return NextResponse.json({
    empty: true,
    narrative: "",
    next_actions: { primary: "Brief unavailable", secondary: [] },
    stale: true,
  });
}
