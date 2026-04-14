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
NAH is scaling to 250+ franchisees with a 15+ person HQ team. Your job is to extract every
piece of reusable knowledge from call transcripts and organize it into the franchise knowledge base.
This KB powers Scout's intelligence, the team's decision-making, and the entire franchise operation.

The KB is organized around 4 growth pillars:
1. MORE LEADS — marketing strategies, lead sources, campaign intelligence
2. BETTER CONVERSION — objection handling, competitive intel, sales tactics, FDD strategy
3. FASTER ONBOARDING — training insights, franchisee setup, onboarding operations
4. MORE HOUSES — coaching insights, territory intelligence, deal execution, market conditions

Extract AGGRESSIVELY. Every call contains intelligence that makes the franchise smarter.`;

export function buildPrompt(ctx: CallContext): string {
  return `Analyze this ${ctx.callType ?? "sales"} call transcript and extract ALL reusable knowledge.
Be thorough — a 30-minute call should yield 5-15 items. A 60-minute call should yield 10-25+.

## PILLAR 1: MORE LEADS
- **Marketing insights** — what marketing channels, messaging, or campaigns were discussed? (category: "marketing_insight")
- **Lead source intel** — how did prospects find NAH? What sources are working? (category: "lead_source_intel")

## PILLAR 2: BETTER CONVERSION
- **Questions prospects ask** — what do they want to know? What concerns them? (category: "prospect_questions")
- **Objections raised** — concerns about capital, timing, fees, competition, value, spouse, risk (category: "objections")
- **Capital signals** — funding sources, ranges, ROBS, SBA, self-funded, retirement (category: "capital_intelligence")
- **What motivated them** — why they're exploring franchise ownership (category: "prospect_motivations")
- **Competitive mentions** — other franchises, business models, or alternatives they're considering (category: "competitors")
- **What resonated in the pitch** — stories, data points, or value props that made them lean in (category: "sales_effectiveness")
- **FDD insights** — questions about FDD, concerns during review, what helped close (category: "fdd_intel")

## PILLAR 3: FASTER ONBOARDING
- **Onboarding insights** — what's working/not working in the onboarding process (category: "onboarding_insight")
- **Training intel** — Trainual completion, MasterSuite progress, knowledge gaps (category: "training_intel")
- **Franchisee setup notes** — entity formation, insurance, systems access, workstation issues (category: "franchisee_setup")

## PILLAR 4: MORE HOUSES
- **Coaching insights** — coaching tips, call techniques, what separates top performers (category: "coaching")
- **Franchisee challenges** — what owners struggle with, common blockers (category: "franchisee_challenges")
- **Deal intelligence** — specific deal details, rehab timelines, profit margins, deal sources (category: "deal_intel")
- **Market conditions** — territory-level market signals, local trends, contractor situations (category: "market_intelligence")
- **Territory intelligence** — specific territory details, performance, activity levels (category: "territory")

## CROSS-CUTTING
- **Process updates** — changes to how NAH does things, new SOPs (category: "process_updates")
- **Best practices** — operational improvements that are working (category: "best_practices")
- **Tool/platform updates** — MasterSuite, Lead Launchpad, Trainual, GHL changes (category: "operations")
- **Brand positioning** — how NAH's value prop is described, new messaging angles (category: "brand")
- **Business decisions** — strategic decisions, quarterly goals, EOS rocks, growth targets (category: "business_decision")
- **Governance updates** — policy changes, approval processes, pricing decisions (category: "governance_update")

## Rules
- Extract 5-25 items per call depending on length and density.
- Each item MUST have a direct quote from the transcript as evidence.
- Title should be specific and searchable (not generic like "Capital concern").
- Content should be 2-4 sentences summarizing the insight with context.
- If the same topic appears across many calls, mark frequency_signal as "recurring".
- For team/group calls: capture EVERY decision made, every problem raised, every strategy discussed.
- For prospect calls: capture EVERY question, objection, motivation, and competitive mention.
- For coaching calls: capture EVERY challenge, win, goal, and operational metric mentioned.
- Skip only pleasantries and small talk.
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
