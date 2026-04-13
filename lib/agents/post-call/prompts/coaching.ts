import type { CallContext, CoachingResult } from "../types";
import { callClaude, stripFences } from "../call-claude";

const SYSTEM = "You are Scout, the AI assistant for NAH Franchise OS. You analyze franchise sales call transcripts and extract structured intelligence.";

export function buildPrompt(ctx: CallContext): string {
  return `Analyze this call transcript and return a JSON object with exactly one key:

{
  "coaching": {
    "score": <int 0-100>,
    "label": "<short label e.g. Strong intro call, Needs improvement>",
    "went_well": ["<item>", "<item>"],
    "watch_out": ["<item>"],
    "next_call_prep": "<1-2 sentences>"
  }
}

Return only valid JSON. No preamble, no markdown.

Transcript:
${ctx.transcript}

Call type: ${ctx.callType ?? "unknown"}
Contact name: ${ctx.contactName ?? "unknown"}`;
}

export function parseResult(rawText: string): CoachingResult | null {
  try {
    const data = JSON.parse(stripFences(rawText)) as { coaching?: CoachingResult };
    if (!data.coaching || typeof data.coaching.score !== "number") return null;
    return data.coaching;
  } catch {
    return null;
  }
}

export async function runCoaching(ctx: CallContext, model?: string): Promise<CoachingResult | null> {
  return callClaude({
    model,
    systemPrompt: SYSTEM,
    userPrompt: buildPrompt(ctx),
    parse: parseResult,
  });
}
