/**
 * GoHighLevel API client — centralized layer for all GHL communication.
 * All GHL calls must go through this client. Never call GHL directly from components.
 *
 * Handles: authentication headers, rate limit awareness, error normalization.
 *
 * Reference: ghl-masterclass/knowledge/ghl-connection-map.md
 * Contains the full GHL API endpoint map, auth patterns, and webhook architecture.
 */

import { createServerClient } from "@/lib/supabase/server";
import type {
  GHLContact,
  GHLContactSearchParams,
  GHLContactUpdatePayload,
  GHLContactUpsertPayload,
  GHLConversation,
  GHLConversationSearchParams,
  GHLOpportunity,
  GHLOpportunitySearchParams,
  GHLOpportunityCreatePayload,
  GHLTask,
  GHLTaskCreatePayload,
  GHLTaskUpdatePayload,
  GHLAppointment,
  GHLAppointmentCreatePayload,
  GHLCalendar,
  GHLFreeSlot,
  GHLSendMessagePayload,
  GHLMessage,
  GHLNote,
  GHLPipeline,
  GHLWorkflow,
} from "@/types/ghl";

const GHL_BASE_URL = "https://services.leadconnectorhq.com";

/**
 * Gets the best available auth token.
 * Priority: OAuth token from Supabase → static PIT key from env.
 * If OAuth token is expired, refreshes it automatically.
 */
async function getAccessToken(): Promise<string> {
  // Try OAuth token first
  try {
    const supabase = createServerClient();
    const { data: tokenRow } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "ghl_access_token")
      .single();

    if (tokenRow?.setting_value) {
      const token = JSON.parse(tokenRow.setting_value) as string;

      // Check if expired
      const { data: expiresRow } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "ghl_token_expires_at")
        .single();

      const expiresAt = expiresRow?.setting_value
        ? new Date(JSON.parse(expiresRow.setting_value) as string)
        : null;

      // If token is still valid (with 5 min buffer), use it
      if (expiresAt && expiresAt.getTime() > Date.now() + 5 * 60 * 1000) {
        return token;
      }

      // Token expired — try to refresh
      const refreshed = await refreshOAuthToken();
      if (refreshed) return refreshed;
    }
  } catch {
    // OAuth lookup failed — fall through to PIT key
  }

  // Fallback to static PIT key
  const apiKey = process.env.GHL_API_KEY;
  if (!apiKey) {
    throw new Error("No GHL auth available — set GHL_API_KEY or connect OAuth at /api/auth/crm");
  }
  return apiKey;
}

/** Refreshes the OAuth token using the stored refresh token */
async function refreshOAuthToken(): Promise<string | null> {
  try {
    const supabase = createServerClient();
    const { data: refreshRow } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "ghl_refresh_token")
      .single();

    if (!refreshRow?.setting_value) return null;

    const refreshToken = JSON.parse(refreshRow.setting_value) as string;
    const clientId = process.env.GHL_CLIENT_ID;
    const clientSecret = process.env.GHL_CLIENT_SECRET;

    if (!clientId || !clientSecret) return null;

    const response = await fetch("https://services.leadconnectorhq.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }).toString(),
    });

    if (!response.ok) {
      console.error("GHL token refresh failed:", response.status);
      return null;
    }

    const data = await response.json();
    const expiresAt = new Date(Date.now() + (data.expires_in ?? 86400) * 1000).toISOString();

    // Store new tokens — refresh token is single-use, must store the new one
    await supabase.from("app_settings").upsert(
      { setting_key: "ghl_access_token", setting_value: JSON.stringify(data.access_token) },
      { onConflict: "setting_key" }
    );
    await supabase.from("app_settings").upsert(
      { setting_key: "ghl_refresh_token", setting_value: JSON.stringify(data.refresh_token) },
      { onConflict: "setting_key" }
    );
    await supabase.from("app_settings").upsert(
      { setting_key: "ghl_token_expires_at", setting_value: JSON.stringify(expiresAt) },
      { onConflict: "setting_key" }
    );

    console.log("GHL OAuth token refreshed, expires at:", expiresAt);
    return data.access_token;
  } catch (err) {
    console.error("GHL token refresh error:", err);
    return null;
  }
}

/** Builds authorization headers for GHL API calls */
async function getHeaders(): Promise<HeadersInit> {
  const token = await getAccessToken();
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Version: "2021-07-28",
  };
}

/** Returns the GHL location ID from environment */
function getLocationId(): string {
  const locationId = process.env.GHL_LOCATION_ID;
  if (!locationId) {
    throw new Error("Missing GHL_LOCATION_ID environment variable");
  }
  return locationId;
}

/** Normalized GHL error for consistent handling upstream */
export class GHLError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public endpoint: string
  ) {
    super(`GHL API Error (${statusCode}) on ${endpoint}: ${message}`);
    this.name = "GHLError";
  }
}

/** Maximum retries for retryable errors (429, 401, 5xx) */
const MAX_RETRIES = 3;

/**
 * Makes an authenticated request to the GHL API.
 * Handles retries per ghl-masterclass/patterns/error-handling.md:
 * - 429: exponential backoff, respects Retry-After header
 * - 401: refresh OAuth token and retry once (when OAuth is wired)
 * - 5xx: retry up to 3 times with backoff
 * - 400/422: do not retry (bad request)
 */
async function ghlFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${GHL_BASE_URL}${endpoint}`;
  let lastError: GHLError | null = null;

  const authHeaders = await getHeaders() as Record<string, string>;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...authHeaders,
        ...(options.headers ?? {}),
      },
    });

    // 429 — rate limited, backoff and retry
    if (response.status === 429 && attempt < MAX_RETRIES) {
      const retryAfter = response.headers.get("retry-after");
      const delayMs = retryAfter
        ? parseInt(retryAfter, 10) * 1000
        : Math.min(1000 * Math.pow(2, attempt), 10000);
      console.warn(`GHL 429 on ${endpoint} — retry in ${delayMs}ms (${attempt + 1}/${MAX_RETRIES})`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      continue;
    }

    // 401 — token expired. Try refreshing OAuth token and retry once.
    if (response.status === 401 && attempt === 0) {
      const refreshed = await refreshOAuthToken();
      if (refreshed) {
        // Update headers with new token and retry
        authHeaders.Authorization = `Bearer ${refreshed}`;
        console.warn(`GHL 401 on ${endpoint} — token refreshed, retrying`);
        continue;
      }
      const errorBody = await response.text();
      throw new GHLError(401, errorBody, endpoint);
    } else if (response.status === 401) {
      const errorBody = await response.text();
      throw new GHLError(401, errorBody, endpoint);
    }

    // 5xx — server error, retry with backoff
    if (response.status >= 500 && attempt < MAX_RETRIES) {
      const delayMs = Math.min(1000 * Math.pow(2, attempt), 10000);
      console.warn(`GHL ${response.status} on ${endpoint} — retry in ${delayMs}ms (${attempt + 1}/${MAX_RETRIES})`);
      lastError = new GHLError(response.status, await response.text(), endpoint);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      continue;
    }

    // 400/422 — bad request, do not retry
    if (!response.ok) {
      const errorBody = await response.text();
      throw new GHLError(response.status, errorBody, endpoint);
    }

    return response.json() as Promise<T>;
  }

  throw lastError ?? new GHLError(429, "Rate limit exceeded after max retries", endpoint);
}

// ========================================
// CONTACTS
// ========================================

/** Fetch a single contact by ID */
export async function getContact(contactId: string): Promise<GHLContact> {
  const data = await ghlFetch<{ contact: GHLContact }>(
    `/contacts/${contactId}`
  );
  return data.contact;
}

/** Update a contact's fields */
export async function updateContact(
  contactId: string,
  fields: GHLContactUpdatePayload
): Promise<GHLContact> {
  const data = await ghlFetch<{ contact: GHLContact }>(
    `/contacts/${contactId}`,
    {
      method: "PUT",
      body: JSON.stringify(fields),
    }
  );
  return data.contact;
}

/** Search contacts by name, email, or phone — uses GET with query params per GHL v2 API */
export async function searchContacts(
  params: GHLContactSearchParams
): Promise<GHLContact[]> {
  const locationId = getLocationId();
  const limit = params.limit ?? 10;
  const query = encodeURIComponent(params.query);
  const data = await ghlFetch<{ contacts: GHLContact[] }>(
    `/contacts/?locationId=${locationId}&query=${query}&limit=${limit}`
  );
  return data.contacts;
}

/**
 * Create or update a contact via upsert.
 * GHL deduplicates by email or phone — if a match is found, updates; otherwise creates.
 * Returns the contact and whether it was newly created.
 */
export async function upsertContact(
  fields: GHLContactUpsertPayload
): Promise<{ contact: GHLContact; new: boolean }> {
  const locationId = getLocationId();
  const data = await ghlFetch<{ contact: GHLContact; new: boolean }>(
    `/contacts/upsert`,
    {
      method: "POST",
      body: JSON.stringify({ ...fields, locationId }),
    }
  );
  return { contact: data.contact, new: data.new };
}

/**
 * Count contacts matching a filter using POST /contacts/search.
 * Returns just the total count — uses pageLimit=1 to minimize data transfer.
 */
export async function countContactsByFilter(
  filters: { field: string; operator: string; value: string }[]
): Promise<number> {
  const locationId = getLocationId();
  const data = await ghlFetch<{ total?: number; meta?: { total?: number }; contacts?: unknown[] }>(
    `/contacts/search`,
    {
      method: "POST",
      body: JSON.stringify({
        locationId,
        pageLimit: 1,
        filters,
      }),
    }
  );
  return data.total ?? data.meta?.total ?? data.contacts?.length ?? 0;
}

/**
 * Count opportunities by status. Uses limit=1 and reads meta.total for efficiency.
 */
export async function countOpportunitiesByStatus(
  status: "open" | "won" | "lost" | "abandoned",
  pipelineId?: string
): Promise<number> {
  const locationId = getLocationId();
  const queryParts = [`location_id=${locationId}`, `status=${status}`, `limit=1`];
  if (pipelineId) queryParts.push(`pipeline_id=${pipelineId}`);

  const data = await ghlFetch<{ meta?: { total?: number }; opportunities?: unknown[] }>(
    `/opportunities/search?${queryParts.join("&")}`
  );
  return data.meta?.total ?? data.opportunities?.length ?? 0;
}

/**
 * Get the message history for a contact.
 * Per connection map: 2-step process —
 * Step 1: GET /conversations/search to find the conversationId
 * Step 2: GET /conversations/:conversationId/messages to get messages
 */
export async function getContactHistory(
  contactId: string
): Promise<GHLMessage[]> {
  // Step 1: find the conversation for this contact
  const convData = await ghlFetch<{ conversations: GHLConversation[] }>(
    `/conversations/search?contactId=${contactId}&locationId=${getLocationId()}`
  );

  if (!convData.conversations || convData.conversations.length === 0) {
    return [];
  }

  const conversationId = convData.conversations[0].id;

  // Step 2: get the actual messages from that conversation
  // GHL nests messages: { messages: { messages: [...] } }
  const msgData = await ghlFetch<{ messages: { messages?: GHLMessage[] } | GHLMessage[] }>(
    `/conversations/${conversationId}/messages`
  );

  // Handle both possible shapes
  if (Array.isArray(msgData.messages)) {
    return msgData.messages;
  }
  return msgData.messages?.messages ?? [];
}

// ========================================
// PIPELINE / OPPORTUNITIES
// ========================================

/** Get all pipelines for the location */
export async function getPipelines(): Promise<GHLPipeline[]> {
  const data = await ghlFetch<{ pipelines: GHLPipeline[] }>(
    `/opportunities/pipelines?locationId=${getLocationId()}`
  );
  return data.pipelines;
}

/**
 * Look up a GHL stage ID by its human-readable name.
 * Scout passes stage names (e.g., "Discovery Complete") not IDs.
 * Queries the ghl_pipeline_stages cache table in Supabase.
 */
export async function getStageIdByName(stageName: string): Promise<string> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("ghl_pipeline_stages")
    .select("stage_id")
    .ilike("stage_name", stageName)
    .limit(1)
    .single();

  if (error || !data) {
    throw new GHLError(
      404,
      `Stage "${stageName}" not found in ghl_pipeline_stages table. Run a pipeline sync first.`,
      "getStageIdByName"
    );
  }

  return data.stage_id;
}

/** Search opportunities (leads in the pipeline) — uses GET with query params per GHL v2 API */
export async function searchOpportunities(
  params: GHLOpportunitySearchParams
): Promise<GHLOpportunity[]> {
  const locationId = getLocationId();
  const queryParts = [`location_id=${locationId}`];
  if (params.pipelineId) queryParts.push(`pipeline_id=${params.pipelineId}`);
  if (params.stageId) queryParts.push(`pipeline_stage_id=${params.stageId}`);
  if (params.status) queryParts.push(`status=${params.status}`);
  if (params.assignedTo) queryParts.push(`assigned_to=${params.assignedTo}`);
  if (params.limit) queryParts.push(`limit=${params.limit}`);

  const data = await ghlFetch<{ opportunities: GHLOpportunity[] }>(
    `/opportunities/search?${queryParts.join("&")}`
  );
  return data.opportunities;
}

/**
 * Fetch ALL opportunities for a pipeline with cursor pagination.
 * GHL limits to 100 per request — this follows the cursor until all results are fetched.
 * Safety cap at 2,000 results.
 */
export async function searchOpportunitiesPaginated(
  params: GHLOpportunitySearchParams
): Promise<GHLOpportunity[]> {
  const all: GHLOpportunity[] = [];
  const MAX_RESULTS = 2000;
  let hasMore = true;
  let startAfterId: string | undefined;
  let startAfter: string | undefined;

  while (hasMore && all.length < MAX_RESULTS) {
    const pageParams: GHLOpportunitySearchParams = {
      ...params,
      limit: 100,
    };
    if (startAfterId) {
      pageParams.startAfterId = startAfterId;
      pageParams.startAfter = startAfter;
    }

    const locationId = getLocationId();
    const queryParts = [`location_id=${locationId}`, `limit=100`];
    if (pageParams.pipelineId) queryParts.push(`pipeline_id=${pageParams.pipelineId}`);
    if (pageParams.stageId) queryParts.push(`pipeline_stage_id=${pageParams.stageId}`);
    if (pageParams.status) queryParts.push(`status=${pageParams.status}`);
    if (pageParams.assignedTo) queryParts.push(`assigned_to=${pageParams.assignedTo}`);
    if (pageParams.startAfterId) queryParts.push(`startAfterId=${pageParams.startAfterId}`);
    if (pageParams.startAfter) queryParts.push(`startAfter=${pageParams.startAfter}`);

    const data = await ghlFetch<{
      opportunities: GHLOpportunity[];
      meta?: { startAfterId?: string; startAfter?: string; total?: number };
    }>(`/opportunities/search?${queryParts.join("&")}`);

    const page = data.opportunities ?? [];
    all.push(...page);

    if (page.length < 100 || !data.meta?.startAfterId) {
      hasMore = false;
    } else {
      startAfterId = data.meta.startAfterId;
      startAfter = data.meta.startAfter;
    }
  }

  return all;
}

/** Move a lead to a different pipeline stage — uses { pipelineStageId } per connection map */
export async function movePipelineStage(
  opportunityId: string,
  stageId: string
): Promise<GHLOpportunity> {
  const data = await ghlFetch<{ opportunity: GHLOpportunity }>(
    `/opportunities/${opportunityId}`,
    {
      method: "PUT",
      body: JSON.stringify({ pipelineStageId: stageId }),
    }
  );
  return data.opportunity;
}

/** Create a new opportunity in a pipeline */
export async function createOpportunity(
  fields: GHLOpportunityCreatePayload
): Promise<GHLOpportunity> {
  const locationId = getLocationId();
  const data = await ghlFetch<{ opportunity: GHLOpportunity }>(
    `/opportunities/`,
    {
      method: "POST",
      body: JSON.stringify({ ...fields, locationId }),
    }
  );
  return data.opportunity;
}

// ========================================
// TASKS
// ========================================

/** Get all tasks for a contact */
export async function getTasks(contactId: string): Promise<GHLTask[]> {
  const data = await ghlFetch<{ tasks: GHLTask[] }>(
    `/contacts/${contactId}/tasks`
  );
  return data.tasks;
}

/** Create a new task on a contact */
export async function createTask(
  contactId: string,
  task: GHLTaskCreatePayload
): Promise<GHLTask> {
  const data = await ghlFetch<{ task: GHLTask }>(
    `/contacts/${contactId}/tasks`,
    {
      method: "POST",
      body: JSON.stringify(task),
    }
  );
  return data.task;
}

/** Update a task (e.g., mark as completed) */
export async function updateTask(
  contactId: string,
  taskId: string,
  updates: GHLTaskUpdatePayload
): Promise<GHLTask> {
  const data = await ghlFetch<{ task: GHLTask }>(
    `/contacts/${contactId}/tasks/${taskId}`,
    {
      method: "PUT",
      body: JSON.stringify(updates),
    }
  );
  return data.task;
}

// ========================================
// APPOINTMENTS
// ========================================

/**
 * List all calendars in the location.
 * Used to populate calendar selection dropdowns and to let Scout
 * suggest a calendar by name match.
 */
export async function getCalendars(): Promise<GHLCalendar[]> {
  const locationId = getLocationId();
  const data = await ghlFetch<{ calendars: GHLCalendar[] }>(
    `/calendars/?locationId=${locationId}`
  );
  return data.calendars ?? [];
}

/**
 * Get free slots for a calendar.
 * Per connection map: check availability before booking.
 */
export async function getCalendarFreeSlots(
  calendarId: string,
  startDate: string,
  endDate: string,
  timezone: string = "America/New_York"
): Promise<GHLFreeSlot[]> {
  const startUnix = Math.floor(new Date(startDate).getTime() / 1000);
  const endUnix = Math.floor(new Date(endDate).getTime() / 1000);
  const data = await ghlFetch<{ slots: GHLFreeSlot[] }>(
    `/calendars/${calendarId}/free-slots?startDate=${startUnix}&endDate=${endUnix}&timezone=${timezone}`
  );
  return data.slots ?? [];
}

/**
 * Create an appointment / calendar event.
 * Per connection map: includes appointmentStatus and assignedUserId.
 */
export async function createAppointment(
  appointment: GHLAppointmentCreatePayload
): Promise<GHLAppointment> {
  const locationId = getLocationId();
  const data = await ghlFetch<{ event: GHLAppointment }>(
    `/calendars/events`,
    {
      method: "POST",
      body: JSON.stringify({
        ...appointment,
        locationId,
        appointmentStatus: appointment.appointmentStatus ?? "confirmed",
      }),
    }
  );
  return data.event;
}

/** Get appointments within a time range */
export async function getAppointments(
  startTime: string,
  endTime: string,
  calendarId?: string
): Promise<GHLAppointment[]> {
  const locationId = getLocationId();
  let url = `/calendars/events?locationId=${locationId}&startTime=${startTime}&endTime=${endTime}`;
  if (calendarId) {
    url += `&calendarId=${calendarId}`;
  }
  const data = await ghlFetch<{ events: GHLAppointment[] }>(url);
  return data.events;
}

// ========================================
// INBOX / CONVERSATIONS
// ========================================

/** Search conversations (inbox view). Returns conversations sorted by most recent. */
export async function getConversations(
  params?: GHLConversationSearchParams
): Promise<GHLConversation[]> {
  const locationId = getLocationId();
  const queryParts = [`locationId=${locationId}`, `sortDirection=desc`];
  if (params?.assignedTo) queryParts.push(`assignedTo=${params.assignedTo}`);
  if (params?.unreadOnly) queryParts.push(`unreadOnly=true`);
  if (params?.limit) queryParts.push(`limit=${params.limit}`);
  if (params?.lastId) queryParts.push(`lastId=${params.lastId}`);

  const data = await ghlFetch<{ conversations: GHLConversation[] }>(
    `/conversations/search?${queryParts.join("&")}`
  );
  return data.conversations ?? [];
}

/** Get messages for a specific conversation with pagination. */
export async function getConversationMessages(
  conversationId: string,
  options?: { limit?: number; lastMessageId?: string }
): Promise<{ messages: GHLMessage[]; nextPage: boolean; lastMessageId?: string }> {
  const queryParts: string[] = [];
  if (options?.limit) queryParts.push(`limit=${options.limit}`);
  if (options?.lastMessageId) queryParts.push(`lastMessageId=${options.lastMessageId}`);

  const qs = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
  const data = await ghlFetch<{
    messages: { messages?: GHLMessage[]; nextPage?: boolean; lastMessageId?: string } | GHLMessage[];
  }>(`/conversations/${conversationId}/messages${qs}`);

  // Handle nested or flat response shape
  if (Array.isArray(data.messages)) {
    return { messages: data.messages, nextPage: false };
  }
  return {
    messages: data.messages?.messages ?? [],
    nextPage: data.messages?.nextPage ?? false,
    lastMessageId: data.messages?.lastMessageId,
  };
}

/** Mark a conversation as read by setting unreadCount to 0. */
export async function markConversationRead(
  conversationId: string
): Promise<GHLConversation> {
  const data = await ghlFetch<{ conversation: GHLConversation }>(
    `/conversations/${conversationId}`,
    {
      method: "PUT",
      body: JSON.stringify({ unreadCount: 0 }),
    }
  );
  return data.conversation;
}

/** Get the recording URL for a call message. */
export async function getCallRecording(messageId: string): Promise<string | null> {
  try {
    const data = await ghlFetch<{ url?: string; recording?: string }>(
      `/conversations/messages/${messageId}/recording`
    );
    return data.url ?? data.recording ?? null;
  } catch {
    return null;
  }
}

/** Get the transcription for a call message. */
export async function getCallTranscription(messageId: string): Promise<string | null> {
  try {
    const data = await ghlFetch<{ transcription?: string; text?: string }>(
      `/conversations/messages/${messageId}/transcription`
    );
    return data.transcription ?? data.text ?? null;
  } catch {
    return null;
  }
}

// ========================================
// MESSAGING
// ========================================

/**
 * Send an SMS or email message through GHL.
 * Per connection map:
 * - SMS: { type: "SMS", contactId, message }
 * - Email: { type: "Email", contactId, html, subject, emailFrom }
 * Types enforce correct fields for each.
 */
export async function sendMessage(
  payload: GHLSendMessagePayload
): Promise<GHLMessage> {
  const data = await ghlFetch<{ message: GHLMessage }>(
    `/conversations/messages`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
  return data.message;
}

// ========================================
// AUTOMATIONS / WORKFLOWS
// ========================================

/** Get all workflows for the location */
export async function getWorkflows(): Promise<GHLWorkflow[]> {
  const data = await ghlFetch<{ workflows: GHLWorkflow[] }>(
    `/workflows/?locationId=${getLocationId()}`
  );
  return data.workflows;
}

/**
 * Trigger a workflow via inbound webhook.
 * Looks up the webhook URL from the ghl_workflows table by name,
 * then POSTs the contact data to that URL.
 * This replaces the old startAutomation() which used the deprecated
 * direct workflow enrollment endpoint.
 */
export async function triggerWorkflow(
  contactId: string,
  workflowName: string
): Promise<void> {
  const supabase = createServerClient();
  const { data: workflow, error } = await supabase
    .from("ghl_workflows")
    .select("webhook_url")
    .eq("name", workflowName)
    .eq("is_active", true)
    .single();

  if (error || !workflow) {
    throw new GHLError(404, `Workflow "${workflowName}" not found in ghl_workflows table`, "triggerWorkflow");
  }

  const response = await fetch(workflow.webhook_url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contactId,
      locationId: getLocationId(),
      workflowName,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new GHLError(response.status, errorBody, `webhook:${workflowName}`);
  }
}

// ========================================
// CUSTOM FIELD DEFINITIONS
// ========================================

/** Shape of a custom field definition returned by the GHL API */
export interface GHLCustomFieldDefinition {
  id: string;
  name: string;
  fieldKey?: string;
  dataType?: string;
  type?: string;
  model?: string;
  options?: string[];
}

/** Fetch all custom field definitions for the location (uses ghlFetch with retry) */
export async function getCustomFieldDefinitions(): Promise<GHLCustomFieldDefinition[]> {
  const locationId = getLocationId();
  const data = await ghlFetch<{ customFields: GHLCustomFieldDefinition[] }>(
    `/locations/${locationId}/customFields`
  );
  return data.customFields ?? [];
}

// ========================================
// NOTES
// ========================================

/** Get all notes for a contact */
export async function getNotes(contactId: string): Promise<GHLNote[]> {
  const data = await ghlFetch<{ notes: GHLNote[] }>(
    `/contacts/${contactId}/notes`
  );
  return data.notes;
}

/** Add a note to a contact */
export async function addNote(
  contactId: string,
  body: string
): Promise<GHLNote> {
  const data = await ghlFetch<{ note: GHLNote }>(
    `/contacts/${contactId}/notes`,
    {
      method: "POST",
      body: JSON.stringify({ body }),
    }
  );
  return data.note;
}
