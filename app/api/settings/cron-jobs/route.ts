export const dynamic = "force-dynamic";

/**
 * GET /api/settings/cron-jobs — returns all scheduled cron jobs + recent execution logs.
 *
 * Combines the static schedule definition with actual execution history
 * from cron_job_log and integration_logs tables.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

/** All cron jobs defined in vercel.json + their metadata */
const CRON_DEFINITIONS = [
  {
    path: "/frandev/api/cron/process-transcripts",
    name: "Transcript Processor",
    schedule: "*/5 * * * *",
    description: "Process queued call transcriptions via Whisper",
    category: "pipeline",
    frequency: "Every 5 minutes",
  },
  {
    path: "/frandev/api/calls/reconcile",
    name: "Call Reconciler",
    schedule: "*/10 * * * *",
    description: "Reconcile call records with GHL and Read.ai data",
    category: "pipeline",
    frequency: "Every 10 minutes",
  },
  {
    path: "/frandev/api/cron/pre-call-briefs",
    name: "Pre-Call Briefs",
    schedule: "0 7 * * *",
    description: "Enrich + generate briefs for today's scheduled calls",
    category: "agents",
    frequency: "Daily at 7:00 AM",
  },
  {
    path: "/frandev/api/cron/journals",
    name: "Daily Journals",
    schedule: "0 23 * * *",
    description: "Generate end-of-day journals for reps and contacts",
    category: "reporting",
    frequency: "Daily at 11:00 PM",
  },
  {
    path: "/frandev/api/cron/refresh-ghl-token",
    name: "GHL Token Refresh",
    schedule: "0 */12 * * *",
    description: "Refresh GHL OAuth access token before expiry",
    category: "pipeline",
    frequency: "Every 12 hours",
  },
  {
    path: "/frandev/api/cron/weekly-report",
    name: "Weekly Report",
    schedule: "0 23 * * 0",
    description: "Generate weekly performance report for leadership",
    category: "reporting",
    frequency: "Sundays at 11:00 PM",
  },
  {
    path: "/frandev/api/cron/research-contacts",
    name: "Contact Research",
    schedule: "0 2 * * 0",
    description: "AI agent researches contacts needing profile enrichment",
    category: "agents",
    frequency: "Sundays at 2:00 AM",
  },
  {
    path: "/frandev/api/cron/research-territories",
    name: "Territory Research",
    schedule: "0 3 * * 0",
    description: "AI agent researches territory market conditions",
    category: "agents",
    frequency: "Sundays at 3:00 AM",
  },
  {
    path: "/frandev/api/cron/reengagement-scan",
    name: "Re-engagement Scan",
    schedule: "0 4 1 * *",
    description: "AI agent scans cold contacts for re-engagement signals",
    category: "agents",
    frequency: "1st of month at 4:00 AM",
  },
  {
    path: "/frandev/api/cron/rubric-review",
    name: "Rubric Review",
    schedule: "0 23 1 * *",
    description: "Monthly review of call rubric effectiveness",
    category: "reporting",
    frequency: "1st of month at 11:00 PM",
  },
];

export async function GET(request: NextRequest) {
  {
    const _auth = await requireAuth(request);
    if (_auth instanceof Response) return _auth;
  }
  const supabase = createServerClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Get execution logs from cron_job_log
  const { data: cronLogs } = await supabase
    .from("cron_job_log")
    .select("id, job_name, started_at, finished_at, status, error")
    .gte("started_at", sevenDaysAgo)
    .order("started_at", { ascending: false })
    .limit(200);

  // Also get integration_logs for agent runs (they log there, not cron_job_log)
  const { data: agentLogs } = await supabase
    .from("integration_logs")
    .select("id, integration_name, event_type, status, created_at, error_message")
    .gte("created_at", sevenDaysAgo)
    .in("integration_name", [
      "pre-call-brief",
      "contact-research",
      "territory-market",
      "reengagement-signal",
      "pre_call_brief_agent",
    ])
    .order("created_at", { ascending: false })
    .limit(100);

  // Map agent logs into a unified format
  const agentLogsMapped = (agentLogs ?? []).map((l) => ({
    id: l.id,
    job_name: l.integration_name,
    started_at: l.created_at,
    finished_at: l.created_at,
    status: l.status === "success" ? "success" : "failed",
    error: l.error_message,
  }));

  const allLogs = [...(cronLogs ?? []), ...agentLogsMapped].sort(
    (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
  );

  // Build per-job recent execution summary
  const jobExecutions: Record<string, { lastRun: string | null; lastStatus: string; runsThisWeek: number }> = {};
  for (const log of allLogs) {
    const name = log.job_name;
    if (!jobExecutions[name]) {
      jobExecutions[name] = { lastRun: log.started_at, lastStatus: log.status, runsThisWeek: 0 };
    }
    jobExecutions[name].runsThisWeek++;
  }

  // Enrich definitions with execution data
  const schedules = CRON_DEFINITIONS.map((def) => {
    // Match by path segment or integration name
    const pathSlug = def.path.split("/").pop() ?? "";
    const exec = jobExecutions[pathSlug] ?? jobExecutions[def.name.toLowerCase().replace(/ /g, "-")] ?? null;

    return {
      ...def,
      lastRun: exec?.lastRun ?? null,
      lastStatus: exec?.lastStatus ?? "no_data",
      runsThisWeek: exec?.runsThisWeek ?? 0,
    };
  });

  return NextResponse.json({ schedules, logs: allLogs.slice(0, 50) });
}
