import type { CallContext, ExtractionResult, RosterEntry } from "../types";
import { callClaude, stripFences } from "../call-claude";

const SYSTEM = `You are Scout, the AI data extraction engine for NAH Franchise OS.
You analyze franchise sales call transcripts with extreme thoroughness.
Your job is to extract EVERY piece of structured intelligence from the conversation.
A 1-hour call should yield 30-50+ data points. Miss nothing.`;

export function buildPrompt(ctx: CallContext): string {
  const contactBlock = ctx.contactNames.length > 0
    ? `Contacts on call: ${ctx.contactNames.join(", ")}`
    : `Contact: ${ctx.contactName ?? "Unknown"}`;

  // Determine if this is a prospect or franchisee based on pipeline position
  const isProspect = ctx.pipelinePositions.length === 0
    || ctx.pipelinePositions.some((p) => p.pipelineSlug === "sales" || p.pipelineSlug === "followup");
  const isFranchisee = ctx.pipelinePositions.some((p) =>
    p.pipelineSlug === "onboarding" || p.pipelineSlug === "runway"
  );

  const territoryBlock = ctx.territoryNames.length > 0
    ? `Territories owned: ${ctx.territoryNames.join(", ")} (franchisee — extract territory operations/coaching data)`
    : isProspect
      ? "No territory yet — this is a PROSPECT. Extract territory preferences (desired areas) but NOT territory operations data."
      : "No territories linked yet — extract any territory names mentioned.";

  const contactTypeNote = isProspect
    ? `\n**IMPORTANT: This contact is a PROSPECT (not yet a franchisee).** Focus on contact fields: financial capacity, motivation, timeline, territory preferences, competitive intel, family situation. Do NOT extract territory operations/coaching fields — they have no territory yet. Territory preference fields (desired_territory, market_area, territory_type_preference) ARE relevant.`
    : isFranchisee
      ? `\n**This contact is an ACTIVE FRANCHISEE.** Extract both contact profile updates AND territory operations/coaching data. Coaching calls should yield goals, challenges, wins, deal updates, and operational metrics.`
      : "";

  // Build roster block for team/group calls
  const rosterBlock = ctx.isTeamCall && ctx.roster.length > 0
    ? buildRosterBlock(ctx.roster)
    : "";

  return `Extract EVERY piece of structured data from this call transcript.
Be exhaustive — a 1-hour call should yield 30-50+ data points.
If a piece of information was discussed, even briefly, extract it.
${contactTypeNote}
${ctx.isTeamCall ? `
**THIS IS A TEAM/GROUP CALL.** Multiple contacts and territories may be discussed.
Listen for EVERY mention of a contact, franchisee, prospect, or territory by name.
When someone discusses a specific person or territory, tag extractions to them using
target_contact_name and target_territory. Use the roster below to match names.
` : ""}
${rosterBlock}

## EXTRACTION RULES
1. Extract for EVERY contact discussed, not just the primary contact.
2. Extract for EVERY territory mentioned — match to the roster when possible.
3. If someone mentions a number, date, name, place, preference, concern, or fact — extract it.
4. Use "high" confidence for direct quotes/statements, "medium" for inferred, "low" for uncertain.
5. For territory data: identify which territory by name if possible.
6. If multiple contacts are on the call, tag each extraction with the correct contact name.
7. For PROSPECTS: focus heavily on financial capacity, motivation, timeline, and competitive intel.
8. For TEAM CALLS: when someone says "Jacob is going cold" or "Ron's territory is doing well", tag those extractions to the specific person/territory from the roster.

## CONTACT FIELDS (field_category: "contact")
Extract any of these that are mentioned or can be inferred:

### Basic Info
- first_name, last_name, email, phone, city, state, zip
- spouse_name, spouse_email, spouse_phone
- business_partner_name, business_partner_email

### Employment & Background
- employment_status (employed/self-employed/retired/between-jobs)
- current_employer, current_role, years_in_current_role
- prior_business_ownership (yes/no + details)
- prior_re_experience (real estate experience)
- education_level, military_background
- skill_set_notes (relevant skills mentioned)

### Financial Capacity
- liquid_capital (dollar amount or range)
- capital_range (e.g., "$100k-$200k")
- net_worth_estimate
- financing_type (cash/SBA/ROBS/retirement_rollover/partner/other)
- guidant_robs_active (using Guidant ROBS? yes/no)
- pfs_received (Personal Financial Statement received? yes/no)
- credit_score_range
- retirement_funds_available
- home_equity_available

### Motivation & Intent
- primary_motivation (why they want a franchise)
- definition_of_success (what success looks like to them)
- timeline_intent (when they want to start)
- availability_confirmed (can they start full-time?)
- risk_tolerance (conservative/moderate/aggressive)
- stated_why (their "why" in their own words)
- decision_style (analytical/emotional/collaborative)
- decision_timeline (when they'll decide)
- spouse_support_level (supportive/neutral/opposed/unknown)

### Territory Preferences
- desired_territory, secondary_territory
- market_area (general area of interest)
- zip_codes_of_interest
- territory_type_preference (urban/suburban/rural)
- relocation_willing (willing to relocate? yes/no)
- local_market_notes (what they know about their market)

### Competitive & Sales Intel
- competitors_mentioned (names of other franchises/options)
- competitor_notes (what they said about competitors)
- objections_raised (specific objections or concerns)
- lead_source (how they heard about NAH)
- referral_source (who referred them)
- prior_franchise_research (other franchises they've looked at)
- fdd_questions (specific FDD questions they asked)

### Family & Lifestyle
- family_situation (married/single/kids)
- num_dependents
- hobbies_interests (relevant personal interests)
- travel_constraints
- health_considerations

## TERRITORY FIELDS (field_category: "territory")
Extract for any territory discussed:

### Market Data
- territory_value_est (estimated market value)
- market_type (urban/suburban/rural/mixed)
- flip_activity_score (how active the flipping market is)
- competitor_presence (competitors operating in the area)
- local_market_notes (market conditions, trends, challenges)
- avg_home_price, median_income, population
- growth_rate, new_construction_rate

### Operations (for active franchisees)
- active_deals (number of current deals)
- houses_purchased_ytd
- houses_sold_ytd
- avg_time_to_flip_days
- avg_profit_per_flip
- leads_received_ytd
- lead_conversion_rate
- inventory_count (properties in inventory)
- rehab_in_progress (number of active rehabs)

### Financial (for active franchisees)
- total_invested
- revenue_ytd
- projected_purchases
- actual_purchases

### Coaching (for active franchisees)
- coaching_notes (key coaching points discussed)
- goals_discussed (goals or milestones mentioned)
- challenges_reported (challenges or problems mentioned)
- wins_reported (successes or milestones achieved)

## MARKET INTELLIGENCE (field_category: "market")
- market_trend (any market trends discussed)
- interest_rate_discussion (rates mentioned)
- local_regulation (zoning, permits, regulations mentioned)
- deal_source_discussed (where deals come from in the area)
- contractor_situation (contractor availability/pricing)

## BUSINESS FINANCIALS (field_category: "business_financials")
- deal_profit (profit on a specific deal discussed)
- rehab_cost (rehab costs mentioned)
- arv_discussed (after-repair value mentioned)
- purchase_price (specific property price)
- holding_costs (holding costs mentioned)
- closing_costs (closing costs discussed)

## OUTPUT FORMAT
Return a JSON object:
{
  "extractions": [
    {
      "field_key": "liquid_capital",
      "field_category": "contact",
      "extracted_value": "$150,000",
      "confidence": "high",
      "target_contact_name": "Jacob Phillips",
      "target_territory": null
    },
    {
      "field_key": "coaching_notes",
      "field_category": "territory",
      "extracted_value": "Struggling with contractor reliability, needs to expand contractor network",
      "confidence": "high",
      "target_contact_name": null,
      "target_territory": "Cincinnati"
    }
  ]
}

Rules:
- Only include fields where a value was actually mentioned or clearly implied.
- Do NOT include fields with null values — only extract what's there.
- For target_contact_name: use the contact's name if specific to them. Null if general.
- For target_territory: use the territory name if specific to a territory. Null if general.
- Be THOROUGH. A 30-minute call should have 15-25 extractions. A 60-minute call should have 30-50+.

Return only valid JSON. No preamble, no markdown fences.

${contactBlock}
${territoryBlock}
Call type: ${ctx.callType ?? "Unknown"}
Call date: ${ctx.callDate ?? "Unknown"}
Team on call: ${ctx.teamMembers.join(", ") || "Unknown"}

Transcript:
${ctx.transcript}`;
}

/** Build a compact roster block for team/group call prompts */
function buildRosterBlock(roster: RosterEntry[]): string {
  if (roster.length === 0) return "";

  const franchisees = roster.filter((r) => r.role === "franchisee");
  const prospects = roster.filter((r) => r.role === "prospect");

  const lines = ["## KNOWN CONTACTS & TERRITORIES (match names from transcript to this roster):"];

  if (franchisees.length > 0) {
    lines.push("\n**Franchisees:**");
    for (const f of franchisees) {
      const territory = f.territory ? ` — ${f.territory}` : "";
      const stage = f.pipelineStage ? ` (${f.pipelineStage})` : "";
      lines.push(`- ${f.name}${territory}${stage}`);
    }
  }

  if (prospects.length > 0) {
    lines.push("\n**Prospects:**");
    for (const p of prospects.slice(0, 50)) { // Cap at 50 for token budget
      const stage = p.pipelineStage ? ` (${p.pipelineStage})` : "";
      lines.push(`- ${p.name}${stage}`);
    }
    if (prospects.length > 50) {
      lines.push(`- ... and ${prospects.length - 50} more`);
    }
  }

  return lines.join("\n");
}

export function parseResult(rawText: string): ExtractionResult | null {
  try {
    const data = JSON.parse(stripFences(rawText)) as { extractions?: ExtractionResult["extractions"] };
    if (!Array.isArray(data.extractions)) return null;
    // Filter out null values — only keep actual extractions
    const filtered = data.extractions.filter((e) => e.extracted_value != null && e.extracted_value !== "");
    return { extractions: filtered };
  } catch {
    // Try regex extraction as fallback
    try {
      const match = rawText.match(/\{[\s\S]*"extractions"\s*:\s*\[[\s\S]*\][\s\S]*\}/);
      if (match) {
        const data = JSON.parse(match[0]) as { extractions?: ExtractionResult["extractions"] };
        if (Array.isArray(data.extractions)) {
          const filtered = data.extractions.filter((e) => e.extracted_value != null && e.extracted_value !== "");
          return { extractions: filtered };
        }
      }
    } catch { /* fallthrough */ }

    console.error("[extraction] parseResult: JSON parse failed");
    return null;
  }
}

export async function runExtraction(ctx: CallContext, model?: string): Promise<ExtractionResult | null> {
  // Scale maxTokens — long calls with 30-50 extractions need room
  const durationMin = ctx.durationSeconds ? Math.round(ctx.durationSeconds / 60) : 30;
  const maxTokens = durationMin >= 45 ? 8192 : 4096;

  return callClaude({
    model,
    systemPrompt: SYSTEM,
    userPrompt: buildPrompt(ctx),
    parse: parseResult,
    maxTokens,
  });
}
