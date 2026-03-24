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
  GHLConversation,
  GHLOpportunity,
  GHLOpportunitySearchParams,
  GHLTask,
  GHLTaskCreatePayload,
  GHLTaskUpdatePayload,
  GHLAppointment,
  GHLAppointmentCreatePayload,
  GHLFreeSlot,
  GHLSendMessagePayload,
  GHLMessage,
  GHLNote,
  GHLPipeline,
  GHLWorkflow,
} from "@/types/ghl";

const GHL_BASE_URL = "https://services.leadconnectorhq.com";

/** Builds authorization headers for GHL API calls */
function getHeaders(): HeadersInit {
  const apiKey = process.env.GHL_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GHL_API_KEY environment variable");
  }
  return {
    Authorization: `Bearer ${apiKey}`,
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

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...getHeaders(),
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

    // 401 — token expired. When OAuth is wired, refresh here and retry once.
    // For now with PIT key, 401 means wrong key — no point retrying.
    if (response.status === 401) {
      const errorBody = await response.text();
      // Future: await refreshOAuthToken(); attempt = 0; continue;
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
  const msgData = await ghlFetch<{ messages: GHLMessage[] }>(
    `/conversations/${conversationId}/messages`
  );

  return msgData.messages ?? [];
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
