import type { CallContext, NextStepsResult } from "../types";
import { callClaude, stripFences } from "../call-claude";

const SYSTEM = "You are Scout, an AI assistant for NAH Franchise OS. You generate post-call action items for the franchise sales team.";

export function buildPrompt(ctx: CallContext): string {
  return `Generate post-call action items for the sales team. Return a JSON array.

## Rules
- MAXIMUM 6 actions total. Combine similar sends into one comms action.
- ALWAYS include exactly one "note" action to log the call summary to the contact's profile.
- ALWAYS include a "pipeline" action — see Pipeline section below.
- Pre-fill ALL fields using specific information from the transcript.
- Assign each action to the right NAH team member.
- Each appointment with a different rep stays its own action.

## NAH Team Assignment
- Chad Arnold → comms, notes, tasks (default for anything not otherwise assigned)
- Mark → any capital/lending related call or task
- Matt Lavinder → any qualification or final ownership call
- Sam → any discovery/demo call

## Sales Pipeline (MUST reference when generating pipeline actions)
Stages flow left-to-right. Each stage has sub-tasks that must be logged off before advancing.

1. **Engagement** → Outreach, Intro Call, PTO
2. **Qualification** → NDA, Matt Call, Zorakle
3. **Discovery** → Sam Call, PFS, Background, Mark Call
4. **Compliance** → FDD, FDD Review Call, Territory Call, FA Info Gathering
5. **Awarding** → Matt Final Call, Franchise Award Letter, FA, FF
6. **Closed** (terminal)

### Call-to-pipeline mapping (use call type + transcript to determine):
- intro_call → log off "Intro Call" sub-task in Engagement
- matt_call → log off "Matt Call" in Qualification
- sam_call → log off "Sam Call" in Discovery
- mark_call → log off "Mark Call" in Discovery
- fdd_review → log off "FDD Review Call" in Compliance
- territory_call → log off "Territory Call" in Compliance
- matt_final_call → log off "Matt Final Call" in Awarding
- If the call discussed NDA signing → log off "NDA" in Qualification
- If the call discussed PTO/Trainual → log off "PTO" in Engagement
- If ALL sub-tasks in a stage were discussed as complete → also suggest "Advance to [next stage]"

### Pipeline action format:
For sub-task log-off:
{
  "category": "pipeline",
  "title": "Log off [Sub-task Name]",
  "description": "Mark [sub-task] as completed in the [Stage] stage",
  "metadata": { "pipeline_action": "log_subtask", "pipeline_stage": "[stage name]", "subtask_name": "[sub-task name]" }
}

For stage advance (only if evidence supports all sub-tasks in current stage are done):
{
  "category": "pipeline",
  "title": "Advance to [Next Stage]",
  "description": "Move [contact] from [current stage] to [next stage]",
  "metadata": { "pipeline_action": "advance_stage", "stage_from": "[current]", "stage_to": "[next]" }
}

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
    // COMMS: include comms_channel ("sms"|"email"), comms_subject (if email), comms_body (FULL pre-written message), comms_to_email, comms_to_phone
    // TASK: include task_title, task_description, task_due_date (ISO, default today)
    // NOTE: include note_body (full call summary paragraph for the contact record)
    // PIPELINE: include pipeline_action, pipeline_stage, subtask_name (or stage_from + stage_to for advance)
  }
}

## WRITING STANDARDS
- All text in professional complete sentences.
- comms_body must be a FULL ready-to-send message, not a placeholder.
- note_body must be a complete call summary paragraph (4-5 sentences).
- Dates and times must include day of week and timezone when known.
- Pipeline actions should always reference the specific stage and sub-task by name.

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
    let cleaned = stripFences(rawText);

    // Claude sometimes wraps in { "actions": [...] } or returns bare array
    // Also handle case where it returns an object with a single key containing the array
    const parsed = JSON.parse(cleaned);

    if (Array.isArray(parsed)) {
      return { actions: parsed };
    }

    if (typeof parsed === "object" && parsed !== null) {
      // Check common wrapper keys
      const arr = parsed.actions ?? parsed.action_items ?? parsed.items;
      if (Array.isArray(arr)) return { actions: arr };

      // If it's a single action object (not an array), wrap it
      if (parsed.category && parsed.title) return { actions: [parsed] };
    }

    console.error("[next-steps] parseResult: unexpected shape", typeof parsed);
    return null;
  } catch (err) {
    // Try to extract JSON array from text that has extra content around it
    try {
      const arrayMatch = rawText.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        const arr = JSON.parse(arrayMatch[0]);
        if (Array.isArray(arr)) return { actions: arr };
      }
    } catch { /* fallthrough */ }

    console.error("[next-steps] parseResult: JSON parse failed", err instanceof Error ? err.message : err);
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
