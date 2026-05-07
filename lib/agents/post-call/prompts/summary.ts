import type { CallContext, SummaryResult } from "../types";
import { callClaude } from "../call-claude";

const SYSTEM =
  "You are Scout, an AI assistant for NAH Franchise OS. You write detailed call summaries, classify call types, and generate concise bullet digests for the sales team.";

const CALL_TYPE_GUIDE = `CALL TYPE CLASSIFICATION — pick the ONE type that best fits this call:
- intro_call: First call with a new prospect. Chad introduces NAH, gauges interest, qualifies.
- matt_call: Discovery/deep-dive call with Matt. Financials, motivation, timeline.
- sam_call: Validation call with Sam. Territory research, market fit, operational readiness.
- mark_call: Lending/capital call with Mark. SBA, ROBS, funding strategy.
- territory_call: Territory selection or territory-specific discussion.
- fdd_review: Franchise Disclosure Document review call.
- matt_final_call: Matt's final qualification call before award.
- onboarding_call: Post-award franchisee going through setup, training, launch prep.
- coaching_call: Active franchisee getting coached on operations, deals, performance. Also for calls with franchisee employees.
- group_call: 3+ external participants from different franchises or prospects. Cohort/webinar style.
- cohort_call: Scheduled group session with multiple franchisees (training, accountability).
- team_call: Internal NAH team meeting — no external prospects or franchisees.
- unclassified: Cannot determine from the conversation content.`;

export function buildPrompt(ctx: CallContext): string {
  const durationMinutes = ctx.durationSeconds ? Math.round(ctx.durationSeconds / 60) : null;

  const participantInfo = [
    ctx.teamMembers.length > 0 ? `NAH Team: ${ctx.teamMembers.join(", ")}` : null,
    ctx.contactNames.length > 0 ? `External: ${ctx.contactNames.join(", ")}` : null,
    ctx.contactName ? `Primary Contact: ${ctx.contactName}` : null,
    ctx.territoryNames.length > 0 ? `Territories: ${ctx.territoryNames.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `You have two jobs: (1) classify this call's type, and (2) write the summary.

${CALL_TYPE_GUIDE}

IMPORTANT classification rules:
- If the person is a CONVERTED FRANCHISEE (territory awarded, going through setup/training) → onboarding_call
- If the person is an ACTIVE FRANCHISEE (already operating, discussing deals/performance) → coaching_call
- If the call is with a franchisee's EMPLOYEE (not the owner) → coaching_call
- If there are 3+ external participants from different companies → group_call or cohort_call
- If ALL participants are NAH team (no prospects, no franchisees) → team_call
- Look at the CONVERSATION CONTENT, not just the participant names. What are they actually discussing?

TITLE INSTRUCTIONS:
Generate a very short title — 3 to 5 words maximum. Capture the core topic only.
Do NOT include participant names. Do NOT use generic patterns like "Intro Call" or "Coaching Call".
Good examples: "SBA funding & territory", "Exploring franchise model", "Launch prep & hiring".
Bad examples: "Intro Call w/ John Smith" (has name), "SBA funding timeline & territory selection discussion" (too long), "Coaching Call" (generic).

SUMMARY INSTRUCTIONS:
Write exactly ONE paragraph — 4 to 6 sentences maximum. Executive briefing, not a report.
Pack the most important information: who the person is, where they are in the process, what was discussed, key signals, what was committed, anything critical missed.

WRITING STANDARDS:
- Write in complete, professional sentences. No shorthand.
- Use full names on first reference, then first name only.
- Dates/times include day of week and timezone when mentioned.
- Dollar amounts formatted properly (e.g. "$150,000" not "150k").

Generate exactly 3 bullet points — most critical takeaways, each under 12 words.

Return your response in this exact format (no other text):
<call_type>[slug from the list above]</call_type>
<title>[Your specific, descriptive title here]</title>
<summary>
[Your full paragraph summary here]
</summary>
<bullets>
["bullet one", "bullet two", "bullet three"]
</bullets>

CALL CONTEXT:
${participantInfo}
Duration: ${durationMinutes ? `${durationMinutes} minutes` : "Unknown"}
Date: ${ctx.callDate ?? "Unknown"}
Current classified type: ${ctx.callType ?? "Unknown"}

Transcript:
${ctx.transcript}`;
}

export function parseResult(rawText: string): SummaryResult | null {
  const text = rawText.trim();
  if (!text) return null;

  // Parse call type
  const typeMatch = text.match(/<call_type>([\s\S]*?)<\/call_type>/);
  const classifiedType = typeMatch ? typeMatch[1].trim() : null;

  // Parse title
  const titleMatch = text.match(/<title>([\s\S]*?)<\/title>/);
  const generatedTitle = titleMatch ? titleMatch[1].trim() : null;

  // Parse structured <summary> + <bullets> format
  const summaryMatch = text.match(/<summary>([\s\S]*?)<\/summary>/);
  const bulletsMatch = text.match(/<bullets>([\s\S]*?)<\/bullets>/);

  const summary = summaryMatch ? summaryMatch[1].trim() : null;

  let bullets: string[] = [];
  if (bulletsMatch) {
    try {
      const parsed: unknown = JSON.parse(bulletsMatch[1].trim());
      if (Array.isArray(parsed)) {
        bullets = parsed.filter((b): b is string => typeof b === "string").slice(0, 3);
      }
    } catch {
      /* bullets parse failed, continue without them */
    }
  }

  // If structured format worked, return it
  if (summary) {
    return { summary, bullets, classifiedCallTypeSlug: classifiedType, generatedTitle };
  }

  // Fallback: handle legacy JSON format
  if (text.startsWith("{")) {
    try {
      const data = JSON.parse(text) as { summary?: string };
      if (data.summary)
        return { summary: data.summary, bullets: [], classifiedCallTypeSlug: classifiedType, generatedTitle };
    } catch {
      /* not JSON, treat as plain text */
    }
  }

  // Fallback: treat entire response as plain text summary
  return { summary: text, bullets: [], classifiedCallTypeSlug: classifiedType, generatedTitle };
}

export async function runSummary(ctx: CallContext, model?: string): Promise<SummaryResult | null> {
  return callClaude({
    model,
    systemPrompt: SYSTEM,
    userPrompt: buildPrompt(ctx),
    parse: parseResult,
  });
}
