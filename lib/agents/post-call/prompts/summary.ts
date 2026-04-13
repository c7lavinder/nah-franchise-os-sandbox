import type { CallContext, SummaryResult } from "../types";
import { callClaude } from "../call-claude";

const SYSTEM = "You are Scout, an AI assistant for NAH Franchise OS. You write detailed call summaries for the sales team to read before their next interaction with a candidate.";

export function buildPrompt(ctx: CallContext): string {
  const durationMinutes = ctx.durationSeconds
    ? Math.round(ctx.durationSeconds / 60)
    : null;

  return `Write exactly ONE paragraph — 4 to 6 sentences maximum. This is an executive briefing, not a report.

Pack the most important information into a tight paragraph covering: who the candidate is and where they are in the process, what was discussed, key signals (capital, engagement, concerns), what was committed (next steps with dates), and anything critical that was missed.

Be specific — reference real names, numbers, dates from the transcript. Every sentence must earn its place.

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
