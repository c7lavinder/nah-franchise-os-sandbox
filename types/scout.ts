/** Scout AI types — tool definitions, message types, and action drafts */

/** Scout tool names matching the Claude tool-use definitions */
export type ScoutToolName =
  // General-purpose data primitives (subsume the bespoke read tools)
  | "get_entity"
  | "query"
  | "aggregate"
  // Specialized read tools that are not just data fetches
  | "search_contacts"
  | "get_pipeline"
  | "get_next_action"
  | "get_schedule"
  | "get_contact_insights"
  | "get_tasks"
  | "complete_task"
  | "search_knowledge"
  | "workflow_analyze"
  | "workflow_rewrite"
  | "trainual_status"
  // Draft tools — all gated by user confirmation
  | "draft_message"
  | "draft_task"
  | "draft_stage_move"
  | "draft_profile_update"
  | "draft_eos_update"
  | "draft_market_data_update"
  | "draft_journey_action"
  | "draft_appointment"
  | "draft_note"
  | "draft_trigger_workflow"
  | "draft_knowledge_doc"
  | "draft_sub_task_log"
  | "get_compliance"
  | "draft_compliance_update";

/** Chat message role */
export type ChatRole = "user" | "assistant";

/** A message in the Scout chat interface */
export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: string;
  /** If this message includes a drafted action for the user to confirm (backward compat) */
  draftedAction?: DraftedAction;
  /** All drafted actions for batch operations */
  draftedActions?: DraftedAction[];
}

/** Types of actions Scout can draft for user confirmation */
export type DraftedActionType =
  | "message"
  | "task"
  | "stage_move"
  | "appointment"
  | "profile_update"
  | "eos_update"
  | "market_data_update"
  | "journey_action"
  | "note"
  | "trigger_workflow"
  | "sub_task_log"
  | "compliance_update";

/** Status of a drafted action in the UI */
export type DraftedActionStatus = "pending" | "editing" | "confirmed" | "cancelled";

/** A drafted action from Scout awaiting user confirmation */
export interface DraftedAction {
  id: string;
  type: DraftedActionType;
  status: DraftedActionStatus;
  contactId: string;
  contactName: string;
  /** The specific payload depends on the action type */
  payload:
    | DraftedMessagePayload
    | DraftedTaskPayload
    | DraftedStageMovePayload
    | DraftedAppointmentPayload
    | DraftedProfileUpdatePayload
    | DraftedEosUpdatePayload
    | DraftedMarketDataUpdatePayload
    | DraftedJourneyActionPayload
    | DraftedNotePayload
    | DraftedTriggerWorkflowPayload
    | DraftedSubTaskLogPayload
    | DraftedComplianceUpdatePayload;
  /** Human-readable summary of what this action does */
  summary?: string;
}

/** Payload for a drafted SMS or email message */
export interface DraftedMessagePayload {
  actionType: "message";
  channel: "SMS" | "Email";
  content: string;
  subject?: string;
  /** Destination phone number (SMS) or email address (Email) */
  toAddress?: string;
  /** Sender phone number (SMS) or email address (Email) */
  fromAddress?: string;
  /** Sender display name (UI only) */
  fromName?: string;
  /** ISO 8601 scheduled send time — null means send immediately */
  scheduledAt?: string | null;
}

/** Payload for a drafted task */
export interface DraftedTaskPayload {
  actionType: "task";
  title: string;
  description?: string;
  dueDate: string;
  /** GHL user ID of the person assigned to this task */
  assignedTo?: string;
  /** Display name for the assigned user (UI only) */
  assignedToName?: string;
}

/** Payload for a drafted pipeline stage move */
export interface DraftedStageMovePayload {
  actionType: "stage_move";
  /** Current pipeline name (display) */
  currentPipeline?: string;
  /** Current pipeline ID */
  currentPipelineId?: string;
  currentStage: string;
  /** Target pipeline name — if different, this is a cross-pipeline move */
  newPipeline?: string;
  /** Target pipeline ID */
  newPipelineId?: string;
  newStage: string;
  reason?: string;
}

/** Payload for a drafted appointment / calendar event */
export interface DraftedAppointmentPayload {
  actionType: "appointment";
  /** Selected calendar ID — Scout suggests one; user can edit before pushing */
  calendarId: string;
  /** Display name of the suggested calendar */
  calendarName?: string;
  /** Why Scout picked this calendar (e.g. "matched 'Matt' in calendar name") */
  calendarReason?: string;
  title: string;
  /** ISO 8601 start time */
  startTime: string;
  /** ISO 8601 end time */
  endTime: string;
  /** Optional GHL user to assign as the host */
  assignedUserId?: string;
}

/** Payload for a drafted profile field update */
export interface DraftedProfileUpdatePayload {
  actionType: "profile_update";
  fields: { fieldName: string; value: string; reason: string }[];
}

/** Payload for a drafted EOS update (contact or territory) */
export interface DraftedEosUpdatePayload {
  actionType: "eos_update";
  entityType: "contact" | "territory";
  /** Contact ID (for contact EOS) or territory TerritorySlug (for territory EOS) */
  entityId: string;
  section: "goals" | "issues" | "todos" | "scorecard" | "budgets" | "habits" | "rocks" | "lead_channels";
  updates: { fieldName: string; value: string; reason: string }[];
}

/** Payload for a drafted territory market data update */
export interface DraftedMarketDataUpdatePayload {
  actionType: "market_data_update";
  territorySlug: string;
  territoryName: string;
  fields: { fieldName: string; value: string; reason: string }[];
}

/** Kinds of journey-level actions Scout can draft */
export type JourneyActionKind = "enroll_workflow" | "pause_workflow" | "resume_workflow" | "exit_workflow";

/**
 * Payload for a drafted journey action — workflow enrollment changes
 * scoped to a contact (enroll, pause, resume, exit).
 */
export interface DraftedJourneyActionPayload {
  actionType: "journey_action";
  kind: JourneyActionKind;
  /** Workflow ID — required for enroll_workflow */
  workflowId?: string;
  /** Workflow display name — for the UI */
  workflowName?: string;
  /** Enrollment ID — required for pause/resume/exit */
  enrollmentId?: string;
  /** Optional reason — required for exit */
  reason?: string;
}

/** Payload for a drafted GHL note on a contact */
export interface DraftedNotePayload {
  actionType: "note";
  body: string;
}

/**
 * Payload for a drafted GHL-native workflow trigger.
 * Distinct from journey_action — this fires a GHL workflow (campaign,
 * automation, drip) on a contact via `ghl.triggerWorkflow`. Used when
 * Scout wants to start a marketing or onboarding sequence whose logic
 * lives in GHL itself rather than in our workflow_enrollments table.
 */
export interface DraftedTriggerWorkflowPayload {
  actionType: "trigger_workflow";
  /** GHL workflow ID */
  workflowId: string;
  /** Display name from GHL */
  workflowName?: string;
}

/** Payload for a drafted sub-task log entry */
export interface DraftedSubTaskLogPayload {
  actionType: "sub_task_log";
  /** Sub-task ID */
  subTaskId: string;
  /** Sub-task display name (e.g., "NDA", "Matt Call") */
  subTaskName: string;
  /** Pipeline stage name for context */
  stageName?: string;
  /** "single" or "two_state" — drives stateAdvance field visibility */
  stateType: "single" | "two_state";
  /** First state label (e.g., "sent", "scheduled") */
  firstStateLabel?: string;
  /** Second state label (e.g., "signed", "completed") */
  secondStateLabel?: string;
  /** "first" or "second" for two_state, null for single */
  stateAdvance: "first" | "second" | null;
  /** Content type of the log entry */
  contentType: "note" | "file" | "link" | "transcript" | "appointment" | "email" | "sms" | "call";
  /** Text content for the log */
  contentText?: string;
  /** File URL for the log */
  contentFileUrl?: string;
  /** Link URL for the log */
  contentLinkUrl?: string;
  /** GHL user ID of the logger */
  loggerUserId?: string;
  /** Logger display name (UI only) */
  loggerName?: string;
}

/** Payload for a drafted compliance tracking update */
export interface DraftedComplianceUpdatePayload {
  actionType: "compliance_update";
  contactId: string;
  updates: Record<string, unknown>;
  reason?: string;
}

/** Request body sent to the Scout API */
export interface ScoutChatRequest {
  message: string;
  userId: string;
  sessionId: string;
}

/** Response from the Scout API */
export interface ScoutChatResponse {
  message: string;
  draftedAction?: DraftedAction;
  sessionId: string;
}

/** Scout tool definition for Claude's tool-use API */
export interface ScoutToolDefinition {
  name: ScoutToolName;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<
      string,
      {
        type: string;
        description: string;
        enum?: string[];
      }
    >;
    required: string[];
  };
}
