/**
 * Workflow Enrollment Service
 *
 * Manages the lifecycle of contacts enrolled in workflows:
 * enroll, pause, resume, exit, advance day, and query status.
 *
 * All database writes go through Supabase. GHL custom field updates
 * are synced after each state change to keep CRM in sync.
 */

import { createServerClient } from "@/lib/supabase/server";
import * as ghl from "@/lib/ghl";
import { resolveCustomFields } from "@/lib/ghl/custom-fields";
import type { WorkflowEnrollment, WorkflowEnrollmentInsert, EnrollmentStatus } from "@/lib/workflows/types";

/** Result of an enrollment operation */
export interface EnrollmentResult {
  success: boolean;
  enrollment?: WorkflowEnrollment;
  error?: string;
}

/**
 * Enroll a contact into a workflow.
 * Creates an enrollment record and syncs workflow tracking fields to GHL.
 * Prevents duplicate active enrollments in the same workflow.
 */
export async function enrollContact(params: {
  workflowId: string;
  workflowVersionId: string;
  ghlContactId: string;
  contactName?: string;
}): Promise<EnrollmentResult> {
  const supabase = createServerClient();

  // Check for existing active enrollment in this workflow
  const { data: existing } = await supabase
    .from("workflow_enrollments")
    .select("id, status")
    .eq("workflow_id", params.workflowId)
    .eq("ghl_contact_id", params.ghlContactId)
    .in("status", ["active", "paused"])
    .limit(1)
    .single();

  if (existing) {
    return {
      success: false,
      error: `Contact is already ${existing.status} in this workflow (enrollment ${existing.id})`,
    };
  }

  // Get workflow name for GHL sync
  const { data: workflow } = await supabase.from("workflows").select("name").eq("id", params.workflowId).single();

  // Create the enrollment
  const insert: WorkflowEnrollmentInsert = {
    workflow_id: params.workflowId,
    workflow_version_id: params.workflowVersionId,
    ghl_contact_id: params.ghlContactId,
    contact_name: params.contactName ?? null,
    status: "active",
    current_step_id: null,
    exit_reason: null,
    last_step_at: null,
    completed_at: null,
    paused_at: null,
  };

  const { data: enrollment, error } = await supabase.from("workflow_enrollments").insert(insert).select().single();

  if (error || !enrollment) {
    return { success: false, error: error?.message ?? "Failed to create enrollment" };
  }

  // Increment active enrollee count on the workflow
  const { data: wfCount } = await supabase
    .from("workflows")
    .select("active_enrollee_count")
    .eq("id", params.workflowId)
    .single();

  await supabase
    .from("workflows")
    .update({ active_enrollee_count: ((wfCount?.active_enrollee_count as number) ?? 0) + 1 })
    .eq("id", params.workflowId);

  // Sync workflow tracking fields to GHL contact
  await syncGhlWorkflowFields(params.ghlContactId, {
    workflowName: workflow?.name ?? "Unknown",
    workflowDay: 1,
    workflowVersion: params.workflowVersionId,
    goalAchieved: false,
  });

  return { success: true, enrollment: enrollment as WorkflowEnrollment };
}

/**
 * Pause an active enrollment.
 * Contact stops receiving workflow steps until resumed.
 */
export async function pauseEnrollment(enrollmentId: string): Promise<EnrollmentResult> {
  const supabase = createServerClient();

  const { data: enrollment, error: fetchErr } = await supabase
    .from("workflow_enrollments")
    .select("*")
    .eq("id", enrollmentId)
    .single();

  if (fetchErr || !enrollment) {
    return { success: false, error: "Enrollment not found" };
  }

  if (enrollment.status !== "active") {
    return { success: false, error: `Cannot pause — enrollment is ${enrollment.status}` };
  }

  const { data: updated, error } = await supabase
    .from("workflow_enrollments")
    .update({ status: "paused" as EnrollmentStatus, paused_at: new Date().toISOString() })
    .eq("id", enrollmentId)
    .select()
    .single();

  if (error || !updated) {
    return { success: false, error: error?.message ?? "Failed to pause enrollment" };
  }

  return { success: true, enrollment: updated as WorkflowEnrollment };
}

/**
 * Resume a paused enrollment.
 * Contact continues receiving workflow steps from where they left off.
 */
export async function resumeEnrollment(enrollmentId: string): Promise<EnrollmentResult> {
  const supabase = createServerClient();

  const { data: enrollment, error: fetchErr } = await supabase
    .from("workflow_enrollments")
    .select("*")
    .eq("id", enrollmentId)
    .single();

  if (fetchErr || !enrollment) {
    return { success: false, error: "Enrollment not found" };
  }

  if (enrollment.status !== "paused") {
    return { success: false, error: `Cannot resume — enrollment is ${enrollment.status}` };
  }

  const { data: updated, error } = await supabase
    .from("workflow_enrollments")
    .update({ status: "active" as EnrollmentStatus, paused_at: null })
    .eq("id", enrollmentId)
    .select()
    .single();

  if (error || !updated) {
    return { success: false, error: error?.message ?? "Failed to resume enrollment" };
  }

  return { success: true, enrollment: updated as WorkflowEnrollment };
}

/**
 * Exit a contact from a workflow.
 * Marks the enrollment as completed or exited with a reason.
 * Updates GHL custom fields to reflect the exit.
 */
export async function exitEnrollment(params: {
  enrollmentId: string;
  reason: string;
  goalAchieved: boolean;
}): Promise<EnrollmentResult> {
  const supabase = createServerClient();

  const { data: enrollment, error: fetchErr } = await supabase
    .from("workflow_enrollments")
    .select("*, workflows(name)")
    .eq("id", params.enrollmentId)
    .single();

  if (fetchErr || !enrollment) {
    return { success: false, error: "Enrollment not found" };
  }

  const currentStatus = enrollment.status as EnrollmentStatus;
  if (currentStatus !== "active" && currentStatus !== "paused") {
    return { success: false, error: `Cannot exit — enrollment is ${currentStatus}` };
  }

  const finalStatus: EnrollmentStatus = params.goalAchieved ? "completed" : "exited";

  const { data: updated, error } = await supabase
    .from("workflow_enrollments")
    .update({
      status: finalStatus,
      exit_reason: params.reason,
      goal_achieved: params.goalAchieved,
      completed_at: new Date().toISOString(),
    })
    .eq("id", params.enrollmentId)
    .select()
    .single();

  if (error || !updated) {
    return { success: false, error: error?.message ?? "Failed to exit enrollment" };
  }

  // Decrement active enrollee count
  const { data: wfData } = await supabase
    .from("workflows")
    .select("active_enrollee_count")
    .eq("id", enrollment.workflow_id)
    .single();

  if (wfData) {
    await supabase
      .from("workflows")
      .update({ active_enrollee_count: Math.max(0, (wfData.active_enrollee_count ?? 1) - 1) })
      .eq("id", enrollment.workflow_id);
  }

  // Sync GHL fields — clear workflow name, mark goal status
  await syncGhlWorkflowFields(enrollment.ghl_contact_id, {
    workflowName: "",
    workflowDay: enrollment.current_day,
    workflowVersion: "",
    goalAchieved: params.goalAchieved,
  });

  return { success: true, enrollment: updated as WorkflowEnrollment };
}

/**
 * Advance an enrollment's current day.
 * Called by the workflow step scheduler after processing a day's steps.
 */
export async function advanceDay(enrollmentId: string): Promise<EnrollmentResult> {
  const supabase = createServerClient();

  const { data: enrollment, error: fetchErr } = await supabase
    .from("workflow_enrollments")
    .select("*")
    .eq("id", enrollmentId)
    .single();

  if (fetchErr || !enrollment) {
    return { success: false, error: "Enrollment not found" };
  }

  if (enrollment.status !== "active") {
    return { success: false, error: `Cannot advance — enrollment is ${enrollment.status}` };
  }

  const nextDay = (enrollment.current_day ?? 1) + 1;

  const { data: updated, error } = await supabase
    .from("workflow_enrollments")
    .update({
      current_day: nextDay,
      last_step_at: new Date().toISOString(),
    })
    .eq("id", enrollmentId)
    .select()
    .single();

  if (error || !updated) {
    return { success: false, error: error?.message ?? "Failed to advance day" };
  }

  // Sync day number to GHL
  await syncGhlWorkflowFields(enrollment.ghl_contact_id, {
    workflowDay: nextDay,
  });

  return { success: true, enrollment: updated as WorkflowEnrollment };
}

/**
 * Get all active enrollments for a contact across all workflows.
 */
export async function getContactEnrollments(
  ghlContactId: string,
  statusFilter?: EnrollmentStatus[]
): Promise<WorkflowEnrollment[]> {
  const supabase = createServerClient();

  let query = supabase
    .from("workflow_enrollments")
    .select("*")
    .eq("ghl_contact_id", ghlContactId)
    .order("enrolled_at", { ascending: false });

  if (statusFilter && statusFilter.length > 0) {
    query = query.in("status", statusFilter);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch contact enrollments:", error.message);
    return [];
  }

  return (data ?? []) as WorkflowEnrollment[];
}

/**
 * Get all active enrollments for a workflow.
 */
export async function getWorkflowEnrollments(
  workflowId: string,
  statusFilter?: EnrollmentStatus[]
): Promise<WorkflowEnrollment[]> {
  const supabase = createServerClient();

  let query = supabase
    .from("workflow_enrollments")
    .select("*")
    .eq("workflow_id", workflowId)
    .order("enrolled_at", { ascending: false });

  if (statusFilter && statusFilter.length > 0) {
    query = query.in("status", statusFilter);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch workflow enrollments:", error.message);
    return [];
  }

  return (data ?? []) as WorkflowEnrollment[];
}

/**
 * Get a single enrollment by ID.
 */
export async function getEnrollment(enrollmentId: string): Promise<WorkflowEnrollment | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase.from("workflow_enrollments").select("*").eq("id", enrollmentId).single();

  if (error || !data) return null;
  return data as WorkflowEnrollment;
}

/**
 * Check if a contact has an active enrollment in a specific workflow.
 */
export async function isContactEnrolled(ghlContactId: string, workflowId: string): Promise<boolean> {
  const supabase = createServerClient();

  const { data } = await supabase
    .from("workflow_enrollments")
    .select("id")
    .eq("ghl_contact_id", ghlContactId)
    .eq("workflow_id", workflowId)
    .in("status", ["active", "paused"])
    .limit(1)
    .single();

  return !!data;
}

/**
 * Expire enrollments that have exceeded their workflow duration.
 * Called by the workflow cron job.
 */
export async function expireStaleEnrollments(workflowId: string, maxDays: number): Promise<number> {
  const supabase = createServerClient();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - maxDays);

  const { data: stale } = await supabase
    .from("workflow_enrollments")
    .select("id, ghl_contact_id")
    .eq("workflow_id", workflowId)
    .eq("status", "active")
    .lt("enrolled_at", cutoff.toISOString());

  if (!stale || stale.length === 0) return 0;

  let expired = 0;
  for (const enrollment of stale) {
    const result = await exitEnrollment({
      enrollmentId: enrollment.id,
      reason: `Expired — exceeded ${maxDays}-day workflow duration`,
      goalAchieved: false,
    });
    if (result.success) expired++;
  }

  return expired;
}

// ════════════════════════════════════════════
// Real-time Exit Condition Evaluation
// ════════════════════════════════════════════

/**
 * Check all active enrollments for a contact and exit any whose
 * goal conditions are now met. Called in real-time from stage advance
 * and sub-task log endpoints — not just the scheduler.
 *
 * Supports exit conditions based on NAH OS internal data:
 * - stage.advanced: contact reached a specific pipeline stage
 * - subtask.completed: a specific sub-task was completed
 * - GHL fields: tags, custom fields (legacy, via scheduler)
 *
 * @param ghlContactId - The GHL contact ID
 * @param eventType - The internal event that just happened
 * @param eventPayload - Event data for condition evaluation
 */
export async function checkExitConditions(
  ghlContactId: string,
  eventType: string,
  eventPayload: Record<string, unknown>
): Promise<{ exited: number }> {
  const supabase = createServerClient();
  let exited = 0;

  // Find all active/paused enrollments for this contact
  const { data: enrollments } = await supabase
    .from("workflow_enrollments")
    .select("id, workflow_id, status")
    .eq("ghl_contact_id", ghlContactId)
    .in("status", ["active", "paused"]);

  if (!enrollments || enrollments.length === 0) return { exited: 0 };

  for (const enrollment of enrollments) {
    // Get the workflow's exit conditions
    const { data: workflow } = await supabase
      .from("workflows")
      .select("exit_conditions, name")
      .eq("id", enrollment.workflow_id)
      .single();

    if (!workflow?.exit_conditions) continue;

    const exitConfig = workflow.exit_conditions as {
      maxDays?: number;
      goalConditions?: Array<{ field: string; operator: string; value: string | string[] | number }>;
      goalEvent?: string;
      description?: string;
    };

    if (!exitConfig.goalConditions?.length && !exitConfig.goalEvent) continue;

    let goalMet = false;

    // Check event-based exit (new system): goalEvent matches the current event
    if (exitConfig.goalEvent) {
      const eventCompact = eventType.toLowerCase().replace(/[._\s]/g, "");
      const goalCompact = exitConfig.goalEvent.toLowerCase().replace(/[._\s]/g, "");
      if (eventCompact.includes(goalCompact) || goalCompact.includes(eventCompact)) {
        // Event type matches — now check conditions
        if (exitConfig.goalConditions?.length) {
          goalMet = exitConfig.goalConditions.every((condition) => {
            const fieldValue = String(eventPayload[condition.field] ?? "");
            return evaluateExitCondition(fieldValue, condition.operator, condition.value);
          });
        } else {
          goalMet = true; // Event matched with no conditions = exit
        }
      }
    }

    // Fallback: check conditions against the event payload directly (no goalEvent required)
    if (!goalMet && exitConfig.goalConditions?.length && !exitConfig.goalEvent) {
      goalMet = exitConfig.goalConditions.every((condition) => {
        const fieldValue = String(eventPayload[condition.field] ?? "");
        return evaluateExitCondition(fieldValue, condition.operator, condition.value);
      });
    }

    if (goalMet) {
      const result = await exitEnrollment({
        enrollmentId: enrollment.id,
        reason: exitConfig.description ?? `Goal achieved (${eventType})`,
        goalAchieved: true,
      });
      if (result.success) {
        exited++;
        console.log(
          `[exit-check] Exited enrollment ${enrollment.id} from "${workflow.name}" — ${exitConfig.description ?? eventType}`
        );
      }
    }
  }

  return { exited };
}

/** Evaluate a single exit condition */
function evaluateExitCondition(actual: string, operator: string, expected: string | string[] | number): boolean {
  switch (operator) {
    case "equals":
      return actual === String(expected);
    case "not_equals":
      return actual !== String(expected);
    case "contains":
      return actual.toLowerCase().includes(String(expected).toLowerCase());
    case "in":
      return Array.isArray(expected) && expected.includes(actual);
    case "not_empty":
      return actual.length > 0;
    case "empty":
      return actual.length === 0;
    case "greater_than":
      return Number(actual) > Number(expected);
    case "less_than":
      return Number(actual) < Number(expected);
    default:
      return false;
  }
}

// ════════════════════════════════════════════
// GHL Custom Field Sync
// ════════════════════════════════════════════

/** Fields synced to GHL contacts for workflow tracking */
interface GhlWorkflowFieldUpdate {
  workflowName?: string;
  workflowDay?: number;
  workflowVersion?: string;
  goalAchieved?: boolean;
}

/**
 * Syncs workflow tracking fields to a GHL contact's custom fields.
 * Uses the custom field resolver to map field names → GHL field IDs.
 *
 * Per ghl-masterclass: always use field IDs (not names) when writing,
 * and all values must be strings.
 */
async function syncGhlWorkflowFields(contactId: string, fields: GhlWorkflowFieldUpdate): Promise<void> {
  try {
    const rawFields: Record<string, string | number | boolean> = {};

    if (fields.workflowName !== undefined) rawFields["workflow_name"] = fields.workflowName;
    if (fields.workflowDay !== undefined) rawFields["workflow_day"] = fields.workflowDay;
    if (fields.workflowVersion !== undefined) rawFields["workflow_version"] = fields.workflowVersion;
    if (fields.goalAchieved !== undefined) rawFields["workflow_goal_achieved"] = fields.goalAchieved;
    rawFields["last_workflow_touch"] = new Date().toISOString();

    // Resolve field names → GHL field IDs via cached lookup
    const customFields = await resolveCustomFields(rawFields);

    await ghl.updateContact(contactId, { customFields });
  } catch (err) {
    // GHL sync failure is non-fatal — log and continue
    console.error(`Failed to sync GHL workflow fields for contact ${contactId}:`, err);
  }
}
