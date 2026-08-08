export const dynamic = "force-dynamic";
// The journey section calls Claude Haiku once per journey, so this needs real headroom.
export const maxDuration = 300;

/**
 * ⚠ DELIBERATELY NOT SCHEDULED. This path is absent from `vercel.json` on purpose.
 *
 * Corey, 2026-08-08: hold every one of these jobs off until FranDev has moved off Vercel
 * and onto MasterSuite completely. The code below is fixed and ready — it is the SCHEDULE
 * that is withheld, not the fix. Re-adding the path to `vercel.json` is all it takes to
 * start it, and that is a decision for after the move, not a tidy-up.
 *
 * The other three held back with it: score-recalculate, stale-leads, daily-brief,
 * generate-briefs.
 */

/**
 * GET|POST /api/cron/generate-briefs — keep the contact, territory and journey briefs fresh.
 *
 * Intended to run nightly once it is switched on (see the note above). For each of the three
 * record types it regenerates the briefs marked
 * `stale = true`, then fills in records that have no brief yet, up to BATCH_SIZE each. The
 * batch cap is what keeps a run inside its time limit; the backlog drains over successive
 * nights rather than being attempted in one go.
 *
 * ⚠ Two corrections to what this file used to claim:
 *
 *  - It said "regenerate stale contact + territory briefs" and "no LLM call — pure data
 *    aggregation". Contact and territory briefs are indeed pure aggregation, but
 *    `generateAndStoreJourneyBrief` calls Claude Haiku once per journey. That is the cost
 *    driver here and the reason for `maxDuration` above.
 *  - It said "Runs nightly via Vercel Cron", but the path was never listed in `vercel.json`
 *    and the route exported only POST. It has never run on a schedule: as of 2026-08-08
 *    production held **0 contact briefs and 0 territory briefs**, and 58 journey briefs —
 *    all of those written by the event-driven path, not by this job.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { generateAndStoreContactBrief } from "@/lib/briefs/contact-brief-generator";
import { generateAndStoreTerritoryBrief } from "@/lib/briefs/territory-brief-generator";
import { generateAndStoreJourneyBrief } from "@/lib/briefs/journey-brief-agent";

const BATCH_SIZE = 25;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();
  const results = {
    contacts: { generated: 0, failed: 0 },
    territories: { generated: 0, failed: 0 },
    journeys: { generated: 0, failed: 0 },
  };

  // 1. Regenerate stale contact briefs
  const { data: staleContacts } = await supabase
    .from("contact_briefs")
    .select("contact_id")
    .eq("stale", true)
    .limit(BATCH_SIZE);

  for (const row of staleContacts ?? []) {
    try {
      await generateAndStoreContactBrief(row.contact_id);
      results.contacts.generated++;
    } catch (err) {
      results.contacts.failed++;
      console.error(
        `[generate-briefs] contact ${row.contact_id} failed:`,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  // 2. Generate briefs for contacts that don't have one yet — only contacts with at least
  //    one call, i.e. active leads. A brief for someone nobody has spoken to has nothing in it.
  //
  //    (A `.not("id", "in", <subquery>)` attempt used to sit here. Supabase's REST filter
  //    cannot take a subquery, so it never filtered anything and its result was never read.
  //    Removed — it was one wasted round trip per run.)
  const { data: existingBriefIds } = await supabase.from("contact_briefs").select("contact_id");
  const existingSet = new Set((existingBriefIds ?? []).map((r) => r.contact_id));

  const { data: activeContacts } = await supabase
    .from("call_participants")
    .select("contact_id")
    .not("contact_id", "is", null)
    .limit(200);

  const uniqueNewContacts = [...new Set((activeContacts ?? []).map((r) => r.contact_id))]
    .filter((id): id is string => id != null && !existingSet.has(id))
    .slice(0, BATCH_SIZE);

  for (const contactId of uniqueNewContacts) {
    try {
      await generateAndStoreContactBrief(contactId);
      results.contacts.generated++;
    } catch (err) {
      results.contacts.failed++;
      console.error(
        `[generate-briefs] new contact ${contactId} failed:`,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  // 3. Regenerate stale territory briefs
  const { data: staleTerritories } = await supabase
    .from("territory_briefs")
    .select("territory_slug")
    .eq("stale", true)
    .limit(BATCH_SIZE);

  for (const row of staleTerritories ?? []) {
    try {
      await generateAndStoreTerritoryBrief(row.territory_slug);
      results.territories.generated++;
    } catch (err) {
      results.territories.failed++;
      console.error(
        `[generate-briefs] territory ${row.territory_slug} failed:`,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  // 4. Generate briefs for territories without one
  const { data: existingTerritoryBriefs } = await supabase.from("territory_briefs").select("territory_slug");
  const existingTerritorySet = new Set((existingTerritoryBriefs ?? []).map((r) => r.territory_slug));

  const { data: allTerritories } = await supabase
    .from("territories")
    .select(`"TerritorySlug"`)
    .eq("status", "active")
    .limit(200);

  const newTerritories = ((allTerritories ?? []) as any[])
    .map((t) => t.TerritorySlug)
    .filter((slug: string) => !existingTerritorySet.has(slug))
    .slice(0, BATCH_SIZE);

  for (const slug of newTerritories) {
    try {
      await generateAndStoreTerritoryBrief(slug);
      results.territories.generated++;
    } catch (err) {
      results.territories.failed++;
      console.error(
        `[generate-briefs] new territory ${slug} failed:`,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  // 5. Regenerate stale journey briefs
  const { data: staleJourneys } = await supabase
    .from("journey_briefs")
    .select("journey_id")
    .eq("stale", true)
    .limit(BATCH_SIZE);

  for (const row of staleJourneys ?? []) {
    try {
      await generateAndStoreJourneyBrief(row.journey_id);
      results.journeys.generated++;
    } catch (err) {
      results.journeys.failed++;
      console.error(
        `[generate-briefs] journey ${row.journey_id} failed:`,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  // 6. Generate briefs for active journeys without one
  const { data: existingJourneyBriefs } = await supabase.from("journey_briefs").select("journey_id");
  const existingJourneySet = new Set((existingJourneyBriefs ?? []).map((r) => r.journey_id));

  const { data: activeJourneys } = await supabase.from("journeys").select("id").eq("status", "active").limit(200);

  const newJourneys = ((activeJourneys ?? []) as any[])
    .map((j) => j.id as string)
    .filter((id) => !existingJourneySet.has(id))
    .slice(0, BATCH_SIZE);

  for (const journeyId of newJourneys) {
    try {
      await generateAndStoreJourneyBrief(journeyId);
      results.journeys.generated++;
    } catch (err) {
      results.journeys.failed++;
      console.error(
        `[generate-briefs] new journey ${journeyId} failed:`,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  // Log to cron_job_log
  const totalFailed = results.contacts.failed + results.territories.failed + results.journeys.failed;
  await supabase.from("cron_job_log").insert({
    job_name: "generate-briefs",
    status: totalFailed === 0 ? "success" : "partial",
    metadata: results,
  });

  return NextResponse.json(results);
}

/**
 * ⚠ Vercel Cron invokes a scheduled path with **GET**. This route exported only POST, so
 * every scheduled run answered 405 and did nothing. Same body, both verbs.
 */
export const GET = POST;
