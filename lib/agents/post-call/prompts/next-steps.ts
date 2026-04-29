import type { CallContext, NextStepsResult, PipelinePosition, RosterEntry, JourneyPartner } from "../types";
import { callClaude, stripFences } from "../call-claude";

const SYSTEM =
  "You are Scout, an AI assistant for NAH Franchise OS. You generate post-call action items for the franchise sales team.";

export function buildPrompt(ctx: CallContext): string {
  return `Generate post-call action items for the sales team. Return a JSON array.

## Rules
- MAXIMUM 6 actions total. Combine similar sends into one comms action.
- ALWAYS include exactly one "note" action to log the call summary to the contact's profile.
- ALWAYS include at least one "pipeline" action — see Pipeline section below. This is CRITICAL.
- Pre-fill ALL fields using specific information from the transcript.
- Assign each action to the right NAH team member.
- Each appointment with a different rep stays its own action.

## NAH Team Assignment
- Chad Arnold → comms, notes, tasks (default for anything not otherwise assigned)
- Mark → any capital/lending related call or task
- Matt Lavinder → any qualification or final ownership call
- Sam → any discovery/demo call

## Pipeline Intelligence — MUST READ

You must analyze the transcript and the contact's current pipeline position to suggest pipeline actions.
Do NOT rely only on call type. Listen to what was discussed and determine what should be checked off or moved.

### All NAH Pipelines & Sub-tasks:

**Sales — Path to Ownership:**
1. Engagement → Outreach, Intro Call, PTO
2. Qualification → NDA, Matt Call, Zorakle
3. Discovery → Sam Call, PFS, Background, Mark Call
4. Compliance → FDD, FDD Review Call, Territory Call, FA Info Gathering
5. Awarding → Matt Final Call, Franchise Award Letter, FA, FF
6. Closed (terminal)

**Onboarding — Path to Launch:**
1. Setup → Entity & Bank Account, Insurance & Compliance, Systems Access, Workstation Ready
2. Training → Part 1: Onboarding, Part 2: MasterSuite, Part 3: Goals & Planning, Onboarding Test
3. Launch Prep → Territory Finalized, Marketing Live, First Lead in Pipeline, First Offer Sent
4. Onboarded (terminal)

**Runway — First Purchases:**
1. First Offers → Marketing Optimized, 10 Offers Sent, First Property Under Contract
2. First Acquisition → First Property Closed, Rehab Started, Second Property Under Contract
3. Inventory Building → 2+ Properties in Inventory, First Sale Closed, Graduate to Independent
4. Runway Complete (terminal)

**Follow-up:**
1. Follow-up (specific reason to resume)
2. Nurture (cold/long-term)
3. Re-engaged → Resume Sales (spawns new Sales entry)

${buildPipelinePositionBlock(ctx.pipelinePositions)}

### How to decide pipeline actions:
1. Look at the contact's CURRENT POSITION above
2. Read the transcript for evidence of sub-task completion:
   - Did they complete a call type? (intro call, matt call, sam call, mark call, fdd review, territory call, matt final call)
   - Did they mention signing something? (NDA, FDD receipt, FA, franchise award letter)
   - Did they discuss completing training? (MasterSuite, Onboarding Test, Goals & Planning)
   - Did they mention a property? (under contract, closed, rehab started, first sale)
   - Did they discuss marketing? (marketing live, first lead, first offer sent)
3. For EACH completed item found in the transcript, generate a pipeline action to log it off
4. If the call outcome suggests the contact should move to a different pipeline:
   - Going cold / not interested → suggest "Move to Nurture" (Follow-up pipeline)
   - Re-engaging after being cold → suggest "Move to Re-engaged"
   - If ALL sub-tasks in current stage are done → suggest "Advance to [next stage]"
5. If no specific sub-task was completed but a call happened (e.g., intro call), still log off that call sub-task

### Pipeline action format:
For sub-task log-off:
{
  "category": "pipeline",
  "title": "Log off [Sub-task Name]",
  "description": "Mark [sub-task] as completed in [Pipeline] → [Stage]",
  "metadata": { "pipeline_action": "log_subtask", "pipeline_name": "[pipeline name]", "pipeline_stage": "[stage name]", "subtask_name": "[sub-task name]" }
}

For stage advance:
{
  "category": "pipeline",
  "title": "Advance to [Next Stage]",
  "description": "Move [contact] from [current stage] to [next stage] in [Pipeline]",
  "metadata": { "pipeline_action": "advance_stage", "pipeline_name": "[pipeline name]", "stage_from": "[current]", "stage_to": "[next]" }
}

For pipeline move (e.g., move to nurture):
{
  "category": "pipeline",
  "title": "Move to [Destination]",
  "description": "Move [contact] to [destination pipeline/stage] — [reason]",
  "metadata": { "pipeline_action": "move_pipeline", "pipeline_from": "[current pipeline]", "pipeline_to": "[destination pipeline]", "stage_to": "[destination stage]" }
}

${buildPartnershipBlock(ctx.journeyPartners)}

## Required fields for EVERY action:
{
  "category": "apt | comms | task | note | pipeline | data",
  "title": "Short action title (10 words max)",
  "description": "1 sentence explaining the action",
  "why": "1 sentence explaining why this action matters",
  "contact_name": "Name of the contact this is for",
  "target_contact_name": "For partnership journeys ONLY: the exact partner name from the Partnership block above. Omit otherwise.",
  "assigned_to_name": "NAH team member name",
  "ghl_action": true/false,
  "source": "scout",
  "metadata": {
    // APT: include apt_title, apt_date_time (ISO if from transcript), apt_duration_minutes (default 30), apt_notes
    // COMMS: include comms_channel ("sms"|"email"), comms_subject (if email), comms_body (FULL pre-written message), comms_to_email, comms_to_phone
    // TASK: include task_title, task_description, task_due_date (ISO, default today)
    // NOTE: include note_body (full call summary paragraph for the contact record)
    // PIPELINE: include pipeline_action, pipeline_name, pipeline_stage, subtask_name (or stage_from + stage_to + pipeline_from + pipeline_to)
  }
}

## WRITING STANDARDS
- All text in professional complete sentences.
- comms_body must be a FULL ready-to-send message, not a placeholder.
- note_body must be a complete call summary paragraph (4-5 sentences).
- Dates and times must include day of week and timezone when known.
- Pipeline actions should always reference the specific pipeline, stage, and sub-task by name.

## LEARNING FROM PAST BEHAVIOR (RAG)

Use this feedback to generate better actions. If the team consistently skips a type of action,
stop suggesting it. If they always edit a field, pre-fill it better. If they always push
certain actions, keep suggesting those.

${ctx.feedbackBlock}

${ctx.isTeamCall ? buildTeamCallBlock(ctx.roster) : ""}
${!ctx.isTeamCall && ctx.contactNames.length > 1 ? buildMultiContactActionsBlock(ctx.contactNames) : ""}

Return only a valid JSON array. No preamble, no markdown fences.

Call Type: ${ctx.callType ?? "Unknown"}
${
  ctx.contactNames.length > 1
    ? `Contacts on call: ${ctx.contactNames.join(", ")}`
    : `Contact: ${ctx.contactName ?? "Unknown"}`
}
Team on call: ${ctx.teamMembers.join(", ") || "Unknown"}
Call date: ${ctx.callDate ?? "Unknown"}
Duration: ${ctx.durationSeconds ? Math.round(ctx.durationSeconds / 60) + " minutes" : "Unknown"}

Transcript:
${ctx.transcript}`;
}

/**
 * Build the partnership block — shown only when the journey has 2+ primaries
 * (father/daughter, spouses, business partners, etc). Forces Scout to pick
 * which partner each action should target so data + follow-up land on the
 * correct contact record.
 */
function buildPartnershipBlock(partners: JourneyPartner[]): string {
  if (!partners || partners.length < 2) return "";

  const lines = [
    "## PARTNERSHIP JOURNEY — TARGET PICKING IS REQUIRED",
    "",
    "This journey has multiple co-primary partners. For EVERY action you generate,",
    "pick the correct partner in `target_contact_name` based on the action's topic:",
    "",
    "### Partners on this journey:",
  ];
  for (const p of partners) {
    const role = p.role === "co_primary" ? "Co-primary" : "Primary";
    const highlight = p.profileHighlights ? ` — ${p.profileHighlights}` : "";
    lines.push(`- **${p.name}** (${role})${highlight}`);
  }
  lines.push(
    "",
    "### Rules for picking target_contact_name:",
    "1. If the action topic clearly belongs to ONE partner's domain (e.g. construction for a contractor, real estate listings for a RE-licensed partner), pick that partner.",
    '2. If the action applies to both (e.g. "send FDD", "schedule onboarding call"), pick the primary listed first above — the rep can reassign via the UI.',
    "3. Never leave `target_contact_name` blank on a partnership journey.",
    "4. For pipeline + note actions about the journey as a whole, pick the first partner listed.",
    ""
  );
  return lines.join("\n");
}

/**
 * Build multi-contact action instructions for calls with 2+ external contacts
 * that are NOT partnerships (separate journeys, e.g., coaching Dona + Todd).
 */
function buildMultiContactActionsBlock(contactNames: string[]): string {
  return `
## MULTI-CONTACT CALL — GENERATE ACTIONS FOR EACH CONTACT

**This call has ${contactNames.length} contacts. Generate actions for EACH one.**

Contacts: ${contactNames.join(", ")}

Rules:
1. EACH contact needs at least a "note" action to log their portion of the call.
2. EACH contact needs their own pipeline action (if applicable).
3. Set contact_name to the correct person for every action.
4. If a follow-up task is discussed for Contact A, don't assign it to Contact B.
5. Generate up to 10 actions total (not 6) since there are multiple contacts.
6. Appointments or tasks that are specific to one person → tag to that person.
7. You are FAILING if any contact gets zero actions — each person discussed gets at least note + pipeline.
`;
}

/** Build team/group call instructions with roster */
function buildTeamCallBlock(roster: RosterEntry[]): string {
  const lines = [
    "## TEAM/GROUP CALL INSTRUCTIONS",
    "",
    "This is a team or group call — multiple contacts and territories may be discussed.",
    "Generate actions for EACH contact/territory mentioned in the transcript:",
    "- If someone says a prospect is going cold → suggest pipeline move to Nurture for that prospect",
    "- If someone reports a franchisee win → suggest data extraction or note for that franchisee",
    "- If a territory issue is raised → suggest a task to address it",
    "- If a process change is decided → suggest a KB update task",
    "- If follow-up is needed with a specific person → suggest the comms/task for that person",
    "",
    "Tag EVERY action with the correct contact_name from the roster below.",
    "Generate up to 10 actions if the call covers many topics/people.",
  ];

  if (roster.length > 0) {
    const franchisees = roster.filter((r) => r.role === "franchisee");
    const prospects = roster.filter((r) => r.role === "prospect");

    lines.push("", "### ROSTER (match names from transcript):");

    if (franchisees.length > 0) {
      lines.push("", "**Franchisees:**");
      for (const f of franchisees) {
        const territory = f.territory ? ` — ${f.territory}` : "";
        const stage = f.pipelineStage ? ` (${f.pipelineStage})` : "";
        lines.push(`- ${f.name}${territory}${stage}`);
      }
    }

    if (prospects.length > 0) {
      lines.push("", "**Active Prospects:**");
      for (const p of prospects.slice(0, 30)) {
        const stage = p.pipelineStage ? ` (${p.pipelineStage})` : "";
        lines.push(`- ${p.name}${stage}`);
      }
    }
  }

  return lines.join("\n");
}

/** Build the "Contact's Current Position" block for the prompt */
function buildPipelinePositionBlock(positions: PipelinePosition[]): string {
  if (positions.length === 0) {
    return "### Contact's Current Pipeline Position:\nNo active pipeline — contact may be new or not yet placed.";
  }

  const lines = ["### Contact's Current Pipeline Position:"];
  for (const pos of positions) {
    lines.push(`\n**${pos.pipelineName}** — currently in **${pos.currentStage}**`);
    lines.push(`Stages: ${pos.allStages.join(" → ")}`);
    if (pos.subTasks.length > 0) {
      lines.push("Sub-tasks in current stage:");
      for (const st of pos.subTasks) {
        lines.push(`  ${st.completed ? "✅" : "⬜"} ${st.name}`);
      }
    }
  }
  return lines.join("\n");
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
    } catch {
      /* fallthrough */
    }

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
