/**
 * Workflow Builder Types
 *
 * Types for the conversational workflow builder UI.
 * The builder generates WorkflowDraft objects that get saved
 * to the existing workflow tables via the standard APIs.
 */

import type { WorkflowStepType } from "@/lib/workflows/types";

// ═══════════════════════════════════════════════════════
// Condition rules (shared by triggers and terminals)
// ═══════════════════════════════════════════════════════

/** A single condition rule evaluated against event payloads or contact data */
export interface ConditionRule {
  field: string;
  operator: "equals" | "not_equals" | "contains" | "in" | "not_empty" | "empty" | "greater_than" | "less_than";
  value: string | string[] | number;
}

// ═══════════════════════════════════════════════════════
// Trigger config (flexible, not hardcoded)
// ═══════════════════════════════════════════════════════

/** Structured trigger rule — stored in workflows.trigger_config jsonb */
export interface TriggerRule {
  /** GHL webhook event type (e.g. "appointment.created", "contact.stage_changed") or "manual" */
  event: string;
  /** Conditions that filter which events actually trigger enrollment */
  conditions: ConditionRule[];
  /** Human-readable summary for display (e.g. "When someone books a Discovery Call") */
  description: string;
}

// ═══════════════════════════════════════════════════════
// Exit conditions (flexible, not hardcoded)
// ═══════════════════════════════════════════════════════

/** Structured exit rule — stored in workflows.exit_conditions jsonb */
export interface ExitRule {
  /** Maximum days before auto-expiring the enrollment */
  maxDays: number;
  /** Internal event that triggers the exit check (e.g. "subtask.completed", "stage.advanced") */
  goalEvent?: string;
  /** Goal conditions evaluated against the event payload or contact data */
  goalConditions: ConditionRule[];
  /** Human-readable summary (e.g. "When Discovery Call sub-task is completed") */
  description: string;
}

// ═══════════════════════════════════════════════════════
// Workflow draft (what the builder produces)
// ═══════════════════════════════════════════════════════

/** A complete workflow draft before it is saved to the database */
export interface WorkflowDraft {
  name: string;
  description: string;
  workflowType: string;
  triggerConfig: TriggerRule;
  exitConditions: ExitRule;
  primaryMetric: string;
  steps: WorkflowStepDraft[];
}

/** A single step in a workflow draft */
export interface WorkflowStepDraft {
  /** Present when editing an existing step */
  id?: string;
  dayNumber: number;
  stepNumber: number;
  stepType: WorkflowStepType;
  /** Message content (SMS text, email body HTML, task title, note content, etc.) */
  content: string | null;
  /** Email subject line */
  subject: string | null;
  /** Legacy fixed clock send time */
  sendTime: string | null;
  /** Relative delay from lead/workflow enrollment time */
  delayHours: number | null;
  /** Who this message/task sends from (person name, e.g. "Chad") */
  senderName: string | null;
  /** Sender email address for email steps */
  senderEmail: string | null;
  /** Sender phone number for SMS/reminder steps */
  fromNumber: string | null;
  /** Who the task is assigned to (for call tasks) */
  assignedTo: string | null;
  /** Due date/time for tasks (e.g. "same day 5pm", "next business day 9am") */
  dueTime: string | null;
  /** Whether this step needs human approval before executing */
  requiresConfirmation: boolean;
  /** Extra params for GHL actions — stored in condition_config jsonb */
  actionParams?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════
// Builder conversation
// ═══════════════════════════════════════════════════════

/** A message in the workflow builder conversation */
export interface BuilderMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Attached when the AI produces or updates a workflow draft */
  workflowDraft?: WorkflowDraft;
}
