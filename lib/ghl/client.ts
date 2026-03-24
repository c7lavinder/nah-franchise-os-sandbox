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
  GHLOpportunity,
  GHLOpportunitySearchParams,
  GHLOpportunityUpdatePayload,
  GHLTask,
  GHLTaskCreatePayload,
  GHLTaskUpdatePayload,
  GHLAppointment,
  GHLAppointmentCreatePayload,
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

/** Maximum retries for rate-limited (429) requests */
const MAX_RETRIES = 3;

/** Makes an authenticated request to the GHL API with 429 retry + exponential backoff */
async function ghlFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${GHL_BASE_URL}${endpoint}`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...getHeaders(),
        ...(options.headers ?? {}),
      },
    });

    if (response.status === 429 && attempt < MAX_RETRIES) {
      const retryAfter = response.headers.get("retry-after");
      const delayMs = retryAfter
        ? parseInt(retryAfter, 10) * 1000
        : Math.min(1000 * Math.pow(2, attempt), 10000);
      console.warn(`GHL rate limited on ${endpoint} — retrying in ${delayMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      continue;
    }

    if (!response.ok) {
      const errorBody = await response.text();
      throw new GHLError(response.status, errorBody, endpoint);
    }

    return response.json() as Promise<T>;
  }

  throw new GHLError(429, "Rate limit exceeded after max retries", endpoint);
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

/** Get the activity/message history for a contact */
export async function getContactHistory(
  contactId: string
): Promise<GHLMessage[]> {
  const data = await ghlFetch<{ messages: GHLMessage[] }>(
    `/conversations/search?contactId=${contactId}&locationId=${getLocationId()}`
  );
  return data.messages;
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

/** Move a lead to a different pipeline stage */
export async function movePipelineStage(
  opportunityId: string,
  stageId: string
): Promise<GHLOpportunity> {
  const data = await ghlFetch<{ opportunity: GHLOpportunity }>(
    `/opportunities/${opportunityId}`,
    {
      method: "PUT",
      body: JSON.stringify({ stageId } satisfies GHLOpportunityUpdatePayload),
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

/** Create an appointment / calendar event */
export async function createAppointment(
  appointment: GHLAppointmentCreatePayload
): Promise<GHLAppointment> {
  const locationId = getLocationId();
  const data = await ghlFetch<{ event: GHLAppointment }>(
    `/calendars/events`,
    {
      method: "POST",
      body: JSON.stringify({ ...appointment, locationId }),
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

/** Send an SMS or email message through GHL */
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
