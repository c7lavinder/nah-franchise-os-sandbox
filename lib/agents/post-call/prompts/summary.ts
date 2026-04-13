import type { CallContext, SummaryResult } from "../types";
import { callClaude, stripFences } from "../call-claude";

const SYSTEM = "You are Scout, the AI assistant for NAH Franchise OS. You analyze franchise sales call transcripts and extract structured intelligence.";

export function buildPrompt(ctx: CallContext): string {
  return `Analyze this call transcript and return a JSON object with exactly one key:

{
  "summary": "2-3 sentence summary covering: candidate's why, capital signals, timeline, tone"
}

Return only valid JSON. No preamble, no markdown.

Transcript:
${ctx.transcript}

Call type: ${ctx.callType ?? "unknown"}
Contact name: ${ctx.contactName ?? "unknown"}`;
}

export function parseResult(rawText: string): SummaryResult | null {
  try {
    const data = JSON.parse(stripFences(rawText)) as { summary?: string };
    if (!data.summary) return null;
    return { summary: data.summary };
  } catch {
    return null;
  }
}

export async function runSummary(ctx: CallContext, model?: string): Promise<SummaryResult | null> {
  return callClaude({
    model,
    systemPrompt: SYSTEM,
    userPrompt: buildPrompt(ctx),
    parse: parseResult,
  });
}
