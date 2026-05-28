import { NextResponse } from "next/server";
import { checkMSConnection } from "./client";
import { createServerClient } from "@/lib/supabase/server";
import { getStaleRunningCutoff, isActiveRunningJob } from "./cron-lock";

/**
 * Wraps a MasterSuite cron sync function with:
 * 1. MySQL connectivity pre-check (avoids stuck "running" logs)
 * 2. Cron job logging with guaranteed cleanup
 * 3. Stale job cleanup (marks old "running" entries as failed)
 * 4. Timeout wrapper
 */
export async function withCronLogging<T>(
  jobName: string,
  timeoutMs: number,
  syncFn: () => Promise<T>,
  formatResult: (result: T) => { status: "success" | "failed"; result: Record<string, unknown>; error: string | null }
): Promise<NextResponse> {
  const supabase = createServerClient();

  // Clean up stale "running" entries older than 30 minutes.
  await supabase
    .from("cron_job_log")
    .update({
      status: "failed",
      finished_at: new Date().toISOString(),
      error: "Timed out: marked stale by next run",
    })
    .eq("job_name", jobName)
    .eq("status", "running")
    .lt("started_at", getStaleRunningCutoff());

  // Avoid overlapping MasterSuite syncs. Vercel cron/manual retries can overlap
  // long jobs; a second run should exit cleanly instead of fighting over rows.
  const { data: running } = await supabase
    .from("cron_job_log")
    .select("id, started_at")
    .eq("job_name", jobName)
    .eq("status", "running")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (running && isActiveRunningJob(running)) {
    return NextResponse.json(
      { success: false, skipped: true, reason: "already_running", jobName, startedAt: running.started_at },
      { status: 202 }
    );
  }

  // Test MySQL connectivity BEFORE creating log entry
  try {
    await checkMSConnection();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`${jobName}: MySQL connection failed:`, message);
    return NextResponse.json({ success: false, error: `MySQL unreachable: ${message}` }, { status: 503 });
  }

  // Now safe to create log entry — MySQL is reachable
  const { data: log } = await supabase
    .from("cron_job_log")
    .insert({ job_name: jobName, status: "running" })
    .select("id")
    .single();

  try {
    const result = await withTimeout(syncFn(), timeoutMs, jobName);
    const { status, result: resultData, error } = formatResult(result);

    if (log) {
      await supabase
        .from("cron_job_log")
        .update({ finished_at: new Date().toISOString(), status, result: resultData, error })
        .eq("id", log.id);
    }

    return NextResponse.json({ success: !error, ...resultData });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`${jobName} FAILED:`, message);

    if (log) {
      await supabase
        .from("cron_job_log")
        .update({ finished_at: new Date().toISOString(), status: "failed", error: message })
        .eq("id", log.id);
    }

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}
