/**
 * Workflow Health Scoring Algorithm
 *
 * Grades every workflow A–F based on how its steps perform against benchmarks.
 * Called by the daily Scout analysis cron and on-demand from the dashboard.
 *
 * Scoring logic (from workflows.md):
 *   A — Above benchmark on all primary metrics
 *   B — At benchmark, meeting expectations
 *   C — Average, some metrics below benchmark
 *   D — Underperforming, Scout flags for attention
 *   F — Broken, immediate attention needed
 *
 * Default benchmarks:
 *   Call booking rate: 30%+
 *   SMS response rate: 15%+
 *   Email open rate: 25%+
 *   Trainual nudge open rate: 40%+
 */

import { createServerClient } from "@/lib/supabase/server";
import type { WorkflowHealthScore, WorkflowStep } from "@/lib/workflows/types";

/** Benchmark thresholds — after 90 days of data, Scout recalibrates */
const DEFAULT_BENCHMARKS: Record<string, number> = {
  call_booking_rate: 30,
  sms_response_rate: 15,
  email_open_rate: 25,
  trainual_open_rate: 40,
};

/** Result of analyzing a single workflow */
export interface HealthAnalysis {
  workflowId: string;
  workflowName: string;
  score: WorkflowHealthScore;
  metrics: MetricResult[];
  topIssue: string | null;
  underperformingSteps: UnderperformingStep[];
}

/** Result of evaluating a single metric */
interface MetricResult {
  name: string;
  value: number;
  benchmark: number;
  status: "above" | "at" | "below" | "critical";
}

/** A step that is underperforming */
interface UnderperformingStep {
  stepId: string;
  stepNumber: number;
  dayNumber: number;
  stepType: string;
  metric: string;
  value: number;
  benchmark: number;
}

/**
 * Analyze all live workflows and update their health scores.
 * Returns the full analysis for each workflow.
 */
export async function analyzeAllWorkflows(): Promise<HealthAnalysis[]> {
  const supabase = createServerClient();

  const { data: workflows } = await supabase
    .from("workflows")
    .select("*")
    .in("status", ["live", "paused"]);

  if (!workflows || workflows.length === 0) return [];

  const analyses: HealthAnalysis[] = [];

  for (const workflow of workflows) {
    const analysis = await analyzeWorkflow(workflow.id, workflow.name);
    analyses.push(analysis);

    // Update the workflow's health score in the database
    if (analysis.score !== workflow.health_score) {
      await supabase
        .from("workflows")
        .update({
          health_score: analysis.score,
          updated_at: new Date().toISOString(),
        })
        .eq("id", workflow.id);
    }
  }

  return analyses;
}

/**
 * Analyze a single workflow's health.
 */
export async function analyzeWorkflow(
  workflowId: string,
  workflowName: string
): Promise<HealthAnalysis> {
  const supabase = createServerClient();

  // Get the current version's steps
  const { data: workflow } = await supabase
    .from("workflows")
    .select("current_version_id")
    .eq("id", workflowId)
    .single();

  if (!workflow?.current_version_id) {
    return {
      workflowId,
      workflowName,
      score: "C",
      metrics: [],
      topIssue: "No active version — workflow has no steps to analyze.",
      underperformingSteps: [],
    };
  }

  // Get all steps for the current version
  const { data: steps } = await supabase
    .from("workflow_steps")
    .select("*")
    .eq("workflow_version_id", workflow.current_version_id)
    .order("step_number", { ascending: true });

  if (!steps || steps.length === 0) {
    return {
      workflowId,
      workflowName,
      score: "C",
      metrics: [],
      topIssue: "No steps defined in the current version.",
      underperformingSteps: [],
    };
  }

  // Get step logs for metrics calculation
  const stepIds = steps.map((s) => s.id);
  const { data: logs } = await supabase
    .from("workflow_step_logs")
    .select("*")
    .in("step_id", stepIds);

  const stepLogs = logs ?? [];

  // Calculate metrics
  const metrics: MetricResult[] = [];
  const underperformingSteps: UnderperformingStep[] = [];

  // Email open rate
  const emailSteps = steps.filter((s) => (s as WorkflowStep).step_type === "email");
  if (emailSteps.length > 0) {
    const emailLogs = stepLogs.filter((l) => emailSteps.some((s) => s.id === l.step_id));
    const totalSent = emailLogs.filter((l) => l.executed_at).length;
    const totalOpened = emailLogs.filter((l) => l.opened).length;
    const openRate = totalSent > 0 ? (totalOpened / totalSent) * 100 : 0;

    metrics.push({
      name: "Email open rate",
      value: Math.round(openRate * 10) / 10,
      benchmark: DEFAULT_BENCHMARKS.email_open_rate,
      status: getMetricStatus(openRate, DEFAULT_BENCHMARKS.email_open_rate),
    });

    // Find underperforming email steps
    for (const step of emailSteps as WorkflowStep[]) {
      const rate = step.open_rate ?? 0;
      if (rate > 0 && rate < DEFAULT_BENCHMARKS.email_open_rate) {
        underperformingSteps.push({
          stepId: step.id,
          stepNumber: step.step_number,
          dayNumber: step.day_number,
          stepType: step.step_type,
          metric: "open_rate",
          value: rate,
          benchmark: DEFAULT_BENCHMARKS.email_open_rate,
        });
      }
    }
  }

  // SMS response rate
  const smsSteps = steps.filter((s) => (s as WorkflowStep).step_type === "sms");
  if (smsSteps.length > 0) {
    const smsLogs = stepLogs.filter((l) => smsSteps.some((s) => s.id === l.step_id));
    const totalSent = smsLogs.filter((l) => l.executed_at).length;
    const totalResponded = smsLogs.filter((l) => l.responded).length;
    const responseRate = totalSent > 0 ? (totalResponded / totalSent) * 100 : 0;

    metrics.push({
      name: "SMS response rate",
      value: Math.round(responseRate * 10) / 10,
      benchmark: DEFAULT_BENCHMARKS.sms_response_rate,
      status: getMetricStatus(responseRate, DEFAULT_BENCHMARKS.sms_response_rate),
    });

    // Find underperforming SMS steps
    for (const step of smsSteps as WorkflowStep[]) {
      const rate = step.response_rate ?? 0;
      if (rate > 0 && rate < DEFAULT_BENCHMARKS.sms_response_rate) {
        underperformingSteps.push({
          stepId: step.id,
          stepNumber: step.step_number,
          dayNumber: step.day_number,
          stepType: step.step_type,
          metric: "response_rate",
          value: rate,
          benchmark: DEFAULT_BENCHMARKS.sms_response_rate,
        });
      }
    }
  }

  // Overall enrollment goal achievement rate
  const { data: enrollments } = await supabase
    .from("workflow_enrollments")
    .select("goal_achieved, status")
    .eq("workflow_id", workflowId)
    .in("status", ["completed", "exited", "expired"]);

  if (enrollments && enrollments.length >= 5) {
    const completedWithGoal = enrollments.filter((e) => e.goal_achieved).length;
    const goalRate = (completedWithGoal / enrollments.length) * 100;

    metrics.push({
      name: "Goal achievement rate",
      value: Math.round(goalRate * 10) / 10,
      benchmark: DEFAULT_BENCHMARKS.call_booking_rate,
      status: getMetricStatus(goalRate, DEFAULT_BENCHMARKS.call_booking_rate),
    });
  }

  // Calculate overall health score
  const score = calculateOverallScore(metrics);

  // Generate top issue in plain language
  const topIssue = generateTopIssue(metrics, underperformingSteps, workflowName);

  return {
    workflowId,
    workflowName,
    score,
    metrics,
    topIssue,
    underperformingSteps,
  };
}

/** Determine status of a single metric vs benchmark */
function getMetricStatus(value: number, benchmark: number): "above" | "at" | "below" | "critical" {
  if (value >= benchmark * 1.1) return "above";
  if (value >= benchmark * 0.9) return "at";
  if (value >= benchmark * 0.5) return "below";
  return "critical";
}

/** Calculate the overall A–F score from individual metrics */
function calculateOverallScore(metrics: MetricResult[]): WorkflowHealthScore {
  if (metrics.length === 0) return "C"; // No data yet

  const criticalCount = metrics.filter((m) => m.status === "critical").length;
  const belowCount = metrics.filter((m) => m.status === "below").length;
  const aboveCount = metrics.filter((m) => m.status === "above").length;

  if (criticalCount >= 2 || (criticalCount >= 1 && belowCount >= 1)) return "F";
  if (criticalCount >= 1) return "D";
  if (belowCount >= 2) return "D";
  if (belowCount >= 1) return "C";
  if (aboveCount === metrics.length) return "A";
  return "B";
}

/** Generate plain-language description of the top issue */
function generateTopIssue(
  metrics: MetricResult[],
  underperformingSteps: UnderperformingStep[],
  workflowName: string
): string | null {
  // Find the worst metric
  const worstMetric = metrics
    .filter((m) => m.status === "critical" || m.status === "below")
    .sort((a, b) => {
      const aPct = a.value / a.benchmark;
      const bPct = b.value / b.benchmark;
      return aPct - bPct;
    })[0];

  if (!worstMetric) return null;

  // Find the worst step for context
  const worstStep = underperformingSteps.sort((a, b) => {
    const aPct = a.value / a.benchmark;
    const bPct = b.value / b.benchmark;
    return aPct - bPct;
  })[0];

  let issue = `${workflowName}'s ${worstMetric.name.toLowerCase()} is at ${worstMetric.value}% (benchmark: ${worstMetric.benchmark}%).`;

  if (worstStep) {
    issue += ` The Day ${worstStep.dayNumber} ${worstStep.stepType.toUpperCase()} (step ${worstStep.stepNumber}) is the weakest point at ${worstStep.value}%.`;
  }

  if (worstMetric.status === "critical") {
    issue += " This needs immediate attention.";
  } else {
    issue += " Scout has drafted rewrite suggestions.";
  }

  return issue;
}
