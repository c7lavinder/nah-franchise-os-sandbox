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
  {
    path: "/frandev/api/cron/workflow-scheduler",
    name: "Workflow Scheduler",
    schedule: "*/15 * * * *",
    description: "Process all active workflow enrollments — execute due steps, advance days, check exit conditions",
    category: "workflows",
    frequency: "Every 15 minutes",
  },
  {
    path: "/frandev/api/cron/workflow-notifications",
    name: "Workflow Notifications",
    schedule: "0 */4 * * *",
    description: "Flag steps pending confirmation, alert on unhealthy workflows, detect stale enrollments",
    category: "workflows",
    frequency: "Every 4 hours",
  },
  {
    path: "/frandev/api/cron/workflow-delivery-sync",
    name: "Workflow Delivery Sync",
    schedule: "*/15 * * * *",
    description: "Sync message delivery and response data from GHL, auto-enroll contacts matching stage triggers",
    category: "workflows",
    frequency: "Every 15 minutes",
  },
  {
    path: "/frandev/api/cron/workflow-analysis",
    name: "Workflow Health Analysis",
    schedule: "0 6 * * *",
    description: "Score all live workflows A-F based on open rates, response rates, and goal achievement",
    category: "workflows",
    frequency: "Daily at 6:00 AM",
  },
  {
    path: "/frandev/api/cron/daily-brief",
    name: "Daily Brief",
    schedule: "30 7 * * *",
    description: "Generate proactive daily brief per user — stalled leads, today's calls, alerts, pending approvals",
    category: "reporting",
    frequency: "Daily at 7:30 AM",
  },
  {
    path: "/frandev/api/cron/score-recalculate",
    name: "Score Recalculation",
    schedule: "0 2 * * *",
    description:
      "Recalculate intelligence scores and flags for all profiled candidates — keeps time-sensitive factors fresh",
    category: "agents",
    frequency: "Daily at 2:00 AM",
  },
  {
    path: "/frandev/api/cron/stale-leads",
    name: "Stale Lead Alerts",
    schedule: "0 8 * * *",
    description:
      "Check all active pipeline leads for staleness and create inactivity alerts (3d medium, 7d high, 14d follow-up)",
    category: "pipeline",
    frequency: "Daily at 8:00 AM",
  },
  {
    path: "/frandev/api/cron/sync-ghl-calendar",
    name: "GHL Calendar Sync",
    schedule: "*/30 * * * *",
    description: "Poll GHL calendar events with meeting links and upsert into calls table",
    category: "pipeline",
    frequency: "Every 30 minutes",
  },
  {
    path: "/frandev/api/cron/sync-ms-properties",
    name: "MasterSuite Property Sync",
    schedule: "*/15 * * * *",
    description:
      "Incremental sync of property data from MasterSuite — properties, calculations, inventory, status history",
    category: "pipeline",
    frequency: "Every 15 minutes",
  },
  {
    path: "/frandev/api/cron/sync-ms-territories",
    name: "MasterSuite Territory Sync",
    schedule: "0 */6 * * *",
    description: "Sync all 88 territories from MasterSuite — owner info, compliance, dates, marketing, vendor accounts",
    category: "pipeline",
    frequency: "Every 6 hours",
  },
  {
    path: "/frandev/api/cron/sync-ms-lead-list",
    name: "MasterSuite Lead List Counts",
    schedule: "0 1 * * *",
    description: "Full recount of Lead List entries by territory, month, LeadCategory, and LeadType",
    category: "pipeline",
    frequency: "Daily at 1:00 AM",
  },
  {
    path: "/frandev/api/cron/sync-ms-eos",
    name: "MasterSuite EOS Sync",
    schedule: "0 */6 * * *",
    description:
      "Sync EOS data from MasterSuite — rocks, todos, issues, budgets, goals, habits, lead channels, construction EOS, project management",
    category: "pipeline",
    frequency: "Every 6 hours",
  },
  {
    path: "/frandev/api/cron/sync-ms-prospects",
    name: "MasterSuite Prospect Sync",
    schedule: "*/15 * * * *",
    description: "Import new Path to Ownership entries from MasterSuite as contacts in Engagement stage",
    category: "pipeline",
    frequency: "Every 15 minutes",
  },
  {
    path: "/frandev/api/cron/coaching-brief",
    name: "Coaching Brief",
    schedule: "0 7 * * *",
    description:
      "Personalized daily coaching brief for reps — top leads needing action, overdue follow-ups, call quality trends, objection patterns. Weekly scorecard on Mondays.",
    category: "agents",
    frequency: "Daily at 7:00 AM",
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
