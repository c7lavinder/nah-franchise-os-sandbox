export const dynamic = "force-dynamic";

/**
 * POST /api/cron/score-recalculate
 *
 * Recalculates intelligence scores and flags for all profiled candidates.
 * Rate limited: 200ms between each to avoid overloading Supabase.
 *
 * Intended to run on a schedule (e.g., nightly) to keep scores fresh
 * as time-sensitive factors (momentum, engagement decay) change.
 *
 * Returns count of profiles updated.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { updateCandidateScore } from "@/lib/intelligence/scoring";
import { updateCandidateFlags } from "@/lib/intelligence/flags";

/** Sleep helper for rate limiting between candidates */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const supabase = createServerClient();

    // Fetch all candidate_intelligence contact IDs
    const { data: records, error } = await supabase
      .from("candidate_intelligence")
      .select("contact_id")
      .order("updated_at", { ascending: true });

    if (error) {
      console.error("Failed to fetch candidate_intelligence records:", error.message);
      return NextResponse.json(
        { error: "Failed to fetch intelligence records" },
        { status: 500 }
      );
    }

    const contactIds = (records ?? []).map((r) => r.contact_id as string);

    let updated = 0;
    let failed = 0;

    for (const contactId of contactIds) {
      try {
        await updateCandidateScore(contactId, "cron_recalculate");
        await updateCandidateFlags(contactId);
        updated++;
      } catch (err) {
        console.error(`Score recalculate failed for ${contactId}:`, err);
        failed++;
      }

      // Rate limit: 200ms between each candidate
      if (updated + failed < contactIds.length) {
        await sleep(200);
      }
    }

    return NextResponse.json({
      total: contactIds.length,
      updated,
      failed,
    });
  } catch (err) {
    console.error("Score recalculate cron failed:", err);
    return NextResponse.json(
      { error: "Score recalculate cron failed" },
      { status: 502 }
    );
  }
}
