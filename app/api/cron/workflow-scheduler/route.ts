export const dynamic = "force-dynamic";

/**
 * POST /api/cron/workflow-scheduler
 *
 * Runs the workflow step scheduler for all active enrollments.
 * Processes due steps, executes auto-execute steps, queues confirmation
 * steps for human review, and advances enrollments to the next day.
 *
 * Intended to run every 15 minutes via cron.
 * Safe to call multiple times — skips already-executed steps.
 */

import { NextRequest, NextResponse } from "next/server";
import { runScheduler } from "@/lib/workflows/scheduler";

async function handleWorkflowScheduler(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const startTime = Date.now();
    const result = await runScheduler();
    const durationMs = Date.now() - startTime;

    console.log(
      `[workflow-scheduler] Processed ${result.enrollmentsProcessed} enrollments, ` +
        `${result.stepsExecuted} executed, ${result.stepsQueued} queued, ` +
        `${result.enrollmentsAdvanced} advanced, ${result.enrollmentsExpired} expired, ` +
        `${result.errors.length} errors in ${durationMs}ms`
    );

    return NextResponse.json({
      ...result,
      durationMs,
    });
  } catch (err) {
    console.error("[workflow-scheduler] Fatal error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Scheduler failed" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handleWorkflowScheduler(request);
}

export async function POST(request: NextRequest) {
  return handleWorkflowScheduler(request);
}
