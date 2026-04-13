import type { CallContext, NextStepsResult } from "../types";
import { callClaude, stripFences } from "../call-claude";

const SYSTEM = "You are Scout, an AI assistant for NAH Franchise OS. You generate post-call action items for the franchise sales team.";

export function buildPrompt(ctx: CallContext): string {
  return `Generate post-call action items for the sales team. Return a JSON array.

## Rules
- MAXIMUM 5 actions total. Combine similar sends into one comms action.
- ALWAYS include exactly one "note" action to log the call summary to the contact's profile.
- Pre-fill ALL fields using specific information from the transcript.
- Assign each action to the right NAH team member.
- Each appointment with a different rep stays its own action.

## NAH Team Assignment
- Chad Arnold → comms, notes, tasks (default for anything not otherwise assigned)
- Mark → any capital/lending related call or task
- Matt Lavinder → any qualification or final ownership call
- Sam → any discovery/demo call

## Required fields for EVERY action:
{
  "category": "apt | comms | task | note | pipeline | data",
  "title": "Short action title (10 words max)",
  "description": "1 sentence explaining the action",
  "why": "1 sentence explaining why this action matters",
  "contact_name": "Name of the contact this is for",
  "assigned_to_name": "NAH team member name",
  "ghl_action": true/false,
  "source": "scout",
  "metadata": {
    // APT: include apt_title, apt_date_time (ISO if from transcript), apt_duration_minutes (default 30), apt_notes
    // COMMS: include comms_channel ("sms"|"email"), comms_subject (if email), comms_body (FULL pre-written message)
    // TASK: include task_title, task_description, task_due_date (ISO, default today)
    // NOTE: include note_body (full call summary paragraph for the contact record)
  }
}

## WRITING STANDARDS
- All text in professional complete sentences.
- comms_body must be a FULL ready-to-send message, not a placeholder.
- note_body must be a complete call summary paragraph (4-5 sentences).
- Dates and times must include day of week and timezone when known.

Return only a valid JSON array. No preamble, no markdown fences.

Call Type: ${ctx.callType ?? "Unknown"}
Contact: ${ctx.contactName ?? "Unknown"}
Team on call: ${ctx.teamMembers.join(", ") || "Unknown"}
Call date: ${ctx.callDate ?? "Unknown"}
Duration: ${ctx.durationSeconds ? Math.round(ctx.durationSeconds / 60) + " minutes" : "Unknown"}

Transcript:
${ctx.transcript}`;
}

export function parseResult(rawText: string): NextStepsResult | null {
  try {
    const cleaned = stripFences(rawText);
    // Handle both { "actions": [...] } and bare [...] array
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return { actions: parsed };
    if (parsed.actions && Array.isArray(parsed.actions)) return { actions: parsed.actions };
    return null;
  } catch {
    return null;
  }
}

export async function runNextSteps(ctx: CallContext, model?: string): Promise<NextStepsResult | null> {
  return callClaude({
    model,
    systemPrompt: SYSTEM,
    userPrompt: buildPrompt(ctx),
    parse: parseResult,
  });
}
