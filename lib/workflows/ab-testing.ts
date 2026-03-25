/**
 * A/B Testing Service
 *
 * Manages the lifecycle of A/B tests for workflow steps and full workflows:
 * create, start, record results, check for winners, declare winners, and assign variants.
 *
 * All database writes go through Supabase.
 */

import { createServerClient } from "@/lib/supabase/server";
import type {
  WorkflowABTest,
  WorkflowABTestInsert,
  ABTestStatus,
  ABTestWinner,
  ABTestType,
} from "@/lib/workflows/types";

/** Result of an A/B test operation */
export interface ABTestResult {
  success: boolean;
  test?: WorkflowABTest;
  error?: string;
}

/** Result of checking for a winner */
export interface WinnerCheckResult {
  hasWinner: boolean;
  winner?: ABTestWinner;
  explanation?: string;
}

/** Parameters for creating an A/B test */
export interface CreateABTestParams {
  workflowId: string;
  testType: ABTestType;
  variantAStepId?: string;
  variantBStepId?: string;
  variantAVersionId?: string;
  variantBVersionId?: string;
  minSampleSize: number;
  createdBy: string;
}

/**
 * Create a new A/B test for a workflow step or full workflow.
 * Status starts as 'draft' — requires approval before it can run.
 */
export async function createABTest(params: CreateABTestParams): Promise<ABTestResult> {
  const supabase = createServerClient();

  // Validate: step tests need step IDs, full workflow tests need version IDs
  if (params.testType === "step") {
    if (!params.variantAStepId || !params.variantBStepId) {
      return {
        success: false,
        error: "Step-level tests require both variantAStepId and variantBStepId",
      };
    }
  } else if (params.testType === "full_workflow") {
    if (!params.variantAVersionId || !params.variantBVersionId) {
      return {
        success: false,
        error: "Full workflow tests require both variantAVersionId and variantBVersionId",
      };
    }
  }

  if (params.minSampleSize < 1) {
    return { success: false, error: "minSampleSize must be at least 1" };
  }

  // Verify the workflow exists
  const { data: workflow, error: wfErr } = await supabase
    .from("workflows")
    .select("id")
    .eq("id", params.workflowId)
    .single();

  if (wfErr || !workflow) {
    return { success: false, error: "Workflow not found" };
  }

  const insert: WorkflowABTestInsert = {
    workflow_id: params.workflowId,
    test_type: params.testType,
    variant_a_step_id: params.variantAStepId ?? null,
    variant_b_step_id: params.variantBStepId ?? null,
    variant_a_version_id: params.variantAVersionId ?? null,
    variant_b_version_id: params.variantBVersionId ?? null,
    min_sample_size: params.minSampleSize,
    variant_a_metric: null,
    variant_b_metric: null,
    winner: null,
    winner_explanation: null,
    status: "draft" as ABTestStatus,
    created_by: params.createdBy,
    declared_by: null,
    completed_at: null,
  };

  const { data: test, error } = await supabase
    .from("workflow_ab_tests")
    .insert(insert)
    .select()
    .single();

  if (error || !test) {
    return { success: false, error: error?.message ?? "Failed to create A/B test" };
  }

  return { success: true, test: test as WorkflowABTest };
}

/**
 * Start a test — changes status from 'draft' to 'running'.
 * Requires an approver to be specified.
 */
export async function startTest(testId: string, approvedBy: string): Promise<ABTestResult> {
  const supabase = createServerClient();

  const { data: test, error: fetchErr } = await supabase
    .from("workflow_ab_tests")
    .select("*")
    .eq("id", testId)
    .single();

  if (fetchErr || !test) {
    return { success: false, error: "A/B test not found" };
  }

  const currentStatus = test.status as ABTestStatus;
  if (currentStatus !== "draft" && currentStatus !== "pending_approval") {
    return {
      success: false,
      error: `Cannot start — test is ${currentStatus}`,
    };
  }

  const { data: updated, error } = await supabase
    .from("workflow_ab_tests")
    .update({
      status: "running" as ABTestStatus,
      declared_by: approvedBy,
    })
    .eq("id", testId)
    .select()
    .single();

  if (error || !updated) {
    return { success: false, error: error?.message ?? "Failed to start test" };
  }

  return { success: true, test: updated as WorkflowABTest };
}

/**
 * Record a result for a variant.
 * Increments the count for the variant and recalculates its success rate metric.
 *
 * The metric is stored as a percentage: (successes / total) * 100
 * We track successes by deriving them from the current metric and count,
 * then incrementing appropriately.
 */
export async function recordResult(
  testId: string,
  variant: ABTestWinner,
  success: boolean
): Promise<ABTestResult> {
  const supabase = createServerClient();

  const { data: test, error: fetchErr } = await supabase
    .from("workflow_ab_tests")
    .select("*")
    .eq("id", testId)
    .single();

  if (fetchErr || !test) {
    return { success: false, error: "A/B test not found" };
  }

  if ((test.status as ABTestStatus) !== "running") {
    return { success: false, error: `Cannot record result — test is ${test.status}` };
  }

  const countField = variant === "A" ? "variant_a_count" : "variant_b_count";
  const metricField = variant === "A" ? "variant_a_metric" : "variant_b_metric";

  const currentCount = (test[countField] as number) ?? 0;
  const currentMetric = (test[metricField] as number | null) ?? 0;

  // Derive current successes from metric and count
  const currentSuccesses = currentCount > 0 ? Math.round((currentMetric / 100) * currentCount) : 0;
  const newCount = currentCount + 1;
  const newSuccesses = success ? currentSuccesses + 1 : currentSuccesses;
  const newMetric = (newSuccesses / newCount) * 100;

  const updates: Record<string, unknown> = {};
  updates[countField] = newCount;
  updates[metricField] = Math.round(newMetric * 100) / 100; // Round to 2 decimals

  const { data: updated, error } = await supabase
    .from("workflow_ab_tests")
    .update(updates)
    .eq("id", testId)
    .select()
    .single();

  if (error || !updated) {
    return { success: false, error: error?.message ?? "Failed to record result" };
  }

  return { success: true, test: updated as WorkflowABTest };
}

/**
 * Check if a test has reached minimum sample size and if there's a
 * statistically meaningful winner.
 *
 * Uses a simple approach: both variants must have at least minSampleSize
 * results, and the winner must lead by at least 5 percentage points.
 */
export async function checkForWinner(testId: string): Promise<WinnerCheckResult> {
  const supabase = createServerClient();

  const { data: test, error } = await supabase
    .from("workflow_ab_tests")
    .select("*")
    .eq("id", testId)
    .single();

  if (error || !test) {
    return { hasWinner: false, explanation: "A/B test not found" };
  }

  if ((test.status as ABTestStatus) !== "running") {
    return { hasWinner: false, explanation: `Test is not running (status: ${test.status})` };
  }

  const aCount = (test.variant_a_count as number) ?? 0;
  const bCount = (test.variant_b_count as number) ?? 0;
  const minSample = (test.min_sample_size as number) ?? 1;

  // Both variants need minimum sample size
  if (aCount < minSample || bCount < minSample) {
    const aNeeded = Math.max(0, minSample - aCount);
    const bNeeded = Math.max(0, minSample - bCount);
    return {
      hasWinner: false,
      explanation: `Sample size not yet reached. Variant A needs ${aNeeded} more, Variant B needs ${bNeeded} more.`,
    };
  }

  const aMetric = (test.variant_a_metric as number | null) ?? 0;
  const bMetric = (test.variant_b_metric as number | null) ?? 0;
  const diff = Math.abs(aMetric - bMetric);

  // Require at least 5 percentage points difference for a meaningful winner
  const MIN_DIFF = 5;

  if (diff < MIN_DIFF) {
    return {
      hasWinner: false,
      explanation: `Both variants are performing similarly. Variant A: ${aMetric.toFixed(1)}%, Variant B: ${bMetric.toFixed(1)}%. Difference of ${diff.toFixed(1)}pp is below the ${MIN_DIFF}pp threshold.`,
    };
  }

  const winner: ABTestWinner = aMetric > bMetric ? "A" : "B";
  const winnerMetric = winner === "A" ? aMetric : bMetric;
  const loserMetric = winner === "A" ? bMetric : aMetric;

  return {
    hasWinner: true,
    winner,
    explanation: `Variant ${winner} is the winner with a ${winnerMetric.toFixed(1)}% success rate vs ${loserMetric.toFixed(1)}% (${diff.toFixed(1)}pp difference, ${aCount + bCount} total samples).`,
  };
}

/**
 * Manually declare a winner for a test.
 * Updates the test status to 'complete'.
 */
export async function declareWinner(
  testId: string,
  winner: ABTestWinner,
  declaredBy: string
): Promise<ABTestResult> {
  const supabase = createServerClient();

  const { data: test, error: fetchErr } = await supabase
    .from("workflow_ab_tests")
    .select("*")
    .eq("id", testId)
    .single();

  if (fetchErr || !test) {
    return { success: false, error: "A/B test not found" };
  }

  const currentStatus = test.status as ABTestStatus;
  if (currentStatus !== "running") {
    return { success: false, error: `Cannot declare winner — test is ${currentStatus}` };
  }

  const aMetric = (test.variant_a_metric as number | null) ?? 0;
  const bMetric = (test.variant_b_metric as number | null) ?? 0;
  const aCount = (test.variant_a_count as number) ?? 0;
  const bCount = (test.variant_b_count as number) ?? 0;
  const winnerMetric = winner === "A" ? aMetric : bMetric;
  const loserMetric = winner === "A" ? bMetric : aMetric;

  const explanation = `Variant ${winner} declared winner by ${declaredBy}. Variant A: ${aMetric.toFixed(1)}% (${aCount} samples), Variant B: ${bMetric.toFixed(1)}% (${bCount} samples). Winner rate: ${winnerMetric.toFixed(1)}% vs ${loserMetric.toFixed(1)}%.`;

  const { data: updated, error } = await supabase
    .from("workflow_ab_tests")
    .update({
      winner,
      winner_explanation: explanation,
      declared_by: declaredBy,
      status: "complete" as ABTestStatus,
      completed_at: new Date().toISOString(),
    })
    .eq("id", testId)
    .select()
    .single();

  if (error || !updated) {
    return { success: false, error: error?.message ?? "Failed to declare winner" };
  }

  return { success: true, test: updated as WorkflowABTest };
}

/**
 * Get all A/B tests for a workflow.
 * Returns tests ordered by creation date (newest first).
 */
export async function getTestsForWorkflow(workflowId: string): Promise<WorkflowABTest[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("workflow_ab_tests")
    .select("*")
    .eq("workflow_id", workflowId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch A/B tests for workflow:", error.message);
    return [];
  }

  return (data ?? []) as WorkflowABTest[];
}

/**
 * Get a single A/B test by ID.
 */
export async function getTest(testId: string): Promise<WorkflowABTest | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("workflow_ab_tests")
    .select("*")
    .eq("id", testId)
    .single();

  if (error || !data) return null;
  return data as WorkflowABTest;
}

/**
 * Assign a variant ('A' or 'B') to a new enrollee.
 * Uses a 50/50 split based on current counts — assigns to the variant with fewer enrollees.
 * If counts are equal, assigns to 'A'.
 */
export async function assignVariant(testId: string): Promise<ABTestWinner | null> {
  const supabase = createServerClient();

  const { data: test, error } = await supabase
    .from("workflow_ab_tests")
    .select("variant_a_count, variant_b_count, status")
    .eq("id", testId)
    .single();

  if (error || !test) return null;

  if ((test.status as ABTestStatus) !== "running") return null;

  const aCount = (test.variant_a_count as number) ?? 0;
  const bCount = (test.variant_b_count as number) ?? 0;

  // Assign to whichever variant has fewer enrollees (tie goes to A)
  return bCount < aCount ? "B" : "A";
}
