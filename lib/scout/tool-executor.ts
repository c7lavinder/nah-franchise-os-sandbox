/**
 * Scout tool executor — runs tool calls from Claude against GHL and the knowledge base.
 * This is the bridge between Claude's tool_use responses and the actual GHL/DB calls.
 *
 * Read-only tools (get_contact, search_contacts, etc.) execute immediately.
 * Draft tools (draft_message, draft_task, draft_stage_move) return draft payloads
 * for the user to confirm — they do NOT execute actions in GHL.
 */

import * as ghl from "@/lib/ghl";
import { createServerClient } from "@/lib/supabase/server";
import type { ScoutToolName, DraftedAction } from "@/types/scout";

/** The result of executing a tool — either data or a drafted action */
export interface ToolExecutionResult {
  /** Text data to send back to Claude as a tool_result */
  data: string;
  /** If this tool produced a drafted action for the user to confirm */
  draftedAction?: DraftedAction;
}

/** Executes a single tool call and returns the result */
export async function executeTool(
  toolName: ScoutToolName,
  input: Record<string, unknown>
): Promise<ToolExecutionResult> {
  switch (toolName) {
    case "get_contact":
      return executeGetContact(input);
    case "search_contacts":
      return executeSearchContacts(input);
    case "get_pipeline":
      return executeGetPipeline(input);
    case "get_profile":
      return executeGetProfile(input);
    case "get_schedule":
      return executeGetSchedule(input);
    case "search_knowledge":
      return executeSearchKnowledge(input);
    case "draft_message":
      return executeDraftMessage(input);
    case "draft_task":
      return executeDraftTask(input);
    case "draft_stage_move":
      return executeDraftStageMove(input);
    default: {
      const _exhaustive: never = toolName;
      return { data: `Unknown tool: ${_exhaustive}` };
    }
  }
}

// ========================================
// READ-ONLY TOOLS — execute immediately
// ========================================

async function executeGetContact(
  input: Record<string, unknown>
): Promise<ToolExecutionResult> {
  try {
    const contact = await ghl.getContact(input.contact_id as string);
    return { data: JSON.stringify(contact) };
  } catch (err) {
    return { data: `Error fetching contact: ${err instanceof Error ? err.message : "Unknown error"}` };
  }
}

async function executeSearchContacts(
  input: Record<string, unknown>
): Promise<ToolExecutionResult> {
  try {
    const contacts = await ghl.searchContacts({
      query: input.query as string,
      limit: input.limit as number | undefined,
    });
    return { data: JSON.stringify(contacts) };
  } catch (err) {
    return { data: `Error searching contacts: ${err instanceof Error ? err.message : "Unknown error"}` };
  }
}

async function executeGetPipeline(
  input: Record<string, unknown>
): Promise<ToolExecutionResult> {
  try {
    const pipelines = await ghl.getPipelines();
    // If a specific pipeline was requested, filter to that one
    if (input.pipeline_id) {
      const pipeline = pipelines.find((p) => p.id === input.pipeline_id);
      if (!pipeline) {
        return { data: `Pipeline with ID ${input.pipeline_id} not found.` };
      }
      // Also fetch opportunities for this pipeline
      const opportunities = await ghl.searchOpportunities({
        pipelineId: pipeline.id,
        status: "open",
      });
      return { data: JSON.stringify({ pipeline, opportunities }) };
    }
    // Return first pipeline with its opportunities
    if (pipelines.length > 0) {
      const opportunities = await ghl.searchOpportunities({
        pipelineId: pipelines[0].id,
        status: "open",
      });
      return { data: JSON.stringify({ pipeline: pipelines[0], opportunities }) };
    }
    return { data: JSON.stringify({ pipelines, opportunities: [] }) };
  } catch (err) {
    return { data: `Error fetching pipeline: ${err instanceof Error ? err.message : "Unknown error"}` };
  }
}

async function executeGetSchedule(
  input: Record<string, unknown>
): Promise<ToolExecutionResult> {
  try {
    const appointments = await ghl.getAppointments(
      input.start_date as string,
      input.end_date as string
    );
    return { data: JSON.stringify(appointments) };
  } catch (err) {
    return { data: `Error fetching schedule: ${err instanceof Error ? err.message : "Unknown error"}` };
  }
}

async function executeSearchKnowledge(
  input: Record<string, unknown>
): Promise<ToolExecutionResult> {
  try {
    const supabase = createServerClient();
    const query = (input.query as string).toLowerCase();

    // Search knowledge documents by title and content match
    const { data: rawDocs, error } = await supabase
      .from("knowledge_documents")
      .select("title, category, content")
      .eq("is_active", true)
      .order("priority", { ascending: false })
      .limit(5);

    if (error) {
      return { data: `Error searching knowledge base: ${error.message}` };
    }

    const docs = rawDocs as { title: string; category: string; content: string }[] | null;

    if (!docs || docs.length === 0) {
      return { data: "No knowledge base documents found. The knowledge base has not been populated yet." };
    }

    // Simple keyword filtering — filter docs that contain the search query
    const matched = docs.filter(
      (doc) =>
        doc.title.toLowerCase().includes(query) ||
        doc.content.toLowerCase().includes(query) ||
        doc.category.toLowerCase().includes(query)
    );

    const results = matched.length > 0 ? matched : docs;
    return { data: JSON.stringify(results) };
  } catch (err) {
    return { data: `Error searching knowledge base: ${err instanceof Error ? err.message : "Unknown error"}` };
  }
}

async function executeGetProfile(
  input: Record<string, unknown>
): Promise<ToolExecutionResult> {
  try {
    const contactId = input.contact_id as string;
    const contact = await ghl.getContact(contactId);
    const contactName = `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim() || "Unknown";

    // Load field mapping from Supabase
    const supabase = createServerClient();
    const { data: fieldMappings } = await supabase
      .from("ghl_custom_fields")
      .select("field_name, ghl_field_id")
      .eq("entity_type", "contact");

    // Build reverse lookup: GHL field ID → field name
    const idToName = new Map<string, string>();
    if (fieldMappings) {
      for (const m of fieldMappings) {
        idToName.set(m.ghl_field_id, m.field_name);
      }
    }

    // Extract custom field values by name
    const profile: Record<string, string> = {};
    for (const cf of contact.customFields) {
      const name = idToName.get(cf.id);
      if (name && cf.value) {
        profile[name] = cf.value;
      }
    }

    // Build a readable summary for Scout
    const filledFields = Object.entries(profile)
      .map(([name, value]) => `- ${name}: ${value}`)
      .join("\n");

    const summary = [
      `Candidate Profile for ${contactName}`,
      `Contact ID: ${contactId}`,
      `Email: ${contact.email ?? "—"}`,
      `Phone: ${contact.phone ?? "—"}`,
      `Source: ${contact.source ?? "—"}`,
      `Tags: ${contact.tags.length > 0 ? contact.tags.join(", ") : "None"}`,
      `Date Added: ${contact.dateAdded}`,
      "",
      filledFields.length > 0
        ? `Profile Fields (${Object.keys(profile).length} populated):\n${filledFields}`
        : "No profile fields populated yet.",
    ].join("\n");

    return { data: summary };
  } catch (err) {
    return { data: `Error fetching profile: ${err instanceof Error ? err.message : "Unknown error"}` };
  }
}

// ========================================
// DRAFT TOOLS — return drafts for user confirmation
// ========================================

async function executeDraftMessage(
  input: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const contactId = input.contact_id as string;
  const channel = input.channel as "SMS" | "Email";
  const content = input.content as string;
  const subject = input.subject as string | undefined;

  // Try to fetch the contact name for display
  let contactName = "Unknown Contact";
  try {
    const contact = await ghl.getContact(contactId);
    contactName = `${contact.firstName} ${contact.lastName}`.trim();
  } catch {
    // Use fallback name if fetch fails
  }

  const draftedAction: DraftedAction = {
    id: crypto.randomUUID(),
    type: "message",
    status: "pending",
    contactId,
    contactName,
    payload: {
      actionType: "message",
      channel,
      content,
      subject,
    },
  };

  return {
    data: `I've drafted a ${channel} message to ${contactName}. Please review it below and confirm, edit, or cancel.`,
    draftedAction,
  };
}

async function executeDraftTask(
  input: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const contactId = input.contact_id as string;
  const title = input.title as string;
  const dueDate = input.due_date as string;
  const description = input.description as string | undefined;

  let contactName = "Unknown Contact";
  try {
    const contact = await ghl.getContact(contactId);
    contactName = `${contact.firstName} ${contact.lastName}`.trim();
  } catch {
    // Use fallback name if fetch fails
  }

  const draftedAction: DraftedAction = {
    id: crypto.randomUUID(),
    type: "task",
    status: "pending",
    contactId,
    contactName,
    payload: {
      actionType: "task",
      title,
      description,
      dueDate,
    },
  };

  return {
    data: `I've drafted a task "${title}" for ${contactName}. Please review it below and confirm, edit, or cancel.`,
    draftedAction,
  };
}

async function executeDraftStageMove(
  input: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const contactId = input.contact_id as string;
  const newStage = input.new_stage as string;
  const reason = input.reason as string | undefined;

  let contactName = "Unknown Contact";
  try {
    const contact = await ghl.getContact(contactId);
    contactName = `${contact.firstName} ${contact.lastName}`.trim();
  } catch {
    // Use fallback name if fetch fails
  }

  const draftedAction: DraftedAction = {
    id: crypto.randomUUID(),
    type: "stage_move",
    status: "pending",
    contactId,
    contactName,
    payload: {
      actionType: "stage_move",
      currentStage: "Unknown", // Would need pipeline lookup to determine — shown as context in UI
      newStage,
      reason,
    },
  };

  return {
    data: `I've drafted a pipeline move for ${contactName} to "${newStage}". Please review it below and confirm, edit, or cancel.`,
    draftedAction,
  };
}
