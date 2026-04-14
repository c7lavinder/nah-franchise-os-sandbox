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

## CONTACT EOS (field_category: "contact_eos")
Personal goals and concerns shared by the prospect during the call.
Extract these as structured items for the contact's EOS tab:

### Goals (update existing — use field_key to identify which goal)
- income_goal (what income they're targeting — e.g. "$200k year 1", "replace my $120k salary")
- lifestyle_goal (what lifestyle change they want — e.g. "work from home", "be my own boss", "more time with family")
- qol_goal (what success looks like personally — e.g. "financial freedom by 50", "build generational wealth")

### Issues (create new items — each extraction = one issue)
- issue (any concern, objection, or problem the prospect raised — e.g. "worried about contractor availability", "spouse not fully on board yet")

### To-Dos (create new items — each extraction = one action item)
- todo (any next step or action item discussed for this prospect — e.g. "send FDD by Friday", "schedule call with Guidant", "follow up on territory availability")

## TERRITORY EOS (field_category: "territory_eos")
Operational priorities and metrics discussed for a specific territory.
Tag with target_territory name.

### Rocks (create new — each extraction = one 90-day priority)
- rock (a 90-day priority or goal discussed — e.g. "close 3 deals this quarter", "hire second contractor crew", "launch direct mail campaign")

### Issues (create new — each extraction = one operational issue)
- territory_issue (an operational problem discussed — e.g. "contractor no-shows on Mondays", "permits taking 6+ weeks", "low lead volume from Google Ads")

### To-Dos (create new — each extraction = one action item)
- territory_todo (a territory-level action item — e.g. "fire underperforming contractor", "set up Privy alerts for 3 new zip codes", "update Lowe's account")

### Scorecard (update existing metrics)
- scorecard_goal (a scorecard goal value mentioned — use field_key format: "t3_leads_entered", "t3_purchased", "t3_gross_profit", etc.)

### Habits (update grades)
- habit_grade (a habit grade discussed — field_key: "daily_tasks", "weekly_contractor_meeting", "biweekly_agent_meeting", "weekly_accounting", "monthly_lead_manager" — value: A/B/C/D/F)

## TERRITORY FIELDS (field_category: "territory")
Extract for any territory discussed:

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

## TERRITORY MARKET DATA (field_category: "territory_market")
These fields go into territory_market_data. Tag with target_territory name.
Extract ANY of these when discussed:

### Territory Overview
- region, market_type (primary/secondary/tertiary), territory_value_est
- counties_included, major_cities, territory_notes

### Demographics
- population_total, median_age, median_household_income, per_capita_income
- poverty_rate, pct_bachelors_degree, avg_household_size, total_households

### Housing
- median_home_value, median_rent, homeownership_rate, vacancy_rate
- median_year_built, pct_built_before_1970, housing_permits_annual
- avg_property_tax, median_monthly_housing_cost

### Real Estate Market
- avg_days_on_market, list_to_sale_ratio, active_listings, months_of_inventory
- price_per_sqft, yoy_home_appreciation, foreclosure_rate, distressed_property_pct
- cash_buyer_pct, investor_purchase_pct, avg_seller_concession, pct_price_reductions

### Flip Market
- flip_rate, flip_volume_annual, avg_flip_profit, avg_flip_roi
- avg_arv, avg_purchase_price, avg_purchase_discount, avg_rehab_cost
- avg_hold_time_days, best_flip_zip_codes, best_price_range
- flip_friendly_lenders, wholesale_deal_flow, avg_days_to_sell_flip

### Economy & Employment
- unemployment_rate, job_growth_rate_1yr, top_employer_1/2/3
- top_industry_1/2/3, cost_of_living_index

### Construction
- contractor_availability (High/Medium/Low), avg_labor_rate_hr
- avg_material_cost_sqft, avg_rehab_cost_sqft, permit_timeline_days
- permit_cost_avg, inspection_requirements, hoa_prevalence
- renovation_restrictions, construction_season

### Competition
- active_flippers_count, ibuyer_presence, wholesaler_activity
- investor_saturation (Saturated/Moderate/Underserved)
- competitor_presence, top_competitor_1/2/3
- buy_box_overlap, competitive_advantage

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
    },
    {
      "field_key": "income_goal",
      "field_category": "contact_eos",
      "extracted_value": "$200k in year 1",
      "confidence": "high",
      "target_contact_name": "Jacob Phillips",
      "target_territory": null
    },
    {
      "field_key": "issue",
      "field_category": "contact_eos",
      "extracted_value": "Worried about finding reliable contractors in his area",
      "confidence": "high",
      "target_contact_name": "Jacob Phillips",
      "target_territory": null
    },
    {
      "field_key": "rock",
      "field_category": "territory_eos",
      "extracted_value": "Close 3 deals by end of Q2",
      "confidence": "high",
      "target_contact_name": null,
      "target_territory": "Cincinnati"
    },
    {
      "field_key": "avg_rehab_cost",
      "field_category": "territory_market",
      "extracted_value": "45000",
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
  return callClaude({
    model,
    systemPrompt: SYSTEM,
    userPrompt: buildPrompt(ctx),
    parse: parseResult,
    maxTokens: 16384,
  });
}
