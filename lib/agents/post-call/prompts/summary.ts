import type { CallContext, SummaryResult } from "../types";
import { callClaude } from "../call-claude";

const SYSTEM = "You are Scout, an AI assistant for NAH Franchise OS. You write detailed call summaries for the sales team to read before their next interaction with a candidate.";

export function buildPrompt(ctx: CallContext): string {
  const durationMinutes = ctx.durationSeconds
    ? Math.round(ctx.durationSeconds / 60)
    : null;

  const lengthGuidance = durationMinutes
    ? durationMinutes >= 45
      ? "This was a long call (45+ minutes). Write 7-10 sentences to capture the full picture."
      : durationMinutes >= 25
      ? "This was a medium-length call (25-44 minutes). Write 5-7 sentences."
      : "This was a short call (under 25 minutes). Write 3-5 sentences."
    : "Write 5-7 sentences.";

  return `${lengthGuidance}

Write in flowing paragraph form (NOT bullet points). Cover all of the following in your summary:
1. Who the candidate is, their background, and where they are in the NAH sales process
2. What was specifically discussed on this call (topics, FDD items, documents, tools shown)
3. Candidate engagement signals — tone, questions asked, enthusiasm or hesitation indicators
4. Capital signals — anything said about funding, assets, investment readiness, OR an explicit note if capital was never discussed
5. Open items — questions the candidate said they'd follow up on, unresolved concerns, things left for later
6. What was committed — specific next steps, dates, and actions confirmed before the call ended
7. Relationship read — how the candidate feels about the opportunity and the NAH team right now
8. What's missing — important topics that were NOT discussed that should come up in the next call

Be specific. Reference actual things said in the transcript (names, numbers, dates, places). Do not be generic.

WRITING STANDARDS — this summary will be read by franchise executives and sales leaders:
- Write in complete, professional sentences. No shorthand, no abbreviations, no casual fragments.
- BAD: "Mark's call Monday 12 noon Central, Matt's final call Tuesday 12 noon Central"
- GOOD: "Mark's lending call is scheduled for Monday at 12:00 PM Central, followed by Matt's final qualification call on Tuesday at 12:00 PM Central."
- Use full names on first reference (e.g. "Mark Lavinder" not "Mark"), then first name only after.
- Dates and times should always include day of week and timezone when mentioned in the transcript.
- Dollar amounts should be formatted properly (e.g. "$150,000" not "150k").
- Write as if preparing a briefing document, not a text message.

Return only the summary text. No labels, no headers, no JSON, no markdown fences.

Call Type: ${ctx.callType ?? "Unknown"}
Contact: ${ctx.contactName ?? "Unknown"}
Team: ${ctx.teamMembers.join(", ") || "Unknown"}
Duration: ${durationMinutes ? `${durationMinutes} minutes` : "Unknown"}
Date: ${ctx.callDate ?? "Unknown"}

Transcript:
${ctx.transcript}`;
}

export function parseResult(rawText: string): SummaryResult | null {
  // New prompt returns plain text, not JSON
  const text = rawText.trim();
  if (!text) return null;

  // Handle legacy JSON format gracefully
  if (text.startsWith("{")) {
    try {
      const data = JSON.parse(text) as { summary?: string };
      if (data.summary) return { summary: data.summary };
    } catch { /* not JSON, treat as plain text */ }
  }

  return { summary: text };
}

export async function runSummary(ctx: CallContext, model?: string): Promise<SummaryResult | null> {
  return callClaude({
    model,
    systemPrompt: SYSTEM,
    userPrompt: buildPrompt(ctx),
    parse: parseResult,
  });
}
