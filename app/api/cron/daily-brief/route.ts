export const dynamic = "force-dynamic";

/**
 * POST /api/cron/daily-brief — generates a proactive daily brief per user.
 *
 * Runs at 7:30 AM daily via Vercel Cron. For each active user:
 *   1. Counts stalled leads (>7 days in stage, no activity)
 *   2. Counts today's appointments
 *   3. Counts unresolved alerts
 *   4. Counts pending workflow confirmations
 *   5. Creates an in-app notification with the summary
 *
 * No LLM call — pure data aggregation for speed and cost.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();
  const startTime = Date.now();

  try {
    // Get all active users
    const { data: users } = await supabase
      .from("users")
      .select("id, full_name, role, ghl_user_id")
      .eq("is_active", true)
      .eq("is_real_user", true);

    if (!users || users.length === 0) {
      return NextResponse.json({ briefsSent: 0, message: "No active users" });
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    let briefsSent = 0;
    const notifications: {
      recipient_user_id: string;
      type: string;
      title: string;
      body: string;
      metadata: Record<string, unknown>;
    }[] = [];

    // ── Batch fetch all data in 5 parallel queries (not per-user) ──
    const userIds = users.map((u) => u.id);

    const [allJpsResult, allAlertsResult, pendingStepsResult, todayCallsResult] = await Promise.all([
      // All active pipeline states for all users
      supabase
        .from("journey_pipeline_state")
        .select("assigned_user_id, entered_current_stage_at")
        .eq("is_active", true)
        .in("assigned_user_id", userIds),

      // All unresolved alerts for all users
      supabase.from("inactivity_alerts").select("user_id").eq("is_resolved", false).in("user_id", userIds),

      // Global pending workflow steps (one count, shared)
      supabase
        .from("workflow_step_logs")
        .select("id", { count: "exact", head: true })
        .is("confirmed_at", null)
        .is("executed_at", null),

      // Today's calls for all users
      supabase
        .from("calls")
        .select("hosted_by_user_id")
        .in("hosted_by_user_id", userIds)
        .gte("scheduled_at", todayStart)
        .lt("scheduled_at", todayEnd),
    ]);

    const allJps = allJpsResult.data ?? [];
    const allAlerts = allAlertsResult.data ?? [];
    const globalPendingSteps = pendingStepsResult.count ?? 0;
    const allTodayCalls = todayCallsResult.data ?? [];

    // ── Group by user in memory ──
    for (const user of users) {
      const lines: string[] = [];
      const metadata: Record<string, unknown> = {};

      // 1. Stalled leads
      const userJps = allJps.filter((j) => j.assigned_user_id === user.id);
      const stalledCount = userJps.filter((j) => j.entered_current_stage_at < sevenDaysAgo).length;
      if (stalledCount > 0) {
        lines.push(`${stalledCount} lead${stalledCount !== 1 ? "s" : ""} stalled (7+ days, no progress)`);
        metadata.stalledLeads = stalledCount;
      }

      // 2. Active leads
      const activeLeads = userJps.length;
      if (activeLeads > 0) {
        lines.push(`${activeLeads} active lead${activeLeads !== 1 ? "s" : ""} in your pipeline`);
        metadata.activeLeads = activeLeads;
      }

      // 3. Unresolved alerts
      const alertCount = allAlerts.filter((a) => a.user_id === user.id).length;
      if (alertCount > 0) {
        lines.push(`${alertCount} unresolved alert${alertCount !== 1 ? "s" : ""}`);
        metadata.alerts = alertCount;
      }

      // 4. Pending workflow confirmations (shared count, admin/operator only)
      if (globalPendingSteps > 0 && (user.role === "admin" || user.role === "operator")) {
        lines.push(`${globalPendingSteps} workflow step${globalPendingSteps !== 1 ? "s" : ""} awaiting approval`);
        metadata.pendingSteps = globalPendingSteps;
      }

      // 5. Calls scheduled today
      const todayCalls = allTodayCalls.filter((c) => c.hosted_by_user_id === user.id).length;
      if (todayCalls > 0) {
        lines.push(`${todayCalls} call${todayCalls !== 1 ? "s" : ""} scheduled today`);
        metadata.todayCalls = todayCalls;
      }

      if (lines.length === 0) {
        lines.push("All clear — no items need attention today.");
      }

      notifications.push({
        recipient_user_id: user.id,
        type: "daily_brief",
        title: "Daily Brief",
        body: lines.join(" | "),
        metadata,
      });

      briefsSent++;
    }

    // Bulk insert all notifications
    if (notifications.length > 0) {
      await supabase.from("notifications").insert(notifications);
    }

    // Log cron run
    await supabase.from("cron_job_log").insert({
      job_name: "daily-brief",
      started_at: new Date(startTime).toISOString(),
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      status: "success",
      result_summary: `${briefsSent} briefs sent`,
    });

    return NextResponse.json({ briefsSent, durationMs: Date.now() - startTime });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[daily-brief] Error:", message);

    try {
      await supabase.from("cron_job_log").insert({
        job_name: "daily-brief",
        started_at: new Date(startTime).toISOString(),
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        status: "error",
        error_message: message,
      });
    } catch {
      // swallow
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
