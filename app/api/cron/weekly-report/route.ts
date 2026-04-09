/**
 * Weekly Scout Performance Report Cron
 *
 * Runs Sunday at 11pm via Vercel cron.
 * POST /api/cron/weekly-report
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { generateWeeklyReport } from "@/lib/learning/weekly-report";
import { flagStaleDocuments } from "@/lib/kb/health-monitor";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();
  const startTime = Date.now();

  try {
    // Flag stale KB docs
    const staleFlagged = await flagStaleDocuments();

    // Generate weekly report
    const reportId = await generateWeeklyReport();

    const duration = Date.now() - startTime;

    await supabase.from("cron_job_log").insert({
      job_name: "weekly_scout_report",
      status: "success",
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
      result_summary: JSON.stringify({ reportId, staleFlagged }),
    });

    return NextResponse.json({ success: true, reportId, staleFlagged, duration_ms: duration });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase.from("cron_job_log").insert({
      job_name: "weekly_scout_report",
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
