/**
 * Monthly Rubric Review Cron
 *
 * Runs 1st of each month at 11pm via Vercel cron.
 * POST /api/cron/rubric-review
 *
 * Creates draft rubric review suggestions — never auto-applies.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { generateRubricReviewSuggestions } from "@/lib/learning/rubric-review";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();
  const startTime = Date.now();

  try {
    const result = await generateRubricReviewSuggestions();
    const duration = Date.now() - startTime;

    await supabase.from("cron_job_log").insert({
      job_name: "monthly_rubric_review",
      status: "success",
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
      result_summary: JSON.stringify(result),
    });

    return NextResponse.json({ success: true, ...result, duration_ms: duration });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase.from("cron_job_log").insert({
      job_name: "monthly_rubric_review",
      status: "failed",
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
      error_message: msg,
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
