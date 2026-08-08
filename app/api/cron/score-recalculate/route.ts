export const dynamic = "force-dynamic";
// Bounded and write-light, but 300 candidates is still 300 round trips worst case.
export const maxDuration = 120;

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
 * GET|POST /api/cron/score-recalculate
 *
 * Refreshes candidate intelligence scores and flags for the candidates most
 * overdue a check. Intended to run nightly once it is switched on (see the note above).
 *
 * ⚠ WHY THIS IS NOT "EVERY CANDIDATE, EVERY NIGHT" ANY MORE.
 *
 * Measured on production 2026-08-08. The previous version selected ALL
 * `candidate_intelligence` rows and walked them one at a time with a 200 ms sleep
 * between each. Three things were wrong with that:
 *
 *   1. **It could not finish.** 1,987 candidates × ~0.87 s = ~29 minutes, which is far
 *      past any Vercel function limit. The one real run in the table (2026-03-27,
 *      05:54 → 06:23) took 28m 55s. Scheduled, it would time out part-way and silently
 *      do a fraction of the list while appearing to work.
 *   2. **It wrote a `candidate_score_history` row per candidate per night whether or
 *      not anything changed** — ~725,000 rows a year recording "nothing happened".
 *   3. **Almost nothing it recalculated could have moved.** Every input to the score is
 *      a stored field, and each of those already triggers a recalculation where it is
 *      written (call logs, Zorakle, objections, post-call extraction). The only genuinely
 *      time-dependent rule in the whole engine is the PTO-not-started penalty, which
 *      fires once at 5 days since creation and never changes again.
 *
 * So this version does bounded work and only writes when something actually changed:
 *
 *   - **Bounded batch**, oldest-checked first, so a run always finishes. The full book
 *     rotates through over a few nights instead of being attempted in one go.
 *   - **One read per candidate**, not two. It calls the pure calculators
 *     (`calculateScore` / `generateFlags`) rather than `updateCandidateScore` /
 *     `updateCandidateFlags`, which each re-fetch the same profile and always write.
 *     ⚠ The event-driven callers of those two are deliberately left alone — they run when
 *     something really did change, so their history rows are meaningful.
 *   - **No-op runs write nothing but the rotation marker.** A history row is inserted only
 *     when a score component or the flag set actually differs.
 *
 * `updated_at` doubles as that rotation marker. It is not read by any UI or API
 * (checked: `/api/intelligence/scores` does not select it), so advancing it costs nothing.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { calculateScore } from "@/lib/intelligence/scoring";
import { generateFlags, type IntelligenceFlag } from "@/lib/intelligence/flags";
import type { CandidateIntelligence } from "@/lib/intelligence/types";

/** Candidates examined per run. ~7 nights to cover the current book of 1,987. */
const DEFAULT_BATCH = 300;
const MAX_BATCH = 1000;

/**
 * Flags compared ignoring `createdAt`, which `generateFlags` stamps with the current
 * time on every call. Compare the raw arrays and every candidate looks changed every
 * night, which is precisely the write storm this route exists to stop.
 */
function flagIdentity(flags: unknown): string {
  if (!Array.isArray(flags)) return "[]";
  return JSON.stringify(
    flags.map((f) => {
      const r = (f ?? {}) as Record<string, unknown>;
      return [r.text ?? "", r.severity ?? "", r.category ?? ""];
    })
  );
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();

  try {
    const supabase = createServerClient();

    const requested = Number(new URL(request.url).searchParams.get("limit"));
    const batch =
      Number.isFinite(requested) && requested > 0 ? Math.min(Math.floor(requested), MAX_BATCH) : DEFAULT_BATCH;

    // Oldest-checked first, so every candidate comes round in turn and a run that is cut
    // short resumes where it left off rather than restarting at the same rows.
    const { data: profiles, error } = await supabase
      .from("candidate_intelligence")
      .select("*")
      .order("updated_at", { ascending: true })
      .limit(batch);

    if (error) {
      console.error("[score-recalculate] failed to fetch candidates:", error.message);
      return NextResponse.json({ error: "Failed to fetch intelligence records" }, { status: 500 });
    }

    let changed = 0;
    let unchanged = 0;
    let failed = 0;

    for (const row of (profiles ?? []) as CandidateIntelligence[]) {
      try {
        const score = calculateScore(row);
        const flags = generateFlags(row);

        const scoreMoved =
          score.total !== row.current_score ||
          score.financial !== row.score_financial ||
          score.operational !== row.score_operational ||
          score.engagement !== row.score_engagement ||
          score.momentum !== row.score_momentum;
        const flagsMoved = flagIdentity(flags) !== flagIdentity(row.active_flags);

        if (!scoreMoved && !flagsMoved) {
          // Nothing to record. Advance the marker only, so this candidate goes to the
          // back of the queue and the next run picks up someone else.
          await supabase
            .from("candidate_intelligence")
            .update({ updated_at: new Date().toISOString() })
            .eq("contact_id", row.contact_id);
          unchanged++;
          continue;
        }

        // A real change — this is what the history table is for.
        if (scoreMoved) {
          await supabase.from("candidate_score_history").insert({
            contact_id: row.contact_id,
            triggered_by: "cron_recalculate",
            trigger_id: null,
            score_before: row.current_score,
            score_after: score.total,
            financial_before: row.score_financial,
            financial_after: score.financial,
            operational_before: row.score_operational,
            operational_after: score.operational,
            engagement_before: row.score_engagement,
            engagement_after: score.engagement,
            momentum_before: row.score_momentum,
            momentum_after: score.momentum,
            changes_explained: score.changes,
          });
        }

        await supabase
          .from("candidate_intelligence")
          .update({
            current_score: score.total,
            score_financial: score.financial,
            score_operational: score.operational,
            score_engagement: score.engagement,
            score_momentum: score.momentum,
            active_flags: flags,
            updated_at: new Date().toISOString(),
          })
          .eq("contact_id", row.contact_id);

        changed++;
      } catch (err) {
        console.error(`[score-recalculate] ${row.contact_id} failed:`, err instanceof Error ? err.message : err);
        failed++;
      }
    }

    const result = {
      examined: (profiles ?? []).length,
      changed,
      unchanged,
      failed,
      batch,
      ms: Date.now() - startedAt,
    };

    await supabase.from("cron_job_log").insert({
      job_name: "score-recalculate",
      status: failed === 0 ? "success" : "partial",
      metadata: result,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[score-recalculate] cron failed:", err);
    return NextResponse.json({ error: "Score recalculate cron failed" }, { status: 502 });
  }
}

/**
 * ⚠ Vercel Cron invokes a scheduled path with **GET**. This route exported only POST,
 * so every nightly run since it was scheduled answered 405 and did nothing — the whole
 * table still carried its 2026-03-27 timestamps four months later. Same body, both verbs.
 */
export const GET = POST;
