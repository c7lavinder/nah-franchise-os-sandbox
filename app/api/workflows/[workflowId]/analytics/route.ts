export const dynamic = "force-dynamic";

/**
 * GET /api/workflows/:workflowId/analytics
 *
 * Returns aggregated performance metrics for a workflow:
 *   - Enrollment funnel (enrolled → active → completed → exited)
 *   - Per-step metrics (execution count, delivery rate, open rate, response rate)
 *   - Day-by-day drop-off
 *   - Overall health indicators
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ workflowId: string }> }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const { workflowId } = await params;
  const supabase = createServerClient();

  // Get workflow basics
  const { data: workflow } = await supabase
    .from("workflows")
    .select("id, name, status, health_score, current_version_id, active_enrollee_count")
    .eq("id", workflowId)
    .single();

  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  // Get all enrollments for this workflow
  const { data: enrollments } = await supabase
    .from("workflow_enrollments")
    .select("id, status, current_day, enrolled_at, completed_at, exit_reason, goal_achieved")
    .eq("workflow_id", workflowId);

  const allEnrollments = enrollments ?? [];

  // Enrollment funnel
  const funnel = {
    total: allEnrollments.length,
    active: allEnrollments.filter((e) => e.status === "active").length,
    paused: allEnrollments.filter((e) => e.status === "paused").length,
    completed: allEnrollments.filter((e) => e.status === "completed").length,
    exited: allEnrollments.filter((e) => e.status === "exited").length,
    goalAchieved: allEnrollments.filter((e) => e.goal_achieved).length,
  };

  // Day-by-day retention (how many enrollees reach each day)
  const maxDay = Math.max(...allEnrollments.map((e) => e.current_day ?? 0), 0);
  const dayRetention: { day: number; count: number; pct: number }[] = [];
  for (let d = 1; d <= Math.min(maxDay, 30); d++) {
    const count = allEnrollments.filter((e) => (e.current_day ?? 0) >= d || e.status === "completed").length;
    dayRetention.push({
      day: d,
      count,
      pct: funnel.total > 0 ? Math.round((count / funnel.total) * 100) : 0,
    });
  }

  // Per-step metrics (from step_logs)
  const enrollmentIds = allEnrollments.map((e) => e.id);

  let stepMetrics: {
    stepId: string;
    stepType: string;
    dayNumber: number;
    subject: string | null;
    totalExecuted: number;
    delivered: number;
    opened: number;
    clicked: number;
    responded: number;
    deliveryRate: number;
    openRate: number;
    responseRate: number;
  }[] = [];

  if (enrollmentIds.length > 0 && workflow.current_version_id) {
    // Get all steps for current version
    const { data: steps } = await supabase
      .from("workflow_steps")
      .select("id, step_type, day_number, subject")
      .eq("workflow_version_id", workflow.current_version_id)
      .order("day_number", { ascending: true })
      .order("step_number", { ascending: true });

    // Get all logs for these enrollments
    const { data: logs } = await supabase
      .from("workflow_step_logs")
      .select("step_id, delivered, opened, clicked, responded, executed_at")
      .in("enrollment_id", enrollmentIds)
      .not("executed_at", "is", null);

    const allLogs = logs ?? [];

    stepMetrics = (steps ?? []).map((step) => {
      const stepLogs = allLogs.filter((l) => l.step_id === step.id);
      const executed = stepLogs.length;
      const delivered = stepLogs.filter((l) => l.delivered).length;
      const opened = stepLogs.filter((l) => l.opened).length;
      const clicked = stepLogs.filter((l) => l.clicked).length;
      const responded = stepLogs.filter((l) => l.responded).length;

      return {
        stepId: step.id,
        stepType: step.step_type,
        dayNumber: step.day_number,
        subject: step.subject,
        totalExecuted: executed,
        delivered,
        opened,
        clicked,
        responded,
        deliveryRate: executed > 0 ? Math.round((delivered / executed) * 100) : 0,
        openRate: delivered > 0 ? Math.round((opened / delivered) * 100) : 0,
        responseRate: delivered > 0 ? Math.round((responded / delivered) * 100) : 0,
      };
    });
  }

  // Exit reasons breakdown
  const exitReasons = new Map<string, number>();
  for (const e of allEnrollments.filter((e) => e.status === "exited" || e.status === "completed")) {
    const reason = e.exit_reason ?? (e.status === "completed" ? "completed" : "unknown");
    exitReasons.set(reason, (exitReasons.get(reason) ?? 0) + 1);
  }

  return NextResponse.json({
    workflow: {
      id: workflow.id,
      name: workflow.name,
      status: workflow.status,
      healthScore: workflow.health_score,
    },
    funnel,
    dayRetention,
    stepMetrics,
    exitReasons: Array.from(exitReasons.entries()).map(([reason, count]) => ({ reason, count })),
  });
}
