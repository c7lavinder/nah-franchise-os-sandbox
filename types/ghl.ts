/** GoHighLevel API types — typed interfaces for all GHL data structures */

/** GHL Contact record */
export interface GHLContact {
  id: string;
  locationId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  tags: string[];
  source: string | null;
  dateAdded: string;
  customFields: GHLCustomField[];
  assignedTo: string | null;
}

/** GHL custom field on a contact */
export interface GHLCustomField {
  id: string;
  value: string;
}

/** GHL Contact search parameters */
export interface GHLContactSearchParams {
  query: string;
  limit?: number;
}

/** GHL Contact update payload */
export interface GHLContactUpdatePayload {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  tags?: string[];
  customFields?: GHLCustomField[];
}

/** GHL Pipeline */
export interface GHLPipeline {
  id: string;
  name: string;
  locationId: string;
  stages: GHLPipelineStage[];
}

/** GHL Pipeline Stage */
export interface GHLPipelineStage {
  id: string;
  name: string;
  position: number;
}

/** GHL Opportunity (a lead in a pipeline) */
export interface GHLOpportunity {
  id: string;
  name: string;
  pipelineId: string;
  pipelineStageId: string;
  status: "open" | "won" | "lost" | "abandoned";
  contactId: string;
  monetaryValue: number | null;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
}

/** GHL Opportunity search parameters */
export interface GHLOpportunitySearchParams {
  pipelineId?: string;
  stageId?: string;
  status?: "open" | "won" | "lost" | "abandoned";
  assignedTo?: string;
  limit?: number;
  startAfter?: string;
  startAfterId?: string;
}

/** GHL Opportunity update payload — uses pipelineStageId per connection map */
export interface GHLOpportunityUpdatePayload {
  pipelineStageId?: string;
  status?: "open" | "won" | "lost" | "abandoned";
  monetaryValue?: number;
  name?: string;
}

/** GHL Task */
export interface GHLTask {
  id: string;
  contactId: string;
  title: string;
  body: string | null;
  dueDate: string;
  assignedTo: string | null;
  completed: boolean;
}

/** GHL Task creation payload */
export interface GHLTaskCreatePayload {
  title: string;
  body?: string;
  dueDate: string;
  assignedTo?: string;
}

/** GHL Task update payload */
export interface GHLTaskUpdatePayload {
  title?: string;
  body?: string;
  dueDate?: string;
  completed?: boolean;
}

/** GHL Calendar Event / Appointment */
export interface GHLAppointment {
  id: string;
  calendarId: string;
  locationId: string;
  contactId: string;
  title: string;
  startTime: string;
  endTime: string;
  status: "confirmed" | "cancelled" | "no-show";
}

/** GHL Appointment creation payload — per connection map */
export interface GHLAppointmentCreatePayload {
  calendarId: string;
  contactId: string;
  title: string;
  startTime: string;
  endTime: string;
  appointmentStatus?: "confirmed" | "cancelled" | "no-show";
  assignedUserId?: string;
}

/** GHL free slot response */
export interface GHLFreeSlot {
  startTime: string;
  endTime: string;
}

/** GHL Conversation (returned by search, contains conversationId) */
export interface GHLConversation {
  id: string;
  contactId: string;
  locationId: string;
  lastMessageDate: string | number;
  type: string;
  unreadCount?: number;
  starred?: boolean;
  assignedTo?: string | null;
  contactName?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  lastMessageType?: number;
  tags?: string[];
}

/** GHL Conversation search parameters */
export interface GHLConversationSearchParams {
  assignedTo?: string;
  unreadOnly?: boolean;
  limit?: number;
  lastId?: string;
}

/** GHL Conversation messages response */
export interface GHLConversationMessagesResponse {
  messages: GHLMessage[];
  nextPage: boolean;
  lastMessageId?: string;
}

/** GHL Conversation Message */
export interface GHLMessage {
  id: string;
  contactId: string;
  type: "SMS" | "Email" | number;
  direction: "inbound" | "outbound";
  body: string;
  subject?: string;
  dateAdded: string;
  messageType?: string;
  status?: string;
  attachments?: string[];
  from?: string;
  to?: string;
  emailMessageId?: string;
  threadId?: string;
  conversationId?: string;
  source?: string;
}

/** GHL Send SMS payload */
export interface GHLSendSMSPayload {
  type: "SMS";
  contactId: string;
  message: string;
}

/** GHL Send Email payload — per connection map requires html + emailFrom */
export interface GHLSendEmailPayload {
  type: "Email";
  contactId: string;
  html: string;
  subject: string;
  emailFrom: string;
  emailTo?: string;
  emailCc?: string[];
}

/** GHL Send Message payload — union of SMS and Email */
export type GHLSendMessagePayload = GHLSendSMSPayload | GHLSendEmailPayload;

/** GHL Workflow */
export interface GHLWorkflow {
  id: string;
  name: string;
  locationId: string;
  status: "active" | "draft";
}

/** GHL Contact Note */
export interface GHLNote {
  id: string;
  contactId: string;
  body: string;
  dateAdded: string;
}

/** GHL API response wrapper */
export interface GHLApiResponse<T> {
  data: T;
  meta?: {
    total: number;
    currentPage: number;
    nextPage: number | null;
  };
}

/** GHL Contact upsert payload — creates or updates based on email/phone match */
export interface GHLContactUpsertPayload {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  source?: string;
  tags?: string[];
  customFields?: GHLCustomField[];
  dnd?: boolean;
}

/** GHL Opportunity creation payload */
export interface GHLOpportunityCreatePayload {
  pipelineId: string;
  name: string;
  pipelineStageId: string;
  status: "open" | "won" | "lost" | "abandoned";
  contactId: string;
  monetaryValue?: number;
  assignedTo?: string;
  source?: string;
  customFields?: GHLCustomField[];
}

/** GHL API error */
export interface GHLApiError {
  statusCode: number;
  message: string;
  error: string;
}
