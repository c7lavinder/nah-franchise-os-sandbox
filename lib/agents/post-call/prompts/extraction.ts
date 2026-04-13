import type { CallContext, ExtractionResult } from "../types";
import { callClaude, stripFences } from "../call-claude";

const SYSTEM = "You are Scout, the AI assistant for NAH Franchise OS. You analyze franchise sales call transcripts and extract structured intelligence.";

export function buildPrompt(ctx: CallContext): string {
  return `Analyze this call transcript and return a JSON object with exactly one key:

{
  "extractions": [
    {
      "field_key": "<snake_case field name from: employment_status, years_in_current_role, timeline_intent, capital_range, lead_source, competitors_mentioned, stated_why, risk_tolerance, family_situation, prior_business_ownership, market_interest, territory_type_preference, availability_confirmed>",
      "field_category": "<contact|territory>",
      "extracted_value": "<value or null if not mentioned>",
      "confidence": "<high|medium|low>"
    }
  ]
}

Return only valid JSON. No preamble, no markdown.

Transcript:
${ctx.transcript}

Call type: ${ctx.callType ?? "unknown"}
Contact name: ${ctx.contactName ?? "unknown"}`;
}

export function parseResult(rawText: string): ExtractionResult | null {
  try {
    const data = JSON.parse(stripFences(rawText)) as { extractions?: ExtractionResult["extractions"] };
    if (!Array.isArray(data.extractions)) return null;
    return { extractions: data.extractions };
  } catch {
    return null;
  }
}

export async function runExtraction(ctx: CallContext, model?: string): Promise<ExtractionResult | null> {
  return callClaude({
    model,
    systemPrompt: SYSTEM,
    userPrompt: buildPrompt(ctx),
    parse: parseResult,
  });
}
