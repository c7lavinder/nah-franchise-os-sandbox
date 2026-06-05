import { createServerClient } from "@/lib/supabase/server";
import { analyzeAllWorkflows } from "@/lib/workflows/health-scoring";

type WorkflowFinding = {
  severity: "info" | "warning" | "critical";
  message: string;
};

function sevenDaysAgo() {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  return date.toISOString();
}

export async function runWorkflowQa() {
  const supabase = createServerClient();
  const since = sevenDaysAgo();

  const [analyses, workflowsRes, activeEnrollmentsRes, pendingApprovalsRes, queuedStepsRes, failedLogsRes] =
    await Promise.all([
      analyzeAllWorkflows(),
      supabase.from("workflows").select("id, name, status, health_score").limit(1000),
      supabase.from("workflow_enrollments").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("workflow_approvals").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase
        .from("workflow_step_logs")
        .select("id", { count: "exact", head: true })
        .is("confirmed_at", null)
        .not("delivery_data->>queued", "is", null),
      supabase
        .from("workflow_step_logs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since)
        .not("delivery_data->>error", "is", null),
    ]);

  if (workflowsRes.error) throw workflowsRes.error;
  if (activeEnrollmentsRes.error) throw activeEnrollmentsRes.error;
  if (pendingApprovalsRes.error) throw pendingApprovalsRes.error;
  if (queuedStepsRes.error) throw queuedStepsRes.error;
  if (failedLogsRes.error) throw failedLogsRes.error;

  const workflows = workflowsRes.data ?? [];
  const findings: WorkflowFinding[] = [];
  const brokenAnalyses = analyses.filter((analysis) => analysis.score === "D" || analysis.score === "F");
  const pendingApprovalCount = pendingApprovalsRes.count ?? 0;
  const queuedStepCount = queuedStepsRes.count ?? 0;
  const failedLogCount = failedLogsRes.count ?? 0;

  if (brokenAnalyses.length > 0) {
    findings.push({
      severity: "critical",
      message: `${brokenAnalyses.length} live/paused workflows scored D/F: ${brokenAnalyses
        .slice(0, 5)
        .map((analysis) => analysis.workflowName)
        .join(", ")}.`,
    });
  }
  if (pendingApprovalCount > 0) {
    findings.push({ severity: "warning", message: `${pendingApprovalCount} workflow approvals are pending.` });
  }
  if (queuedStepCount > 0) {
    findings.push({ severity: "warning", message: `${queuedStepCount} customer-facing steps are queued for review.` });
  }
  if (failedLogCount > 0) {
    findings.push({ severity: "critical", message: `${failedLogCount} workflow step logs have delivery errors in 7 days.` });
  }

  const summary = {
    workflows: workflows.length,
    live: workflows.filter((workflow) => workflow.status === "live").length,
    paused: workflows.filter((workflow) => workflow.status === "paused").length,
    pendingApproval: workflows.filter((workflow) => workflow.status === "pending_approval").length,
    activeEnrollments: activeEnrollmentsRes.count ?? 0,
    pendingApprovals: pendingApprovalCount,
    queuedCustomerSteps: queuedStepCount,
    deliveryErrors7d: failedLogCount,
    healthScores: {
      A: analyses.filter((analysis) => analysis.score === "A").length,
      B: analyses.filter((analysis) => analysis.score === "B").length,
      C: analyses.filter((analysis) => analysis.score === "C").length,
      D: analyses.filter((analysis) => analysis.score === "D").length,
      F: analyses.filter((analysis) => analysis.score === "F").length,
    },
    findings,
  };

  await supabase.from("integration_logs").insert({
    integration_name: "workflow-qa",
    event_type: "workflow_qa_audit",
    status: "success",
    payload_summary: `${summary.workflows} workflows checked; ${findings.length} findings; ${summary.pendingApprovals} approvals pending.`,
  });

  return { success: true, summary };
}
