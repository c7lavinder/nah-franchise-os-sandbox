/**
 * Workflow Step Scheduler
 *
 * The execution engine for the Workflow Intelligence system.
 * Processes all active enrollments, determines which steps are due,
 * executes them (send via GHL, create tasks, log results), and advances enrollments.
 *
 * Called by the cron endpoint: POST /api/cron/workflow-scheduler
 *
 * Rate limiting: Per ghl-masterclass, GHL allows 100 requests/10s burst.
 * The scheduler adds a 150ms delay between GHL API calls to stay well under.
 *
 * Flow per enrollment:
 *   1. Get current day from enrollment
 *   2. Find all steps for that day in the workflow version
 *   3. Skip steps already executed (check step_logs)
 *   4. For steps requiring confirmation → queue for review (don't auto-send)
 *   5. For auto-execute steps (tasks, notifications, checks) → execute immediately
 *   6. Log every step execution in workflow_step_logs
 *   7. If all steps for the day are done, advance to next day
 */

import { createServerClient } from "@/lib/supabase/server";
import * as ghl from "@/lib/ghl";
import { advanceDay, exitEnrollment } from "@/lib/workflows/enrollment";
import { prepareEmailForTracking } from "@/lib/workflows/tracking";
import { isStepDueForEnrollment } from "@/lib/workflows/step-timing";
import { executeGHLAction } from "@/lib/ghl/actions/executor";
import { personalizeWorkflowText } from "@/lib/workflows/personalization";
import type { GHLActionCode } from "@/lib/ghl/permissions";
import type { WorkflowStep, WorkflowStepType, WorkflowStepLogInsert } from "@/lib/workflows/types";

/** Result summary from a scheduler run */
export interface SchedulerRunResult {
  enrollmentsProcessed: number;
  stepsExecuted: number;
  stepsQueued: number;
  stepsSkipped: number;
  enrollmentsAdvanced: number;
  enrollmentsExpired: number;
  errors: string[];
}

/** Step types that execute immediately without human confirmation */
const AUTO_EXECUTE_TYPES: WorkflowStepType[] = [
  "chad_call_task",
  "team_notify",
  "ai_agent_action",
  "condition_check",
  "trainual_check",
  // New action-parity types — all auto-execute
  "appointment",
  "send_reminder",
  "internal_note",
  "add_tag",
  "remove_tag",
  "update_contact",
  "pipeline_move",
  "trigger_workflow",
];

const CUSTOMER_FACING_SEND_STEP_TYPES = new Set<WorkflowStepType>(["sms", "email", "send_reminder"]);

/**
 * Maps workflow step types to GHL action codes.
 * Steps in this map are executed via the shared executeGHLAction() executor,
 * giving workflows the same 30-action capability as the Next Steps tab.
 */
const STEP_ACTION_MAP: Partial<Record<WorkflowStepType, GHLActionCode>> = {
  sms: "C1",
  email: "C2",
  chad_call_task: "T1",
  appointment: "A1",
  send_reminder: "A5",
  internal_note: "C8",
  add_tag: "M4",
  remove_tag: "M5",
  update_contact: "M2",
  pipeline_move: "M3",
  trigger_workflow: "C5",
};

/**
 * Build params for executeGHLAction() from a workflow step + enrollment context.
 * Each action code expects specific param shapes — this maps step fields to them.
 */
export async function buildActionParams(
  step: WorkflowStep,
  enrollment: { ghl_contact_id: string; contact_name: string | null }
): Promise<Record<string, unknown>> {
  const contactId = enrollment.ghl_contact_id;
  const content = await personalizeWorkflowText({
    text: step.content,
    contactName: enrollment.contact_name,
    ghlContactId: enrollment.ghl_contact_id,
  });
  const actionConfig = (step.condition_config ?? {}) as Record<string, unknown>;

  switch (step.step_type) {
    case "sms":
      return { contactId, message: content, fromNumber: actionConfig.fromNumber ?? undefined };

    case "email": {
      const logId = `pending_${step.id}_${Date.now()}`;
      const trackedHtml = prepareEmailForTracking(content, logId);
      return {
        contactId,
        html: trackedHtml,
        subject: await personalizeWorkflowText({
          text: step.subject,
          contactName: enrollment.contact_name,
          ghlContactId: enrollment.ghl_contact_id,
        }),
        emailFrom: actionConfig.emailFrom ?? process.env.GHL_DEFAULT_EMAIL_FROM ?? "franchise@newagainhouses.com",
      };
    }

    case "chad_call_task": {
      const dueDate = new Date();
      dueDate.setHours(17, 0, 0, 0);
      return {
        contactId,
        title: content || `Call ${enrollment.contact_name ?? "prospect"}`,
        body:
          (await personalizeWorkflowText({
            text: step.subject,
            contactName: enrollment.contact_name,
            ghlContactId: enrollment.ghl_contact_id,
          })) || "Workflow-generated call task",
        dueDate: dueDate.toISOString(),
        assignedTo: actionConfig.assignedTo ?? undefined,
      };
    }

    case "appointment":
      return {
        contactId,
        calendarId: actionConfig.calendarId ?? "",
        startTime: actionConfig.startTime ?? "",
        endTime: actionConfig.endTime ?? "",
        title: content || actionConfig.title || "NAH Call",
        assignedUserId: actionConfig.assignedUserId ?? undefined,
      };

    case "send_reminder":
      return {
        contactId,
        reminderMessage: content || "Reminder: You have an upcoming call with New Again Houses.",
        fromNumber: actionConfig.fromNumber ?? undefined,
      };

    case "internal_note":
      return { contactId, note: content };

    case "add_tag":
      return { contactId, tags: actionConfig.tags ?? [content] };

    case "remove_tag":
      return { contactId, remainingTags: actionConfig.remainingTags ?? [] };

    case "update_contact":
      return { contactId, fields: actionConfig.fields ?? {} };

    case "pipeline_move":
      return {
        contactId,
        fieldId: actionConfig.fieldId ?? "",
        fieldValue: actionConfig.fieldValue ?? "",
        customFields: actionConfig.customFields ?? undefined,
      };

    case "trigger_workflow":
      return { contactId, campaignName: content || ((actionConfig.campaignName as string) ?? "") };

    default:
      return { contactId };
  }
}

/**
 * Run the scheduler for all active enrollments.
 * This is the main entry point called by the cron job.
 */
export async function runScheduler(): Promise<SchedulerRunResult> {
  const supabase = createServerClient();
  const result: SchedulerRunResult = {
    enrollmentsProcessed: 0,
    stepsExecuted: 0,
    stepsQueued: 0,
    stepsSkipped: 0,
    enrollmentsAdvanced: 0,
    enrollmentsExpired: 0,
    errors: [],
  };

  // Get all active enrollments
  const { data: enrollments, error: enrollErr } = await supabase
    .from("workflow_enrollments")
    .select("*")
    .eq("status", "active");

  if (enrollErr || !enrollments) {
    result.errors.push(`Failed to fetch enrollments: ${enrollErr?.message ?? "unknown"}`);
    return result;
  }

  for (const enrollment of enrollments) {
    try {
      await processEnrollment(enrollment, result);
      result.enrollmentsProcessed++;
      // Rate limit: 150ms between enrollments to stay under GHL's 100/10s burst limit
      await new Promise((r) => setTimeout(r, 150));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      result.errors.push(`Enrollment ${enrollment.id}: ${msg}`);
    }
  }

  return result;
}

/** Process a single enrollment — find due steps and execute them */
async function processEnrollment(
  enrollment: {
    id: string;
    workflow_id: string;
    workflow_version_id: string;
    ghl_contact_id: string;
    contact_name: string | null;
    current_day: number;
    enrolled_at: string | null;
  },
  result: SchedulerRunResult
): Promise<void> {
  const supabase = createServerClient();

  // Get the workflow to check exit conditions
  const { data: workflow } = await supabase
    .from("workflows")
    .select("exit_conditions")
    .eq("id", enrollment.workflow_id)
    .single();

  const exitConditions = (workflow?.exit_conditions ?? {}) as {
    maxDays?: number;
    goalConditions?: Array<{
      field: string;
      operator: string;
      value: string | string[] | number;
    }>;
    description?: string;
  };
  const maxDays = exitConditions.maxDays;

  // Check if enrollment has exceeded max days
  if (maxDays && enrollment.current_day > maxDays) {
    await exitEnrollment({
      enrollmentId: enrollment.id,
      reason: `Workflow duration exceeded (day ${enrollment.current_day} > ${maxDays})`,
      goalAchieved: false,
    });
    result.enrollmentsExpired++;
    return;
  }

  // Check flexible goal conditions (if defined)
  if (exitConditions.goalConditions?.length) {
    const goalMet = await evaluateGoalConditions(enrollment.ghl_contact_id, exitConditions.goalConditions);
    if (goalMet) {
      await exitEnrollment({
        enrollmentId: enrollment.id,
        reason: exitConditions.description ?? "Goal achieved",
        goalAchieved: true,
      });
      result.enrollmentsExpired++;
      return;
    }
  }

  // Get all steps for the current day in this workflow version
  const { data: steps, error: stepsErr } = await supabase
    .from("workflow_steps")
    .select("*")
    .eq("workflow_version_id", enrollment.workflow_version_id)
    .eq("day_number", enrollment.current_day)
    .order("step_number", { ascending: true });

  if (stepsErr || !steps) {
    result.errors.push(`No steps found for enrollment ${enrollment.id} day ${enrollment.current_day}`);
    return;
  }

  // If no steps exist for this day, advance to next day
  if (steps.length === 0) {
    await advanceDay(enrollment.id);
    result.enrollmentsAdvanced++;
    return;
  }

  // Check which steps have already been executed
  const { data: executedLogs } = await supabase
    .from("workflow_step_logs")
    .select("step_id")
    .eq("enrollment_id", enrollment.id);

  const executedStepIds = new Set((executedLogs ?? []).map((log) => log.step_id));

  let allDayStepsDone = true;

  for (const step of steps as WorkflowStep[]) {
    // Skip already executed steps
    if (executedStepIds.has(step.id)) {
      result.stepsSkipped++;
      continue;
    }

    if (!isStepDueForEnrollment(step, enrollment)) {
      allDayStepsDone = false;
      continue;
    }

    // Customer-facing send steps always queue for human confirmation, even
    // when older workflow data has requires_confirmation=false.
    const requiresConfirmation =
      CUSTOMER_FACING_SEND_STEP_TYPES.has(step.step_type) ||
      (step.requires_confirmation && !AUTO_EXECUTE_TYPES.includes(step.step_type));

    if (requiresConfirmation) {
      // Queue for human review — create a log entry with pending status
      await createStepLog(enrollment, step, { queued: true });
      result.stepsQueued++;
      allDayStepsDone = false;
    } else {
      // Auto-execute
      const executed = await executeStep(enrollment, step);
      if (executed) {
        result.stepsExecuted++;
      } else {
        allDayStepsDone = false;
      }
    }
  }

  // If all steps for today are done, advance to the next day
  if (allDayStepsDone && steps.length > 0) {
    await advanceDay(enrollment.id);
    result.enrollmentsAdvanced++;
  }
}

/** Execute a single workflow step based on its type */
async function executeStep(
  enrollment: {
    id: string;
    ghl_contact_id: string;
    contact_name: string | null;
  },
  step: WorkflowStep
): Promise<boolean> {
  try {
    let ghlMessageId: string | null = null;

    // Check if this step type maps to a GHL action code
    const actionCode = STEP_ACTION_MAP[step.step_type];

    if (actionCode) {
      // Route through the shared GHL Action Executor — same engine as Next Steps
      const params = await buildActionParams(step, enrollment);
      const result = await executeGHLAction(actionCode, params, "system", enrollment.ghl_contact_id);
      if (!result.success) {
        throw new Error(result.error ?? `Action ${actionCode} failed`);
      }
      ghlMessageId = (result.data as { id?: string })?.id ?? null;
    } else {
      // Custom handlers for non-GHL step types
      switch (step.step_type) {
        case "team_notify":
          // Internal notification — no GHL action needed
          break;

        case "ai_agent_action":
          // Scout analysis action — handled by the intelligence engine
          break;

        case "condition_check":
          await evaluateCondition(enrollment, step);
          break;

        case "trainual_check":
          // Check Trainual completion status
          break;

        case "stage_move_suggestion":
          // Queued for human review — should not auto-execute
          break;
      }
    }

    // Log successful execution
    await createStepLog(enrollment, step, {
      queued: false,
      executed: true,
      ghlMessageId,
    });

    return true;
  } catch (err) {
    console.error(`Step ${step.id} execution failed:`, err);

    // Log the failure
    await createStepLog(enrollment, step, {
      queued: false,
      executed: false,
      error: err instanceof Error ? err.message : "Unknown error",
    });

    return false;
  }
}

/** Evaluate a condition check step */
async function evaluateCondition(
  enrollment: { id: string; ghl_contact_id: string },
  step: WorkflowStep
): Promise<void> {
  if (!step.condition_config) return;

  const config = step.condition_config as {
    type?: string;
    field?: string;
    operator?: string;
    value?: string;
  };

  // Currently supports checking GHL contact custom fields
  if (config.type === "contact_field" && config.field) {
    try {
      const contact = await ghl.getContact(enrollment.ghl_contact_id);
      const fieldValue = contact.customFields?.find((f) => f.id === config.field)?.value;

      const conditionMet = evaluateFieldCondition(fieldValue ?? "", config.operator ?? "equals", config.value ?? "");

      // Log the condition result for the intelligence engine
      console.log(
        `Condition check for enrollment ${enrollment.id}: ` +
          `${config.field} ${config.operator} ${config.value} = ${conditionMet}`
      );
    } catch {
      console.error(`Condition check failed for enrollment ${enrollment.id}`);
    }
  }
}

/** Evaluate a simple field condition (supports flexible trigger/terminal operators) */
function evaluateFieldCondition(actual: string, operator: string, expected: string | string[] | number): boolean {
  switch (operator) {
    case "equals":
      return actual === String(expected);
    case "not_equals":
      return actual !== String(expected);
    case "contains":
      return actual.includes(String(expected));
    case "not_empty":
      return actual.length > 0;
    case "empty":
      return actual.length === 0;
    case "in":
      return Array.isArray(expected) && expected.includes(actual);
    case "greater_than":
      return Number(actual) > Number(expected);
    case "less_than":
      return Number(actual) < Number(expected);
    default:
      return false;
  }
}

/**
 * Evaluate flexible goal conditions against a contact's current data.
 * Returns true if ALL conditions are met (AND logic).
 */
async function evaluateGoalConditions(
  contactId: string,
  conditions: Array<{ field: string; operator: string; value: string | string[] | number }>
): Promise<boolean> {
  try {
    const contact = await ghl.getContact(contactId);
    if (!contact) return false;

    for (const condition of conditions) {
      // Check standard fields first, then custom fields
      let fieldValue: string = "";

      const standardFields: Record<string, string | undefined> = {
        email: contact.email ?? undefined,
        phone: contact.phone ?? undefined,
        firstName: contact.firstName,
        lastName: contact.lastName,
        name: `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim(),
        tags: (contact.tags ?? []).join(","),
      };

      if (condition.field in standardFields) {
        fieldValue = standardFields[condition.field] ?? "";
      } else {
        // Check custom fields by ID
        const customField = contact.customFields?.find((f) => f.id === condition.field);
        fieldValue = String(customField?.value ?? "");
      }

      if (!evaluateFieldCondition(fieldValue, condition.operator, condition.value)) {
        return false;
      }
    }

    return true;
  } catch {
    console.error(`Goal condition evaluation failed for contact ${contactId}`);
    return false;
  }
}

/** Create a step log entry in workflow_step_logs */
async function createStepLog(
  enrollment: { id: string; ghl_contact_id: string },
  step: WorkflowStep,
  status: {
    queued: boolean;
    executed?: boolean;
    ghlMessageId?: string | null;
    error?: string;
  }
): Promise<void> {
  const supabase = createServerClient();
  const { data: enrollmentRow } = await supabase
    .from("workflow_enrollments")
    .select("contact_name")
    .eq("id", enrollment.id)
    .single();
  const contentSent = await personalizeWorkflowText({
    text: step.content,
    contactName: enrollmentRow?.contact_name ?? null,
    ghlContactId: enrollment.ghl_contact_id,
  });

  const log: WorkflowStepLogInsert = {
    enrollment_id: enrollment.id,
    step_id: step.id,
    ghl_contact_id: enrollment.ghl_contact_id,
    step_type: step.step_type,
    content_sent: contentSent || null,
    ghl_message_id: status.ghlMessageId ?? null,
    executed_at: status.executed ? new Date().toISOString() : null,
    confirmed_by: null,
    confirmed_at: null,
    delivery_data: status.error
      ? { error: status.error, queued: status.queued }
      : status.queued
        ? { queued: true }
        : null,
  };

  await supabase.from("workflow_step_logs").insert(log);
}
