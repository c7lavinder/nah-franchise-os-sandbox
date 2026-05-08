/**
 * Workflow Trigger Matcher
 *
 * Evaluates incoming GHL webhook events against live workflows'
 * trigger_config rules. When conditions match, auto-enrolls the contact.
 *
 * trigger_config format (stored as jsonb on workflows table):
 * {
 *   "event": "appointment.created",
 *   "conditions": [
 *     { "field": "calendarName", "operator": "contains", "value": "Discovery" }
 *   ],
 *   "description": "When someone books a Discovery Call"
 * }
 */

import { createServerClient } from "@/lib/supabase/server";
import { enrollContact } from "@/lib/workflows/enrollment";

/** Shape of a structured trigger rule in workflows.trigger_config */
interface TriggerConfig {
  event?: string;
  conditions?: Array<{
    field: string;
    operator: string;
    value: string | string[] | number;
  }>;
  description?: string;
  // Legacy: old hardcoded trigger_type is still stored as trigger_type column
}

/** Result from attempting to match workflows */
export interface TriggerMatchResult {
  matched: number;
  enrolled: number;
  errors: string[];
}

/**
 * Match an incoming webhook event against all live workflows with flexible trigger_config.
 *
 * @param eventType - Normalized GHL webhook event type (e.g. "appointment.created", "contact.stage_changed")
 * @param contactId - GHL contact ID from the webhook payload
 * @param eventPayload - Full webhook payload for condition evaluation
 */
export async function matchWorkflowTriggers(
  eventType: string,
  contactId: string,
  eventPayload: Record<string, unknown>
): Promise<TriggerMatchResult> {
  const supabase = createServerClient();
  const result: TriggerMatchResult = { matched: 0, enrolled: 0, errors: [] };

  // Fetch all live workflows
  const { data: workflows, error } = await supabase
    .from("workflows")
    .select("id, name, current_version_id, trigger_type, trigger_config")
    .eq("status", "live");

  if (error || !workflows) {
    result.errors.push(`Failed to fetch workflows: ${error?.message ?? "unknown"}`);
    return result;
  }

  for (const wf of workflows) {
    if (!wf.current_version_id) continue;

    const triggerConfig = (wf.trigger_config ?? {}) as TriggerConfig;
    let matches = false;

    // Check flexible trigger_config first
    if (triggerConfig.event) {
      matches = doesEventMatch(eventType, triggerConfig.event, triggerConfig.conditions ?? [], eventPayload);
    }

    // Fallback: check legacy trigger_type column for backwards compat
    if (!matches && wf.trigger_type) {
      matches = doesLegacyTriggerMatch(eventType, wf.trigger_type, eventPayload);
    }

    if (!matches) continue;

    result.matched++;

    try {
      const enrollResult = await enrollContact({
        workflowId: wf.id,
        workflowVersionId: wf.current_version_id,
        ghlContactId: contactId,
      });
      if (enrollResult.success) {
        result.enrolled++;
        console.log(`[trigger-matcher] Auto-enrolled ${contactId} in "${wf.name}" (event: ${eventType})`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      result.errors.push(`Enrollment failed for workflow "${wf.name}": ${msg}`);
    }
  }

  return result;
}

/**
 * GHL event name → builder trigger event aliases.
 *
 * GHL sends event names like "OpportunityUpdate" but the builder defines
 * triggers as "contact.stage_changed". This map bridges the gap so
 * the flexible matcher can connect them.
 *
 * Each GHL event can map to multiple trigger events (e.g., OpportunityUpdate
 * could match both contact.stage_changed and opportunity.updated triggers).
 */
const EVENT_ALIASES: Record<string, string[]> = {
  // GHL webhook events → builder trigger events
  opportunityupdate: ["contact.stage_changed", "opportunity.updated"],
  contactupdate: ["contact.updated", "contact.tag_added"],
  contactcreate: ["contact.created"],
  appointmentcreate: ["appointment.created"],
  taskcreate: ["task.created"],
  taskcomplete: ["task.completed"],
  taskdelete: ["task.deleted"],
  // NAH OS internal events → builder trigger events
  stageadvanced: ["stage.advanced", "contact.stage_changed"],
  subtasklogged: ["subtask.logged"],
  subtaskcompleted: ["subtask.completed"],
};

/**
 * Check if an incoming event matches a flexible trigger rule.
 */
function doesEventMatch(
  incomingEvent: string,
  triggerEvent: string,
  conditions: Array<{ field: string; operator: string; value: string | string[] | number }>,
  payload: Record<string, unknown>
): boolean {
  // Normalize both for comparison
  const normalizedIncoming = incomingEvent.toLowerCase().replace(/[_\s]/g, ".");
  const normalizedTrigger = triggerEvent.toLowerCase().replace(/[_\s]/g, ".");

  // Event type must match (supports partial match — "appointment.created" matches "appointmentcreate")
  const incomingCompact = normalizedIncoming.replace(/\./g, "");
  const triggerCompact = normalizedTrigger.replace(/\./g, "");

  let eventMatches = false;

  // Direct match (original logic)
  if (incomingCompact.includes(triggerCompact) || triggerCompact.includes(incomingCompact)) {
    eventMatches = true;
  }

  // Alias match — check if the incoming GHL event maps to the trigger event
  if (!eventMatches) {
    const aliases = EVENT_ALIASES[incomingCompact] ?? [];
    for (const alias of aliases) {
      const aliasCompact = alias.toLowerCase().replace(/[._\s]/g, "");
      if (aliasCompact.includes(triggerCompact) || triggerCompact.includes(aliasCompact)) {
        eventMatches = true;
        break;
      }
    }
  }

  if (!eventMatches) return false;

  // All conditions must pass (AND logic)
  for (const condition of conditions) {
    const fieldValue = getNestedValue(payload, condition.field);
    if (!evaluateCondition(String(fieldValue ?? ""), condition.operator, condition.value)) {
      return false;
    }
  }

  return true;
}

/**
 * Backwards-compat: match legacy trigger_type values against incoming events.
 * Legacy values like "stage_entry:new_lead", "appointment_created", etc.
 */
function doesLegacyTriggerMatch(
  eventType: string,
  legacyTriggerType: string,
  payload: Record<string, unknown>
): boolean {
  const normalized = eventType.toLowerCase().replace(/[_\s]/g, "");

  if (legacyTriggerType === "manual_enrollment") return false;

  if (legacyTriggerType.startsWith("stage_entry:")) {
    // Match on opportunity stage change events
    if (normalized.includes("opportunity") && normalized.includes("stage")) {
      return true; // Detailed stage matching is done by the existing handler
    }
    return false;
  }

  if (legacyTriggerType === "appointment_created") {
    return normalized.includes("appointment") && normalized.includes("create");
  }

  if (legacyTriggerType === "call_completed") {
    return normalized.includes("call") && normalized.includes("complete");
  }

  if (legacyTriggerType === "tag_added") {
    return normalized.includes("tag") && (normalized.includes("add") || normalized.includes("create"));
  }

  if (legacyTriggerType === "trainual_access_granted") {
    return normalized.includes("trainual");
  }

  return false;
}

/** Get a potentially nested value from a payload using dot notation */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/** Evaluate a condition rule */
function evaluateCondition(actual: string, operator: string, expected: string | string[] | number): boolean {
  switch (operator) {
    case "equals":
      return actual === String(expected);
    case "not_equals":
      return actual !== String(expected);
    case "contains":
      return actual.toLowerCase().includes(String(expected).toLowerCase());
    case "in":
      return Array.isArray(expected) && expected.includes(actual);
    case "not_empty":
      return actual.length > 0;
    case "empty":
      return actual.length === 0;
    case "greater_than":
      return Number(actual) > Number(expected);
    case "less_than":
      return Number(actual) < Number(expected);
    default:
      return false;
  }
}
