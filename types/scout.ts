/** Scout AI types — tool definitions, message types, and action drafts */

/** Scout tool names matching the Claude tool-use definitions */
export type ScoutToolName =
  | "get_contact"
  | "search_contacts"
  | "get_pipeline"
  | "get_profile"
  | "get_next_action"
  | "draft_message"
  | "draft_task"
  | "draft_stage_move"
  | "draft_profile_update"
  | "get_schedule"
  | "search_knowledge";

/** Chat message role */
export type ChatRole = "user" | "assistant";

/** A message in the Scout chat interface */
export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: string;
  /** If this message includes a drafted action for the user to confirm */
  draftedAction?: DraftedAction;
}

/** Types of actions Scout can draft for user confirmation */
export type DraftedActionType = "message" | "task" | "stage_move" | "appointment" | "profile_update";

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
  payload: DraftedMessagePayload | DraftedTaskPayload | DraftedStageMovePayload | DraftedAppointmentPayload | DraftedProfileUpdatePayload;
}

/** Payload for a drafted SMS or email message */
export interface DraftedMessagePayload {
  actionType: "message";
  channel: "SMS" | "Email";
  content: string;
  subject?: string;
}

/** Payload for a drafted task */
export interface DraftedTaskPayload {
  actionType: "task";
  title: string;
  description?: string;
  dueDate: string;
}

/** Payload for a drafted pipeline stage move */
export interface DraftedStageMovePayload {
  actionType: "stage_move";
  currentStage: string;
  newStage: string;
  reason?: string;
}

/** Payload for a drafted appointment */
export interface DraftedAppointmentPayload {
  actionType: "appointment";
  title: string;
  startTime: string;
  endTime: string;
  calendarId: string;
}

/** Payload for a drafted profile field update */
export interface DraftedProfileUpdatePayload {
  actionType: "profile_update";
  fields: { fieldName: string; value: string; reason: string }[];
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
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required: string[];
  };
}
