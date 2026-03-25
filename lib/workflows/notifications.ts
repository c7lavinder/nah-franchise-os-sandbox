/**
 * Workflow Notification Engine
 *
 * Creates inactivity_alerts for:
 * 1. Steps pending human confirmation
 * 2. Workflows with unhealthy scores (D or F)
 * 3. Stale enrollments with no recent step execution
 */

import { createServerClient } from "@/lib/supabase/server";

interface NotificationResult {
  alertsCreated: number;
  errors: number;
}

// ─────────────────────────────────────────────────────────────
// 1. Steps Pending Confirmation
// ─────────────────────────────────────────────────────────────

/**
 * Finds workflow_step_logs that are queued (delivery_data contains
 * { queued: true }) and not yet confirmed. Creates an alert for each
 * so the team knows action is needed.
 */
export async function notifyStepsPendingConfirmation(): Promise<NotificationResult> {
  const supabase = createServerClient();
  let alertsCreated = 0;
  let errors = 0;

  // Find step logs that are queued but not yet confirmed
  const { data: pendingLogs, error: fetchErr } = await supabase
    .from("workflow_step_logs")
    .select(`
      id,
      step_type,
      ghl_contact_id,
      delivery_data,
      enrollment_id
    `)
    .is("confirmed_at", null)
    .not("delivery_data", "is", null);

  if (fetchErr) {
    console.error("Failed to fetch pending step logs:", fetchErr);
    return { alertsCreated: 0, errors: 1 };
  }

  // Filter in code: only those with queued: true in delivery_data
  const queuedLogs = (pendingLogs ?? []).filter((log) => {
    const data = log.delivery_data as Record<string, unknown> | null;
    return data?.queued === true;
  });

  if (queuedLogs.length === 0) {
    return { alertsCreated: 0, errors: 0 };
  }

  // Gather enrollment IDs to fetch contact names and workflow names
  const enrollmentIds = [...new Set(queuedLogs.map((l) => l.enrollment_id))];
  const { data: enrollments } = await supabase
    .from("workflow_enrollments")
    .select("id, contact_name, workflow_id")
    .in("id", enrollmentIds);

  const enrollmentMap = new Map(
    (enrollments ?? []).map((e) => [e.id, e])
  );

  // Fetch workflow names
  const workflowIds = [...new Set((enrollments ?? []).map((e) => e.workflow_id))];
  const { data: workflows } = await supabase
    .from("workflows")
    .select("id, name")
    .in("id", workflowIds.length > 0 ? workflowIds : ["__none__"]);

  const workflowMap = new Map(
    (workflows ?? []).map((w) => [w.id, w.name as string])
  );

  // Check for existing open alerts to avoid duplicates
  const logIds = queuedLogs.map((l) => l.id as string);
  const { data: existingAlerts } = await supabase
    .from("inactivity_alerts")
    .select("details")
    .eq("alert_type", "workflow_confirmation_needed")
    .eq("is_resolved", false);

  const existingLogIds = new Set(
    (existingAlerts ?? []).map((a) => {
      const details = a.details as Record<string, unknown> | null;
      return details?.stepLogId as string | undefined;
    }).filter(Boolean)
  );

  for (const log of queuedLogs) {
    const logId = log.id as string;
    if (existingLogIds.has(logId)) continue;

    const enrollment = enrollmentMap.get(log.enrollment_id as string);
    const contactName = (enrollment?.contact_name as string) || "Unknown contact";
    const workflowName = enrollment
      ? workflowMap.get(enrollment.workflow_id as string) || "Unknown workflow"
      : "Unknown workflow";

    try {
      await supabase.from("inactivity_alerts").insert({
        alert_type: "workflow_confirmation_needed",
        severity: "medium",
        ghl_contact_id: log.ghl_contact_id,
        message: `Workflow step pending: ${log.step_type} for ${contactName} in ${workflowName}`,
        details: {
          stepLogId: logId,
          stepType: log.step_type,
          contactName,
          workflowName,
          enrollmentId: log.enrollment_id,
        },
      });
      alertsCreated++;
    } catch {
      errors++;
    }
  }

  return { alertsCreated, errors };
}

// ─────────────────────────────────────────────────────────────
// 2. Unhealthy Workflows
// ─────────────────────────────────────────────────────────────

/**
 * Finds live workflows with health_score D or F and creates alerts
 * so leadership and reps are aware of degraded performance.
 */
export async function notifyUnhealthyWorkflows(): Promise<NotificationResult> {
  const supabase = createServerClient();
  let alertsCreated = 0;
  let errors = 0;

  const { data: unhealthyWorkflows, error: fetchErr } = await supabase
    .from("workflows")
    .select("id, name, health_score")
    .eq("status", "live")
    .in("health_score", ["D", "F"]);

  if (fetchErr) {
    console.error("Failed to fetch unhealthy workflows:", fetchErr);
    return { alertsCreated: 0, errors: 1 };
  }

  if (!unhealthyWorkflows || unhealthyWorkflows.length === 0) {
    return { alertsCreated: 0, errors: 0 };
  }

  // Check for existing open alerts to avoid duplicates
  const { data: existingAlerts } = await supabase
    .from("inactivity_alerts")
    .select("details")
    .eq("alert_type", "workflow_health")
    .eq("is_resolved", false);

  const existingWorkflowIds = new Set(
    (existingAlerts ?? []).map((a) => {
      const details = a.details as Record<string, unknown> | null;
      return details?.workflowId as string | undefined;
    }).filter(Boolean)
  );

  for (const wf of unhealthyWorkflows) {
    const workflowId = wf.id as string;
    if (existingWorkflowIds.has(workflowId)) continue;

    const score = wf.health_score as string;
    const severity = score === "F" ? "critical" : "high";
    const name = wf.name as string;

    // Fetch top issue from health analysis if available
    // We do a lightweight query; the full analysis is in the health-scoring module
    let topIssue = "review recommended";
    try {
      // Check if there's recent analysis data stored
      // For now, use a generic message based on score
      topIssue =
        score === "F"
          ? "critical performance issues detected"
          : "performance below acceptable threshold";
    } catch {
      // Use default message
    }

    try {
      await supabase.from("inactivity_alerts").insert({
        alert_type: "workflow_health",
        severity,
        message: `${name} health is ${score} — ${topIssue}`,
        details: {
          workflowId,
          workflowName: name,
          healthScore: score,
          topIssue,
        },
      });
      alertsCreated++;
    } catch {
      errors++;
    }
  }

  return { alertsCreated, errors };
}

// ─────────────────────────────────────────────────────────────
// 3. Stale Enrollments
// ─────────────────────────────────────────────────────────────

/**
 * Finds active enrollments where last_step_at is older than
 * maxDaysInactive days, indicating the enrollment may be stuck.
 */
export async function notifyStaleEnrollments(
  maxDaysInactive: number
): Promise<NotificationResult> {
  const supabase = createServerClient();
  let alertsCreated = 0;
  let errors = 0;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - maxDaysInactive);
  const cutoffISO = cutoff.toISOString();

  const { data: staleEnrollments, error: fetchErr } = await supabase
    .from("workflow_enrollments")
    .select("id, workflow_id, ghl_contact_id, contact_name, last_step_at")
    .eq("status", "active")
    .lt("last_step_at", cutoffISO);

  if (fetchErr) {
    console.error("Failed to fetch stale enrollments:", fetchErr);
    return { alertsCreated: 0, errors: 1 };
  }

  if (!staleEnrollments || staleEnrollments.length === 0) {
    return { alertsCreated: 0, errors: 0 };
  }

  // Fetch workflow names
  const workflowIds = [...new Set(staleEnrollments.map((e) => e.workflow_id as string))];
  const { data: workflows } = await supabase
    .from("workflows")
    .select("id, name")
    .in("id", workflowIds);

  const workflowMap = new Map(
    (workflows ?? []).map((w) => [w.id as string, w.name as string])
  );

  // Check for existing open alerts to avoid duplicates
  const { data: existingAlerts } = await supabase
    .from("inactivity_alerts")
    .select("details")
    .eq("alert_type", "workflow_stale_enrollment")
    .eq("is_resolved", false);

  const existingEnrollmentIds = new Set(
    (existingAlerts ?? []).map((a) => {
      const details = a.details as Record<string, unknown> | null;
      return details?.enrollmentId as string | undefined;
    }).filter(Boolean)
  );

  for (const enrollment of staleEnrollments) {
    const enrollmentId = enrollment.id as string;
    if (existingEnrollmentIds.has(enrollmentId)) continue;

    const contactName = (enrollment.contact_name as string) || "Unknown contact";
    const workflowName = workflowMap.get(enrollment.workflow_id as string) || "Unknown workflow";
    const lastStepAt = enrollment.last_step_at as string;
    const daysSince = Math.floor(
      (Date.now() - new Date(lastStepAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    try {
      await supabase.from("inactivity_alerts").insert({
        alert_type: "workflow_stale_enrollment",
        severity: "medium",
        ghl_contact_id: enrollment.ghl_contact_id,
        message: `${contactName} in "${workflowName}" — no step executed in ${daysSince} days`,
        details: {
          enrollmentId,
          workflowId: enrollment.workflow_id,
          workflowName,
          contactName,
          lastStepAt,
          daysSinceLastStep: daysSince,
        },
      });
      alertsCreated++;
    } catch {
      errors++;
    }
  }

  return { alertsCreated, errors };
}
