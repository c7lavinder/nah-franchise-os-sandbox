/**
 * Journal Cron Job — runs all 3 journal generators at 11pm daily.
 *
 * POST /api/cron/journals
 *
 * Vercel cron: configure in vercel.json with schedule "0 23 * * *"
 * Manual trigger: POST with optional { date: "YYYY-MM-DD" }
 *
 * Runs in order:
 * 1. Contact journals (per contact with activity today)
 * 2. Rep journals (per active user)
 * 3. System log aggregation
 *
 * All results logged to cron_job_log table.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { runContactJournalCron } from "@/lib/journals/contact-journal";
import { runRepJournalCron } from "@/lib/journals/rep-journal";
import { runSystemLogCron } from "@/lib/journals/system-log";

export async function POST(request: NextRequest) {
  // Verify cron secret or allow in development
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (
    cronSecret &&
    authHeader !== `Bearer ${cronSecret}` &&
    process.env.NODE_ENV !== "development"
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();
  const startTime = Date.now();

  let body: { date?: string } = {};
  try {
    body = await request.json();
  } catch {
    // No body is fine — use today's date
  }

  const date = body.date ?? new Date().toISOString().split("T")[0];

  const results: {
    contact_journals: { processed: number; skipped: number; failed: number } | null;
    rep_journals: { processed: number; skipped: number; failed: number } | null;
    system_log: { logged: number } | null;
    errors: string[];
  } = {
    contact_journals: null,
    rep_journals: null,
    system_log: null,
    errors: [],
  };

  // 1. Contact journals
  try {
    results.contact_journals = await runContactJournalCron(date);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    results.errors.push(`contact_journals: ${msg}`);
  }

  // 2. Rep journals
  try {
    results.rep_journals = await runRepJournalCron(date);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    results.errors.push(`rep_journals: ${msg}`);
  }

  // 3. System log
  try {
    results.system_log = await runSystemLogCron(date);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    results.errors.push(`system_log: ${msg}`);
  }

  const duration = Date.now() - startTime;

  // Log to cron_job_log
  await supabase.from("cron_job_log").insert({
    job_name: "daily_journals",
    status: results.errors.length > 0 ? "partial_failure" : "success",
    started_at: new Date(startTime).toISOString(),
    completed_at: new Date().toISOString(),
    result_summary: JSON.stringify(results),
    error_message:
      results.errors.length > 0 ? results.errors.join("; ") : null,
  });

  return NextResponse.json({
    success: results.errors.length === 0,
    date,
    duration_ms: duration,
    ...results,
  });
}

// Also support GET for Vercel Cron (which uses GET by default)
export async function GET(request: NextRequest) {
  // Vercel Cron sends GET requests
  return POST(request);
}
