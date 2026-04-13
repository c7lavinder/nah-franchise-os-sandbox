/**
 * KB Intelligence Extraction — mines every call transcript for knowledge
 * that should be captured in the franchise knowledge base.
 *
 * Covers: prospect questions, objections, competitive intel, process
 * learnings, best practices, market signals, and team updates.
 */

import type { CallContext } from "../types";
import { callClaude, stripFences } from "../call-claude";

export interface KBIntelligenceResult {
  items: KBIntelligenceItem[];
}

export interface KBIntelligenceItem {
  category: string;
  subcategory: string;
  title: string;
  content: string;
  source_quote: string;
  frequency_signal: "new" | "recurring" | "unknown";
}

const SYSTEM = `You are Scout, the AI knowledge analyst for New Again Houses (NAH) Franchise OS.
Your job is to extract every piece of reusable knowledge from call transcripts and organize it
for the franchise sales knowledge base. This knowledge base is used by the sales team and by AI
to prepare for calls, handle objections, and close deals.`;

export function buildPrompt(ctx: CallContext): string {
  return `Analyze this ${ctx.callType ?? "sales"} call transcript and extract ALL reusable knowledge.

## What to extract

### From PROSPECT calls (intro, matt, sam, mark, fdd_review, territory, matt_final):
- **Questions prospects ask** — what do they want to know? (category: "prospect_questions")
- **Objections raised** — concerns about capital, timing, fees, competition, value (category: "objections")
- **What motivated them** — why they're exploring franchise ownership (category: "prospect_motivations")
- **Competitive mentions** — other franchises or business models they're considering (category: "competitors")
- **What resonated** — which pitch points, stories, or data made them lean in (category: "sales_effectiveness")
- **Capital signals** — funding sources, ranges, ROBS, SBA, self-funded (category: "capital_intelligence")

### From TEAM calls (team_call, internal):
- **Process updates** — changes to how NAH does things (category: "process_updates")
- **Best practices** — what's working well for the team (category: "best_practices")
- **Market intelligence** — territory info, market conditions, deal activity (category: "market_intelligence")
- **Tool/platform updates** — MasterSuite, Lead Launchpad, Trainual changes (category: "operations")
- **Training insights** — coaching tips, call techniques, lessons learned (category: "coaching")

### From COACHING calls (coaching_call):
- **Franchisee challenges** — what owners struggle with (category: "franchisee_challenges")
- **Performance patterns** — what separates high performers from struggling ones (category: "best_practices")
- **Market conditions** — local market signals from franchisee experience (category: "market_intelligence")

### From ALL calls:
- **NAH brand positioning** — how the team describes NAH's value prop (category: "brand")
- **Territory intelligence** — specific territory details mentioned (category: "territory")

## Rules
- Extract 3-10 items per call. Short calls may have fewer.
- Each item must have a direct quote from the transcript as evidence.
- Title should be specific and searchable (not generic like "Capital concern").
- Content should be 2-4 sentences summarizing the insight with context.
- If the same topic appears across many calls, mark frequency_signal as "recurring".
- Skip pleasantries, small talk, and logistics — only extract substantive knowledge.
- Return ONLY valid JSON, no preamble.

## Return format
{
  "items": [
    {
      "category": "<from list above>",
      "subcategory": "<specific sub-topic, e.g. 'royalty_fees' under objections>",
      "title": "<specific, searchable title>",
      "content": "<2-4 sentence insight with context>",
      "source_quote": "<exact quote from transcript that supports this>",
      "frequency_signal": "new|recurring|unknown"
    }
  ]
}

Call Type: ${ctx.callType ?? "Unknown"}
Contact: ${ctx.contactName ?? "Unknown"}
Team: ${ctx.teamMembers.join(", ") || "Unknown"}
Date: ${ctx.callDate ?? "Unknown"}

Transcript:
${ctx.transcript}`;
}

export function parseResult(rawText: string): KBIntelligenceResult | null {
  try {
    const cleaned = stripFences(rawText);
    const data = JSON.parse(cleaned) as { items?: KBIntelligenceItem[] };
    if (Array.isArray(data.items) && data.items.length > 0) {
      return { items: data.items };
    }
    return null;
  } catch {
    // Try regex extraction
    const match = rawText.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const data = JSON.parse(match[0]) as { items?: KBIntelligenceItem[] };
        if (Array.isArray(data.items)) return { items: data.items };
      } catch { /* give up */ }
    }
    console.error("[kb-intelligence] parse failed");
    return null;
  }
}

export async function runKBIntelligence(
  ctx: CallContext,
  model?: string,
): Promise<KBIntelligenceResult | null> {
  return callClaude({
    model,
    systemPrompt: SYSTEM,
    userPrompt: buildPrompt(ctx),
    parse: parseResult,
    maxTokens: 4096,
  });
}
