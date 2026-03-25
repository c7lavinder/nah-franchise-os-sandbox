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
import type {
  WorkflowStep,
  WorkflowStepType,
  WorkflowStepLogInsert,
} from "@/lib/workflows/types";

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
];

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
  },
  result: SchedulerRunResult
): Promise<void> {
  const supabase = createServerClient();

  // Get the workflow to check max duration
  const { data: workflow } = await supabase
    .from("workflows")
    .select("exit_conditions")
    .eq("id", enrollment.workflow_id)
    .single();

  const exitConditions = (workflow?.exit_conditions ?? {}) as { maxDays?: number };
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

    // Check if this step should auto-execute or queue for confirmation
    const requiresConfirmation = step.requires_confirmation &&
      !AUTO_EXECUTE_TYPES.includes(step.step_type);

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

    switch (step.step_type) {
      case "chad_call_task":
        await executeChadCallTask(enrollment, step);
        break;

      case "team_notify":
        // Internal notification — no GHL action needed
        // Future: send to Slack/email notification system
        break;

      case "ai_agent_action":
        // Scout analysis action — handled by the intelligence engine
        break;

      case "condition_check":
        // Evaluate condition and potentially branch
        await evaluateCondition(enrollment, step);
        break;

      case "trainual_check":
        // Check Trainual completion status
        // Future: call Trainual API integration
        break;

      case "sms":
        // SMS steps that don't require confirmation (rare, but supported)
        if (step.content) {
          const msg = await ghl.sendMessage({
            type: "SMS",
            contactId: enrollment.ghl_contact_id,
            message: personalizeContent(step.content, enrollment.contact_name),
          });
          ghlMessageId = msg.id ?? null;
        }
        break;

      case "email":
        // Email steps that don't require confirmation (rare, but supported)
        if (step.content && step.subject) {
          const msg = await ghl.sendMessage({
            type: "Email",
            contactId: enrollment.ghl_contact_id,
            html: personalizeContent(step.content, enrollment.contact_name),
            subject: personalizeContent(step.subject, enrollment.contact_name),
            emailFrom: process.env.GHL_DEFAULT_EMAIL_FROM ?? "franchise@newagainhouses.com",
          });
          ghlMessageId = msg.id ?? null;
        }
        break;

      case "stage_move_suggestion":
        // Queued for human review — should not auto-execute
        break;
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

/** Create a Chad call task in GHL */
async function executeChadCallTask(
  enrollment: { ghl_contact_id: string; contact_name: string | null },
  step: WorkflowStep
): Promise<void> {
  const dueDate = new Date();
  dueDate.setHours(17, 0, 0, 0); // Due by end of day (5 PM)

  await ghl.createTask(enrollment.ghl_contact_id, {
    title: step.content
      ? personalizeContent(step.content, enrollment.contact_name)
      : `Call ${enrollment.contact_name ?? "prospect"}`,
    body: step.subject ?? "Workflow-generated call task",
    dueDate: dueDate.toISOString(),
  });
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
      const fieldValue = contact.customFields?.find(
        (f) => f.id === config.field
      )?.value;

      const conditionMet = evaluateFieldCondition(
        fieldValue ?? "",
        config.operator ?? "equals",
        config.value ?? ""
      );

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

/** Evaluate a simple field condition */
function evaluateFieldCondition(
  actual: string,
  operator: string,
  expected: string
): boolean {
  switch (operator) {
    case "equals":
      return actual === expected;
    case "not_equals":
      return actual !== expected;
    case "contains":
      return actual.includes(expected);
    case "not_empty":
      return actual.length > 0;
    case "empty":
      return actual.length === 0;
    default:
      return false;
  }
}

/** Replace [Name] placeholders with actual contact name */
function personalizeContent(content: string, contactName: string | null): string {
  const name = contactName ?? "there";
  const firstName = name.split(" ")[0];
  return content
    .replace(/\[Name\]/g, name)
    .replace(/\[FirstName\]/g, firstName)
    .replace(/\[name\]/g, name)
    .replace(/\[firstName\]/g, firstName);
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

  const log: WorkflowStepLogInsert = {
    enrollment_id: enrollment.id,
    step_id: step.id,
    ghl_contact_id: enrollment.ghl_contact_id,
    step_type: step.step_type,
    content_sent: step.content ?? null,
    ghl_message_id: status.ghlMessageId ?? null,
    executed_at: status.executed ? new Date().toISOString() : null,
    confirmed_by: null,
    confirmed_at: null,
    delivery_data: status.error ? { error: status.error, queued: status.queued } : (status.queued ? { queued: true } : null),
  };

  await supabase.from("workflow_step_logs").insert(log);
}
