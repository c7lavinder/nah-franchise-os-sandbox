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
  /** Goal conditions evaluated each scheduler cycle against contact data */
  goalConditions: ConditionRule[];
  /** Human-readable summary (e.g. "When contact shows up to their call") */
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
  /** Message content (SMS text, email HTML, task title, note content, etc.) */
  content: string | null;
  /** Email subject line */
  subject: string | null;
  /** When to send (e.g. "09:00") */
  sendTime: string | null;
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
