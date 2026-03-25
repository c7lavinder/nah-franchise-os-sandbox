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
    case "get_next_action":
      return executeGetNextAction(input);
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
    case "draft_profile_update":
      return executeDraftProfileUpdate(input);
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

async function executeGetNextAction(
  input: Record<string, unknown>
): Promise<ToolExecutionResult> {
  try {
    const contactId = input.contact_id as string;

    // Fetch contact + profile + pipeline data in parallel
    const [contact, pipelinesData] = await Promise.all([
      ghl.getContact(contactId),
      ghl.getPipelines(),
    ]);

    const contactName = `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim() || "Unknown";

    // Load field mapping for profile
    const supabase = createServerClient();
    const { data: fieldMappings } = await supabase
      .from("ghl_custom_fields")
      .select("field_name, ghl_field_id")
      .eq("entity_type", "contact");

    const idToName = new Map<string, string>();
    if (fieldMappings) {
      for (const m of fieldMappings) {
        idToName.set(m.ghl_field_id, m.field_name);
      }
    }

    // Extract profile values
    const profile: Record<string, string> = {};
    for (const cf of contact.customFields) {
      const name = idToName.get(cf.id);
      if (name && cf.value) {
        profile[name] = cf.value;
      }
    }

    // Find this contact's opportunity in NAH pipelines
    const nahPipelines = pipelinesData.filter((p) => p.name.startsWith("NAH Franchise Sales"));
    let currentStage = "Unknown";
    let daysInStage = 0;
    let opportunityStatus = "unknown";

    for (const pipeline of nahPipelines) {
      const opps = await ghl.searchOpportunities({
        pipelineId: pipeline.id,
      });
      const match = opps.find((o) => o.contactId === contactId);
      if (match) {
        const stage = pipeline.stages.find((s) => s.id === match.pipelineStageId);
        currentStage = stage?.name?.trim() ?? "Unknown";
        daysInStage = Math.floor(
          (Date.now() - new Date(match.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
        );
        opportunityStatus = match.status;
        break;
      }
    }

    // Calculate days since last touch
    const lastTouchStr = profile["Last Touch Date"];
    const daysSinceTouch = lastTouchStr
      ? Math.floor((Date.now() - new Date(lastTouchStr).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    // Calculate days since added
    const daysSinceAdded = Math.floor(
      (Date.now() - new Date(contact.dateAdded).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Identify missing critical profile fields by stage
    const missingFields: string[] = [];

    // Fields that should be filled by Qualified stage
    const qualificationFields: [string, string][] = [
      ["Territory Interest", "Where do they want their territory?"],
      ["Capital Availability", "Have they confirmed capital?"],
      ["Business Ownership Experience", "Prior business ownership?"],
      ["Primary Goal", "What's their primary goal?"],
      ["Motivation Clarity", "How strong is their motivation?"],
    ];

    // Fields for later stages
    const financialFields: [string, string][] = [
      ["Capital Source", "How are they funding it?"],
      ["Financing Pre-Qualified", "Are they pre-qualified for financing?"],
    ];

    const complianceFields: [string, string][] = [
      ["Spouse Aware", "Is their spouse aware?"],
      ["NDA Status", "NDA signed?"],
    ];

    // Check qualification fields (relevant from Stage 3+)
    const stageNum = getStageNumber(currentStage);
    if (stageNum >= 3) {
      for (const [field, question] of qualificationFields) {
        if (!profile[field]) missingFields.push(`${field} — ${question}`);
      }
    }
    if (stageNum >= 5) {
      for (const [field, question] of financialFields) {
        if (!profile[field]) missingFields.push(`${field} — ${question}`);
      }
    }
    if (stageNum >= 3) {
      for (const [field, question] of complianceFields) {
        if (!profile[field]) missingFields.push(`${field} — ${question}`);
      }
    }

    // Identify overdue milestones
    const overdue: string[] = [];
    const mattDone = profile["Matt Call Done"];
    const samDone = profile["Sam Call Done"];
    const markDone = profile["Mark Call Done"];
    const framingDone = profile["Framing Call Logged"];

    if (stageNum >= 2 && framingDone !== "Yes") {
      overdue.push("Framing call not logged — must happen before Trainual invite");
    }
    if (stageNum >= 4 && (!mattDone || mattDone.startsWith("No"))) {
      overdue.push("Matt Call (Discovery) not completed");
    }
    if (stageNum >= 6 && (!samDone || samDone.startsWith("No"))) {
      overdue.push("Sam Call (Validation) not completed");
    }
    if (stageNum >= 9 && (!markDone || markDone.startsWith("No"))) {
      overdue.push("Mark Call (Capital/Lending) not completed");
    }

    // Stale lead check
    const isStale = daysSinceTouch !== null && daysSinceTouch > 3;
    const isVeryStale = daysSinceTouch !== null && daysSinceTouch > 7;

    // Build recommended next action
    let recommendation = "";
    if (opportunityStatus === "lost") {
      recommendation = "This lead is marked as Lost. Consider moving to Nurture if there's future potential, or leave as Lost.";
    } else if (isVeryStale) {
      recommendation = `No contact in ${daysSinceTouch} days — this lead is going cold. Reach out today with a personal call or text.`;
    } else if (overdue.length > 0) {
      recommendation = `Overdue: ${overdue[0]}. Schedule or complete this before moving forward.`;
    } else if (missingFields.length > 0) {
      recommendation = `Key info missing: ${missingFields[0]}. Get this on the next call.`;
    } else if (isStale) {
      recommendation = `Last touch was ${daysSinceTouch} days ago. Follow up to keep momentum.`;
    } else {
      recommendation = getStageRecommendation(currentStage, profile);
    }

    // Build the full analysis
    const lines = [
      `NEXT ACTION ANALYSIS — ${contactName}`,
      ``,
      `CURRENT STATE:`,
      `  Stage: ${currentStage} (${daysInStage}d in stage)`,
      `  Status: ${opportunityStatus}`,
      `  Days since added: ${daysSinceAdded}`,
      `  Last touch: ${daysSinceTouch !== null ? `${daysSinceTouch} days ago via ${profile["Last Touch Channel"] ?? "unknown"}` : "No touch recorded"}`,
      `  Lead score: ${profile["Scout Lead Score"] ?? "Not scored"}`,
      `  Sentiment: ${profile["Sentiment Trend"] ?? "Unknown"}`,
      `  Trainual: ${profile["Trainual Completion Percent"] ? `${profile["Trainual Completion Percent"]}% complete` : "Not tracked"}`,
    ];

    if (missingFields.length > 0) {
      lines.push(``, `MISSING PROFILE FIELDS (${missingFields.length}):`);
      for (const f of missingFields.slice(0, 5)) {
        lines.push(`  - ${f}`);
      }
      if (missingFields.length > 5) {
        lines.push(`  ... and ${missingFields.length - 5} more`);
      }
    }

    if (overdue.length > 0) {
      lines.push(``, `OVERDUE MILESTONES:`);
      for (const o of overdue) {
        lines.push(`  ⚠ ${o}`);
      }
    }

    lines.push(``, `RECOMMENDED NEXT ACTION:`, `  → ${recommendation}`);

    return { data: lines.join("\n") };
  } catch (err) {
    return { data: `Error analyzing contact: ${err instanceof Error ? err.message : "Unknown error"}` };
  }
}

/** Map stage name to a number for comparison */
function getStageNumber(stageName: string): number {
  const map: Record<string, number> = {
    "New Lead": 1,
    "Contacted": 2,
    "Qualified": 3,
    "Matt Call (Discovery)": 4, "Matt Call": 4,
    "Sam Call (Validation)": 5, "Sam Call": 5,
    "Compliance Gate": 6, "Compliance Check": 6,
    "Application + Approval": 7, "Application": 7,
    "FDD Issued": 8, "Signed FDD Receipt": 8,
    "Mark Call (Capital/Lending)": 9, "Mark Call": 9,
    "Award + Agreement": 10,
    "Funds Received": 11, "Closed Won": 11,
    "Follow-up": 12,
    "Nurture": 13,
    "Re-engaged": 14,
  };
  return map[stageName] ?? 0;
}

/** Stage-specific recommendation when nothing is overdue or missing */
function getStageRecommendation(stage: string, profile: Record<string, string>): string {
  const num = getStageNumber(stage);
  switch (num) {
    case 1: return "New lead — make first contact within 5 minutes. Call first, then text.";
    case 2: return "Keep attempting contact across channels. If 5+ attempts with no response, consider moving to Follow-up.";
    case 3: return "Qualified — schedule the Matt Call (Discovery) within 48 hours.";
    case 4: return profile["Matt Call Done"]?.startsWith("Yes")
      ? "Matt Call complete — schedule Sam Call (Validation)."
      : "Matt Call upcoming — send pre-call brief to Matt and confirm with prospect.";
    case 5: return profile["Sam Call Done"]?.startsWith("Yes")
      ? "Sam Call complete — move to Compliance Gate."
      : "Sam Call upcoming — send briefing note to Sam.";
    case 6: return "Complete the compliance checklist — all items must be checked before FDD.";
    case 7: return "Guide prospect through the application. Follow up if not submitted within 5 days.";
    case 8: return "FDD issued — legal-safe check-ins only. No pressure. Wait for 14-day window.";
    case 9: return profile["Mark Call Done"]?.startsWith("Yes")
      ? "Mark Call complete — if financially viable, move to Award + Agreement."
      : "Schedule the Mark Call — capital is the #1 deal blocker.";
    case 10: return "Coordinate agreement execution. Target: signed within 10 business days.";
    case 11: return "Closed Won! Generate onboarding tasks and welcome the new franchisee.";
    case 12: return "Follow-up lead — touch every 7-14 days. Draft a personal check-in.";
    case 13: return "Nurture lead — monthly personal touch from Chad + automated content.";
    case 14: return "Re-engaged! Contact within 2 hours — they already know NAH and chose to come back.";
    default: return "Review this lead's profile and determine the appropriate next step.";
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

async function executeDraftProfileUpdate(
  input: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const contactId = input.contact_id as string;
  const updatesRaw = input.updates as string;

  let contactName = "Unknown Contact";
  try {
    const contact = await ghl.getContact(contactId);
    contactName = `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim() || "Unknown Contact";
  } catch {
    // Use fallback
  }

  // Parse the updates JSON string
  let updates: { fieldName: string; value: string; reason: string }[];
  try {
    updates = JSON.parse(updatesRaw);
  } catch {
    return { data: "Error: Could not parse profile updates. Please provide valid JSON." };
  }

  if (!Array.isArray(updates) || updates.length === 0) {
    return { data: "Error: No profile updates provided." };
  }

  const fieldSummary = updates
    .map((u) => `${u.fieldName} → "${u.value}"`)
    .join(", ");

  const draftedAction: DraftedAction = {
    id: crypto.randomUUID(),
    type: "profile_update",
    status: "pending",
    contactId,
    contactName,
    payload: {
      actionType: "profile_update",
      fields: updates,
    },
  };

  return {
    data: `I've drafted profile updates for ${contactName}: ${fieldSummary}. Please review below and confirm, edit, or cancel.`,
    draftedAction,
  };
}
