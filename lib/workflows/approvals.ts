/**
 * Workflow Approval Service
 *
 * Manages the approval queue for workflow lifecycle changes:
 * publish, pause, archive, A/B test start, A/B test winner, and rollback.
 *
 * All actions follow the Draft -> Review -> Confirm pattern.
 * No workflow state change happens without admin approval.
 */

import { createServerClient } from "@/lib/supabase/server";
import type {
  WorkflowApproval,
  WorkflowApprovalInsert,
  ApprovalType,
  ApprovalStatus,
  WorkflowStatus,
  ABTestStatus,
} from "@/lib/workflows/types";

/** Result of an approval operation */
export interface ApprovalResult {
  success: boolean;
  approval?: WorkflowApproval;
  error?: string;
}

/**
 * Submit a workflow change for approval.
 * Creates a pending approval record in the queue.
 */
export async function submitForApproval(params: {
  workflowId: string;
  workflowVersionId?: string;
  abTestId?: string;
  approvalType: ApprovalType;
  submittedBy: string;
  notes?: string;
}): Promise<ApprovalResult> {
  const supabase = createServerClient();

  // Verify the workflow exists
  const { data: workflow, error: wfErr } = await supabase
    .from("workflows")
    .select("id")
    .eq("id", params.workflowId)
    .single();

  if (wfErr || !workflow) {
    return { success: false, error: "Workflow not found" };
  }

  // Check for existing pending approval of the same type for this workflow
  const { data: existing } = await supabase
    .from("workflow_approvals")
    .select("id")
    .eq("workflow_id", params.workflowId)
    .eq("approval_type", params.approvalType)
    .eq("status", "pending" as ApprovalStatus)
    .limit(1)
    .single();

  if (existing) {
    return {
      success: false,
      error: `A pending ${params.approvalType} approval already exists for this workflow`,
    };
  }

  const insert: WorkflowApprovalInsert = {
    workflow_id: params.workflowId,
    workflow_version_id: params.workflowVersionId ?? null,
    ab_test_id: params.abTestId ?? null,
    approval_type: params.approvalType,
    submitted_by: params.submittedBy,
    approved_by: null,
    status: "pending",
    notes: params.notes ?? null,
    resolved_at: null,
  };

  const { data: approval, error } = await supabase
    .from("workflow_approvals")
    .insert(insert)
    .select()
    .single();

  if (error || !approval) {
    return { success: false, error: error?.message ?? "Failed to create approval request" };
  }

  return { success: true, approval: approval as WorkflowApproval };
}

/**
 * Approve a pending request.
 * Updates the approval status and executes the corresponding action:
 * - publish: set workflow status to 'live'
 * - pause: set workflow status to 'paused'
 * - archive: set workflow status to 'archived'
 * - ab_test_start: set AB test status to 'running'
 * - ab_test_winner: record the winner on the AB test
 * - rollback: revert workflow to previous version
 */
export async function approveRequest(
  approvalId: string,
  approvedBy: string
): Promise<ApprovalResult> {
  const supabase = createServerClient();

  // Fetch the approval
  const { data: approval, error: fetchErr } = await supabase
    .from("workflow_approvals")
    .select("*")
    .eq("id", approvalId)
    .single();

  if (fetchErr || !approval) {
    return { success: false, error: "Approval request not found" };
  }

  if ((approval.status as ApprovalStatus) !== "pending") {
    return { success: false, error: `Cannot approve — request is already ${approval.status}` };
  }

  // Update the approval record
  const { data: updated, error: updateErr } = await supabase
    .from("workflow_approvals")
    .update({
      status: "approved" as ApprovalStatus,
      approved_by: approvedBy,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", approvalId)
    .select()
    .single();

  if (updateErr || !updated) {
    return { success: false, error: updateErr?.message ?? "Failed to approve request" };
  }

  // Execute the action based on approval type
  const actionResult = await executeApprovalAction(updated as WorkflowApproval);
  if (!actionResult.success) {
    // Rollback approval status if action fails
    await supabase
      .from("workflow_approvals")
      .update({
        status: "pending" as ApprovalStatus,
        approved_by: null,
        resolved_at: null,
      })
      .eq("id", approvalId);

    return { success: false, error: actionResult.error };
  }

  return { success: true, approval: updated as WorkflowApproval };
}

/**
 * Reject a pending approval request.
 * Updates status to 'rejected' with optional notes.
 */
export async function rejectRequest(
  approvalId: string,
  approvedBy: string,
  notes?: string
): Promise<ApprovalResult> {
  const supabase = createServerClient();

  // Fetch the approval
  const { data: approval, error: fetchErr } = await supabase
    .from("workflow_approvals")
    .select("*")
    .eq("id", approvalId)
    .single();

  if (fetchErr || !approval) {
    return { success: false, error: "Approval request not found" };
  }

  if ((approval.status as ApprovalStatus) !== "pending") {
    return { success: false, error: `Cannot reject — request is already ${approval.status}` };
  }

  const updatePayload: Record<string, unknown> = {
    status: "rejected" as ApprovalStatus,
    approved_by: approvedBy,
    resolved_at: new Date().toISOString(),
  };

  // Append rejection notes if provided
  if (notes !== undefined) {
    const existingNotes = (approval.notes as string) ?? "";
    updatePayload.notes = existingNotes
      ? `${existingNotes}\n---\nRejection reason: ${notes}`
      : `Rejection reason: ${notes}`;
  }

  const { data: updated, error } = await supabase
    .from("workflow_approvals")
    .update(updatePayload)
    .eq("id", approvalId)
    .select()
    .single();

  if (error || !updated) {
    return { success: false, error: error?.message ?? "Failed to reject request" };
  }

  return { success: true, approval: updated as WorkflowApproval };
}

/**
 * List all pending approval requests across all workflows.
 * Ordered by submitted_at ascending (oldest first).
 */
export async function getPendingApprovals(): Promise<WorkflowApproval[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("workflow_approvals")
    .select("*")
    .eq("status", "pending" as ApprovalStatus)
    .order("submitted_at", { ascending: true });

  if (error) {
    console.error("Failed to fetch pending approvals:", error.message);
    return [];
  }

  return (data ?? []) as WorkflowApproval[];
}

/**
 * List all approvals for a specific workflow.
 * Ordered by submitted_at descending (newest first).
 */
export async function getApprovalsForWorkflow(workflowId: string): Promise<WorkflowApproval[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("workflow_approvals")
    .select("*")
    .eq("workflow_id", workflowId)
    .order("submitted_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch workflow approvals:", error.message);
    return [];
  }

  return (data ?? []) as WorkflowApproval[];
}

/**
 * Get a single approval by ID.
 */
export async function getApproval(approvalId: string): Promise<WorkflowApproval | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("workflow_approvals")
    .select("*")
    .eq("id", approvalId)
    .single();

  if (error || !data) return null;
  return data as WorkflowApproval;
}

// ════════════════════════════════════════════
// Internal: Execute the approved action
// ════════════════════════════════════════════

interface ActionResult {
  success: boolean;
  error?: string;
}

/**
 * Execute the workflow/AB test state change that corresponds to the approval type.
 */
async function executeApprovalAction(approval: WorkflowApproval): Promise<ActionResult> {
  const supabase = createServerClient();

  switch (approval.approval_type) {
    case "publish": {
      const { error } = await supabase
        .from("workflows")
        .update({
          status: "live" as WorkflowStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", approval.workflow_id);

      if (error) return { success: false, error: `Failed to publish workflow: ${error.message}` };
      return { success: true };
    }

    case "pause": {
      const { error } = await supabase
        .from("workflows")
        .update({
          status: "paused" as WorkflowStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", approval.workflow_id);

      if (error) return { success: false, error: `Failed to pause workflow: ${error.message}` };
      return { success: true };
    }

    case "archive": {
      const { error } = await supabase
        .from("workflows")
        .update({
          status: "archived" as WorkflowStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", approval.workflow_id);

      if (error) return { success: false, error: `Failed to archive workflow: ${error.message}` };
      return { success: true };
    }

    case "ab_test_start": {
      if (!approval.ab_test_id) {
        return { success: false, error: "AB test ID is required for ab_test_start approval" };
      }

      const { error } = await supabase
        .from("workflow_ab_tests")
        .update({ status: "running" as ABTestStatus })
        .eq("id", approval.ab_test_id);

      if (error) return { success: false, error: `Failed to start AB test: ${error.message}` };
      return { success: true };
    }

    case "ab_test_winner": {
      if (!approval.ab_test_id) {
        return { success: false, error: "AB test ID is required for ab_test_winner approval" };
      }

      // The winner info should be encoded in the notes (e.g., "winner:A" or "winner:B")
      const winnerMatch = approval.notes?.match(/winner:([AB])/);
      const winner = winnerMatch ? winnerMatch[1] : null;

      const updatePayload: Record<string, unknown> = {
        status: "complete" as ABTestStatus,
        declared_by: approval.approved_by,
        completed_at: new Date().toISOString(),
      };

      if (winner) {
        updatePayload.winner = winner;
      }

      const { error } = await supabase
        .from("workflow_ab_tests")
        .update(updatePayload)
        .eq("id", approval.ab_test_id);

      if (error) return { success: false, error: `Failed to declare AB test winner: ${error.message}` };
      return { success: true };
    }

    case "rollback": {
      if (!approval.workflow_version_id) {
        return { success: false, error: "Version ID is required for rollback approval" };
      }

      // Set workflow's current_version_id to the specified version
      const { error } = await supabase
        .from("workflows")
        .update({
          current_version_id: approval.workflow_version_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", approval.workflow_id);

      if (error) return { success: false, error: `Failed to rollback workflow: ${error.message}` };
      return { success: true };
    }

    default:
      return { success: false, error: `Unknown approval type: ${approval.approval_type}` };
  }
}
