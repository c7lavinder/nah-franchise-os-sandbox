import type { CallContext, NextStepsResult } from "../types";
import { callClaude, stripFences } from "../call-claude";

const SYSTEM = "You are Scout, the AI assistant for NAH Franchise OS. You analyze franchise sales call transcripts and extract structured intelligence.";

export function buildPrompt(ctx: CallContext): string {
  return `Analyze this call transcript and return a JSON object with exactly one key:

{
  "actions": [
    {
      "category": "<pipeline|apt|task|comms|workflow|data>",
      "title": "<action title>",
      "description": "<1 sentence>",
      "ghl_action": <bool>,
      "source": "scout"
    }
  ]
}

Return only valid JSON. No preamble, no markdown.

Transcript:
${ctx.transcript}

Call type: ${ctx.callType ?? "unknown"}
Contact name: ${ctx.contactName ?? "unknown"}`;
}

export function parseResult(rawText: string): NextStepsResult | null {
  try {
    const data = JSON.parse(stripFences(rawText)) as { actions?: NextStepsResult["actions"] };
    if (!Array.isArray(data.actions)) return null;
    return { actions: data.actions };
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
