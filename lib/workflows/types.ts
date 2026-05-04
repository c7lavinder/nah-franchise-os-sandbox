/**
 * Workflow Intelligence Engine — TypeScript Types
 *
 * Matches the 7 database tables defined in schema.sql.
 * Used across API routes, components, and Scout tools.
 */

// ═══════════════════════════════════════════════════════
// Enums
// ═══════════════════════════════════════════════════════

/** Workflow health grade assigned by Scout's analysis engine */
export type WorkflowHealthScore = "A" | "B" | "C" | "D" | "F";

/** Lifecycle status of a workflow */
export type WorkflowStatus = "draft" | "pending_approval" | "live" | "paused" | "archived";

/** What kind of step this is in a workflow sequence */
export type WorkflowStepType =
  | "sms"
  | "email"
  | "chad_call_task"
  | "team_notify"
  | "ai_agent_action"
  | "condition_check"
  | "stage_move_suggestion"
  | "trainual_check"
  // Action parity with Next Steps — powered by executeGHLAction()
  | "appointment"
  | "send_reminder"
  | "internal_note"
  | "add_tag"
  | "remove_tag"
  | "update_contact"
  | "pipeline_move"
  | "trigger_workflow";

/** Color-coded performance indicator for a step */
export type StepPerformanceStatus = "green" | "yellow" | "red" | "neutral";

/** How an approved workflow version applies to existing enrollees */
export type WorkflowUpdateMode = "new_enrollees_only" | "full_overwrite";

/** Lifecycle status of a contact's enrollment in a workflow */
export type EnrollmentStatus = "active" | "paused" | "completed" | "exited" | "expired";

/** Whether an A/B test is testing one step or an entire workflow */
export type ABTestType = "step" | "full_workflow";

/** Lifecycle status of an A/B test */
export type ABTestStatus = "draft" | "pending_approval" | "running" | "complete" | "archived";

/** Which variant won an A/B test */
export type ABTestWinner = "A" | "B";

/** What kind of approval is being requested */
export type ApprovalType = "publish" | "pause" | "archive" | "ab_test_start" | "ab_test_winner" | "rollback";

/** Status of an approval request */
export type ApprovalStatus = "pending" | "approved" | "rejected";

// ═══════════════════════════════════════════════════════
// Table interfaces
// ═══════════════════════════════════════════════════════

/** Top-level workflow definition */
export interface Workflow {
  id: string;
  name: string;
  description: string | null;
  workflow_type: string;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  exit_conditions: Record<string, unknown>;
  pause_conditions: Record<string, unknown>;
  health_score: WorkflowHealthScore;
  status: WorkflowStatus;
  current_version_id: string | null;
  active_enrollee_count: number;
  primary_metric_name: string | null;
  primary_metric_value: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/** Immutable version snapshot of a workflow */
export interface WorkflowVersion {
  id: string;
  workflow_id: string;
  version_number: number;
  change_description: string | null;
  update_mode: WorkflowUpdateMode | null;
  created_by: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

/** Individual step within a workflow version */
export interface WorkflowStep {
  id: string;
  workflow_version_id: string;
  step_number: number;
  day_number: number;
  step_type: WorkflowStepType;
  content: string | null;
  subject: string | null;
  send_time: string | null;
  condition_config: Record<string, unknown> | null;
  requires_confirmation: boolean;
  performance_status: StepPerformanceStatus;
  open_rate: number | null;
  click_rate: number | null;
  response_rate: number | null;
  created_at: string;
}

/** A contact's enrollment in a workflow */
export interface WorkflowEnrollment {
  id: string;
  workflow_id: string;
  workflow_version_id: string;
  ghl_contact_id: string;
  contact_name: string | null;
  current_day: number;
  current_step_id: string | null;
  status: EnrollmentStatus;
  exit_reason: string | null;
  goal_achieved: boolean;
  enrolled_at: string;
  last_step_at: string | null;
  completed_at: string | null;
  paused_at: string | null;
}

/** Execution log entry for a single step sent to a contact */
export interface WorkflowStepLog {
  id: string;
  enrollment_id: string;
  step_id: string;
  ghl_contact_id: string;
  step_type: string;
  content_sent: string | null;
  ghl_message_id: string | null;
  delivered: boolean;
  opened: boolean;
  clicked: boolean;
  responded: boolean;
  confirmed_by: string | null;
  confirmed_at: string | null;
  executed_at: string | null;
  delivery_data: Record<string, unknown> | null;
  created_at: string;
}

/** A/B test comparing two variants of a step or workflow */
export interface WorkflowABTest {
  id: string;
  workflow_id: string;
  test_type: ABTestType;
  variant_a_step_id: string | null;
  variant_b_step_id: string | null;
  variant_a_version_id: string | null;
  variant_b_version_id: string | null;
  min_sample_size: number;
  variant_a_count: number;
  variant_b_count: number;
  variant_a_metric: number | null;
  variant_b_metric: number | null;
  winner: ABTestWinner | null;
  winner_explanation: string | null;
  status: ABTestStatus;
  created_by: string;
  declared_by: string | null;
  created_at: string;
  completed_at: string | null;
}

/** Approval queue entry for workflow changes */
export interface WorkflowApproval {
  id: string;
  workflow_id: string;
  workflow_version_id: string | null;
  ab_test_id: string | null;
  approval_type: ApprovalType;
  submitted_by: string;
  approved_by: string | null;
  status: ApprovalStatus;
  notes: string | null;
  submitted_at: string;
  resolved_at: string | null;
}

// ═══════════════════════════════════════════════════════
// Insert types (omit server-generated fields)
// ═══════════════════════════════════════════════════════

export type WorkflowInsert = Omit<Workflow, "id" | "created_at" | "updated_at" | "active_enrollee_count"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
  active_enrollee_count?: number;
};

export type WorkflowVersionInsert = Omit<WorkflowVersion, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

export type WorkflowStepInsert = Omit<
  WorkflowStep,
  "id" | "created_at" | "performance_status" | "open_rate" | "click_rate" | "response_rate"
> & {
  id?: string;
  created_at?: string;
  performance_status?: StepPerformanceStatus;
  open_rate?: number | null;
  click_rate?: number | null;
  response_rate?: number | null;
};

export type WorkflowEnrollmentInsert = Omit<
  WorkflowEnrollment,
  "id" | "enrolled_at" | "current_day" | "goal_achieved"
> & {
  id?: string;
  enrolled_at?: string;
  current_day?: number;
  goal_achieved?: boolean;
};

export type WorkflowStepLogInsert = Omit<
  WorkflowStepLog,
  "id" | "created_at" | "delivered" | "opened" | "clicked" | "responded"
> & {
  id?: string;
  created_at?: string;
  delivered?: boolean;
  opened?: boolean;
  clicked?: boolean;
  responded?: boolean;
};

export type WorkflowABTestInsert = Omit<WorkflowABTest, "id" | "created_at" | "variant_a_count" | "variant_b_count"> & {
  id?: string;
  created_at?: string;
  variant_a_count?: number;
  variant_b_count?: number;
};

export type WorkflowApprovalInsert = Omit<WorkflowApproval, "id" | "submitted_at"> & {
  id?: string;
  submitted_at?: string;
};
