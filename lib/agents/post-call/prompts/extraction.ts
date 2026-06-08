import type { CallContext, ExtractionResult, RosterEntry, JourneyPartner } from "../types";
import { callClaude, stripFences } from "../call-claude";

const SYSTEM = `You are Scout, the AI data extraction engine for NAH Franchise OS.
You analyze franchise sales call transcripts with extreme thoroughness.
Your job is to extract structured intelligence from the conversation when it fits a supported field.

EXTRACTION DENSITY REQUIREMENTS for active sales/prospect calls:
- 15-minute call: 15-25 extractions minimum
- 30-minute call: 25-40 extractions minimum
- 45-minute call: 40-55 extractions minimum
- 60-minute call: 50-70 extractions minimum

For coaching calls, especially historical Read.ai imports, relevance beats volume.
Do not pad the output with dated metrics or temporary observations just to hit a count.
Every sentence in the transcript potentially contains extractable data, but only extract it when it fits a supported field and is useful as durable profile/territory intelligence.
When in doubt, use medium/low confidence, but only if the fact fits a supported field key below.

Common mistakes that cause under-extraction:
- Summarizing instead of extracting (extract each individual fact separately)
- Skipping "obvious" info (extract it anyway — names, roles, locations, dates)
- Combining multiple facts into one extraction (split them — one fact per row)
- Ignoring small talk that reveals personal info (hobbies, family, sports teams = extractable)
- Missing current-useful territory operations data in coaching calls (active bottlenecks, durable goals, recurring challenges, meaningful wins)
- Inventing new field_key names that are not listed in this prompt`;

const TERRITORY_MARKET_FIELD_BLOCK = `## TERRITORY MARKET DATA (field_category: "territory_market")
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
- buy_box_overlap, competitive_advantage`;

export function buildPrompt(ctx: CallContext): string {
  const isCoaching = isCoachingCall(ctx);
  const contactBlock =
    ctx.contactNames.length > 0
      ? `Contacts on call: ${ctx.contactNames.join(", ")}`
      : `Contact: ${ctx.contactName ?? "Unknown"}`;

  // Determine if this is a prospect or franchisee based on pipeline position
  const isProspect =
    ctx.pipelinePositions.length === 0 ||
    ctx.pipelinePositions.some((p) => p.pipelineSlug === "sales" || p.pipelineSlug === "followup");
  const isFranchisee = ctx.pipelinePositions.some(
    (p) => p.pipelineSlug === "onboarding" || p.pipelineSlug === "runway"
  );

  const territoryBlock =
    ctx.territoryNames.length > 0
      ? `Territories owned: ${ctx.territoryNames.join(", ")} (franchisee — extract territory operations/coaching data)`
      : isProspect
        ? "No territory yet — this is a PROSPECT. Extract territory preferences (desired areas) but NOT territory operations data."
        : "No territories linked yet — extract any territory names mentioned.";

  // When a call is explicitly mapped to multiple territories, instruct the LLM
  // to route each territory-specific extraction to the right one.
  const callTerritoryBlock =
    ctx.callTerritories.length > 1
      ? `\n**THIS CALL SPANS MULTIPLE TERRITORIES.** For every territory-specific ${isCoaching ? "current qualitative point (wins, challenges, goals, bottlenecks, contractor/vendor context)" : "data point (population, ARV, deals, contractors, market metrics, wins, challenges, goals)"}, set target_territory to one of these EXACT names:\n${ctx.callTerritories.map((t) => `  - ${t.Nickname}${t.is_primary ? " (primary)" : ""}`).join("\n")}\nDo not leave target_territory null when the context makes clear which territory is being discussed. Listen for territory-specific cues ("in Cincinnati we...", "over in Dayton...") and attribute the extraction accordingly. If ambiguous, use the primary territory.`
      : ctx.callTerritories.length === 1
        ? `\nCall is mapped to territory: ${ctx.callTerritories[0].Nickname}. Use this exact name in target_territory for any territory-specific extraction.`
        : "";

  const contactTypeNote = isProspect
    ? `\n**IMPORTANT: This contact is a PROSPECT (not yet a franchisee).** Focus on contact fields: financial capacity, motivation, timeline, territory preferences, competitive intel, family situation. Do NOT extract territory operations/coaching fields — they have no territory yet. Territory preference fields (desired_territory, market_area, territory_type_preference) ARE relevant.`
    : isFranchisee
      ? isCoaching
        ? `\n**This contact is an ACTIVE FRANCHISEE on a coaching call.** Extract stable contact profile updates and current qualitative territory coaching points. Do not extract transcript metrics; MasterSuite is the source of truth for numbers.`
        : `\n**This contact is an ACTIVE FRANCHISEE.** Extract both contact profile updates AND territory operations/coaching data.`
      : "";

  // Build roster block for team/group calls
  const rosterBlock = ctx.isTeamCall && ctx.roster.length > 0 ? buildRosterBlock(ctx.roster) : "";

  // Partnership block — only when the journey has 2+ primaries (Kevin + Kylie
  // Kremer, spouses, etc). Forces per-extraction target picking.
  const partnershipBlock = ctx.journeyPartners.length >= 2 ? buildPartnershipBlock(ctx.journeyPartners) : "";

  // Multi-contact block — when 2+ external contacts are on a non-team call
  // (e.g., coaching call with Dona + Todd), force per-contact extraction.
  const multiContactBlock =
    !ctx.isTeamCall && ctx.contactNames.length > 1 && ctx.journeyPartners.length < 2
      ? buildMultiContactBlock(ctx.contactNames)
      : "";
  const coachingCurrentStateBlock = isCoaching ? buildCoachingCurrentStateBlock(ctx) : "";
  const territoryMarketBlock = isCoaching ? buildCoachingTerritoryMarketBlock() : TERRITORY_MARKET_FIELD_BLOCK;
  const minimumExtractionBlock = buildMinimumExtractionBlock(ctx);

  return `Extract structured data from this call transcript when it creates durable profile or territory intelligence.
Be thorough, but do not turn every discussed detail into a pushable data point.
${contactTypeNote}
${
  ctx.isTeamCall
    ? `
**THIS IS A TEAM/GROUP CALL.** Multiple contacts and territories may be discussed.
Listen for EVERY mention of a contact, franchisee, prospect, or territory by name.
When someone discusses a specific person or territory, tag extractions to them using
target_contact_name and target_territory. Use the roster below to match names.
`
    : ""
}${callTerritoryBlock}
${multiContactBlock}
${rosterBlock}
${partnershipBlock}
${coachingCurrentStateBlock}

## EXTRACTION RULES
1. Extract for EVERY contact discussed, not just the primary contact.
2. Extract for EVERY territory mentioned — match to the roster when possible.
3. If someone mentions a number, date, name, place, preference, concern, or fact — extract it only if it is current-useful and fits a supported destination.
4. Use "high" confidence for direct quotes/statements, "medium" for inferred, "low" for uncertain.
5. For territory data: identify which territory by name if possible.
6. If multiple contacts are on the call, tag each extraction with the correct contact name.
7. For PROSPECTS: focus heavily on financial capacity, motivation, timeline, and competitive intel.
8. For TEAM CALLS: when someone says "Jacob is going cold" or "Ron's territory is doing well", tag those extractions to the specific person/territory from the roster.
9. SPLIT compound facts: "He has $150k liquid and a credit score around 720" = TWO extractions (liquid_capital + credit_score_range).
10. Extract personal details from small talk: sports teams, hobbies, family mentions, vacation plans = hobbies_interests or family_situation.
11. Do NOT extract EOS items, commitments, todos, or action items right now.
12. For coaching calls: extract current-useful operating intelligence, not every metric. Prefer active constraints, durable goals, recurring challenges, meaningful wins, contractor/vendor capability, lead-flow problems, and market facts that should still matter after the call.
13. Extract relationship data: who referred whom, who knows whom, family members on the call.
14. Only use field_key values listed in this prompt. Do NOT invent new field keys. If a fact does not fit one of the listed fields, skip it.

## CONTACT-vs-TERRITORY ROUTING (critical)
Data points live on EITHER a contact OR a territory — never a journey.
Pick the field_category that matches WHERE the fact belongs, not who said it:
- **Operations talk = TERRITORY.** Deals in pipeline, offers sent, houses closed, rehab timelines, contractor availability, lead flow, marketing performance, permit processes, zoning quirks, local market metrics → field_category "territory" or "territory_market" only when the field_key exists below. Set target_territory to the specific territory.
- **Personal facts about a human = CONTACT.** Employment, background, skills, family, hobbies, personality, motivation, capital, timeline, decision style → field_category "contact". Set target_contact_name.
- **Employees / non-owner participants speak for a territory, not for themselves.** When a franchisee's employee or contractor describes how operations run, those facts belong to the OWNER's TERRITORY — not the employee's contact. Only route to the employee's contact for strictly personal facts (their role, their background, their hobbies).
- When in doubt between a contact field and a territory field, and the speaker is a franchisee discussing their own business, prefer TERRITORY.

## CONTACT FIELDS (field_category: "contact")
Extract any of these that are mentioned or can be inferred:

### Basic Info (do NOT extract first_name or last_name — we already have those)
- email, phone, city, state, zip
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
- decision_making_style (analytical/gut/consensus)
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

### Coaching (for active franchisees)
- coaching_notes (key coaching points discussed)
- goals_discussed (goals or milestones mentioned)
- challenges_reported (challenges or problems mentioned)
- wins_reported (successes or milestones achieved)

${territoryMarketBlock}

## OUTPUT FORMAT
Return a JSON object. Include target_scope ONLY when the partnership block above is present — otherwise omit it.
{
  "extractions": [
    {
      "field_key": "liquid_capital",
      "field_category": "contact",
      "extracted_value": "$150,000",
      "confidence": "high",
      "target_contact_name": "Jacob Phillips",
      "target_territory": null,
      "target_scope": "both"
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
- For target_scope: include ONLY when the partnership block above is present; follow its single-vs-both rules strictly.
- SPLIT compound facts into separate extractions — one fact per row.
- Extract personal details from casual conversation (hobbies, sports, family, travel).
- Do not extract EOS fields, commitments, todos, or action items.

${minimumExtractionBlock}

Return only valid JSON. No preamble, no markdown fences.

${contactBlock}
${territoryBlock}
Call type: ${ctx.callType ?? "Unknown"}
Call date: ${ctx.callDate ?? "Unknown"}
Team on call: ${ctx.teamMembers.join(", ") || "Unknown"}

Transcript:
${ctx.transcript}`;
}

function isCoachingCall(ctx: CallContext): boolean {
  const text = `${ctx.callTypeSlug ?? ""} ${ctx.callType ?? ""}`.toLowerCase();
  return text.includes("coaching");
}

function isHistoricalCall(ctx: CallContext): boolean {
  if (!ctx.callDate) return false;
  const timestamp = Date.parse(ctx.callDate);
  if (Number.isNaN(timestamp)) return false;
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
  return Date.now() - timestamp > ninetyDaysMs;
}

function buildCoachingCurrentStateBlock(ctx: CallContext): string {
  const historicalNote = isHistoricalCall(ctx)
    ? `
This is a historical call import. Treat dated numbers and temporary status as old context.
Do not extract point-in-time KPIs, financial metrics, marketing spend, lead counts, cycle days, or book/action recommendations as profile data unless the transcript clearly frames them as an ongoing/current baseline or durable operating pattern.`
    : "";

  return `
## COACHING CALL CURRENT-POINT RULES

For coaching calls, extract the current points that should help the team understand the franchisee/territory going forward.
MasterSuite is the source of truth for all quantitative metrics. Do not use call transcripts as metric data.
Good extraction candidates:
- Durable territory status: active bottleneck, recurring challenge, meaningful win, current goal, operating constraint.
- Stable capability/context: contractor network strength, qualitative lead-flow pattern, market condition, vendor issue, owner role/responsibility.
- Contact facts that are truly personal/profile facts: background, role, skills, family/lifestyle, decision style.

Do NOT extract:
- Metrics of any kind from the transcript. Ignore profit, revenue, cash, marketing spend, lead counts, conversion rates, cycle days, ARV, rehab cost, property counts, pipeline counts, and exact dates as data points.
- Book recommendations, homework, reminders, todos, EOS rocks/issues, or Next Steps.
- Coaching/territory fields as contact rows. goals_discussed, coaching_notes, wins_reported, and challenges_reported are territory fields only.${historicalNote}
`;
}

function buildCoachingTerritoryMarketBlock(): string {
  return `## TERRITORY MARKET DATA
Do not extract territory_market rows from coaching call transcripts.
MasterSuite and the territory research agent own market, financial, lead, deal, and operating metrics.
If the transcript contains a qualitative market condition that still matters, place it in a territory coaching field such as coaching_notes, challenges_reported, wins_reported, or goals_discussed.`;
}

function buildMinimumExtractionBlock(ctx: CallContext): string {
  if (isCoachingCall(ctx)) {
    return `MINIMUM EXTRACTION COUNTS:
- Coaching calls do not have a hard minimum. Extract only durable/current-useful points.
- If there are only 8-20 useful current points, return 8-20. Do not pad with stale metrics.`;
  }

  return `MINIMUM EXTRACTION COUNTS (you MUST meet these for sales/prospect calls):
- Calls under 20 min: 15+ extractions
- Calls 20-40 min: 30+ extractions
- Calls 40-60 min: 50+ extractions
- Calls over 60 min: 60+ extractions
If you are below these minimums, re-read the transcript and extract more aggressively.`;
}

/**
 * Build the partnership data-extraction block — shown only when the journey
 * has 2+ primaries. Tells Scout how to split contact-category extractions
 * between partners (e.g. Kevin + Kylie Kremer). Territory-category fields
 * are unaffected — they still route to the territory via target_territory.
 */
function buildPartnershipBlock(partners: JourneyPartner[]): string {
  if (!partners || partners.length < 2) return "";

  const lines = [
    "",
    "## PARTNERSHIP JOURNEY — DATA TARGETING RULES",
    "",
    "This journey has multiple co-primary partners. For EVERY contact-category",
    "extraction (field_category starts with 'contact'), you MUST set:",
    "  - target_contact_name: the specific partner the fact applies to",
    "  - target_scope: 'single' or 'both' (see rules below)",
    "",
    "### Partners on this journey:",
  ];
  for (const p of partners) {
    const role = p.role === "co_primary" ? "Co-primary" : "Primary";
    const highlight = p.profileHighlights ? ` — ${p.profileHighlights}` : "";
    lines.push(`- **${p.name}** (${role})${highlight}`);
  }

  lines.push(
    "",
    "### target_scope = 'both' for SHARED facts (applies to the partnership as a whole):",
    "  - capital_range, liquid_capital, net_worth_estimate, financing_type",
    "  - timeline_intent, decision_timeline, availability_confirmed",
    "  - market_interest, desired_territory, territory_type_preference, zip_codes_of_interest",
    "  - family_situation (if they share a household), lead_source, referral_source",
    "  - competitors_mentioned, fdd_questions, objections_raised",
    "",
    "### target_scope = 'single' for PARTNER-SPECIFIC facts:",
    "  - employment_status, current_employer, current_role, years_in_current_role",
    "  - skill_set_notes, prior_re_experience, prior_business_ownership",
    "  - education_level, military_background, hobbies_interests",
    "  - risk_tolerance, decision_making_style, stated_why, primary_motivation (when expressed individually)",
    "  - personality traits, licenses, expertise, background",
    "  - spouse_name, spouse_email, spouse_phone (these refer to ONE partner's spouse)",
    "",
    "### Rules:",
    "1. Do not extract EOS fields, commitments, todos, or action items.",
    "2. If you can't confidently attribute a contact fact to one partner, use 'both'.",
    "3. target_scope is REQUIRED on every contact-category extraction when this block is present.",
    "4. Territory-category extractions (field_category starts with 'territory') — ignore target_scope; route via target_territory as usual.",
    ""
  );
  return lines.join("\n");
}

/**
 * Build an explicit multi-contact extraction block for calls with 2+ external
 * contacts that are NOT partnerships (different journeys, e.g., coaching Dona + Todd).
 * Forces the LLM to extract data for EACH contact, not just the primary speaker.
 */
function buildMultiContactBlock(contactNames: string[]): string {
  return `
## MULTI-CONTACT CALL — EXTRACT FOR EVERY PERSON

**This call has ${contactNames.length} contacts. You MUST extract data for EACH one individually.**

Contacts on this call:
${contactNames.map((n) => `- **${n}**`).join("\n")}

**CRITICAL RULES:**
1. For EVERY extraction, set target_contact_name to the specific contact it applies to.
2. Do NOT default everything to one person — actively listen for what each contact says.
3. If Contact A discusses their territory operations, those extractions go to Contact A.
4. If Contact B shares personal info (goals, challenges, family), those go to Contact B.
5. Even if one person talks more, look for ANY mention of the other contacts' situations.
6. When the coach asks "how about you, [name]?" or "[name], what's your update?" — everything after belongs to that person.
7. If both contacts are discussed equally, you should have roughly equal extractions for each.
8. If a fact applies to both contacts equally, create SEPARATE extractions for each (same field_key, different target_contact_name).
9. Territory extractions: if each contact has a different territory, route territory data to the correct owner via target_territory.
10. You are FAILING if any contact has fewer than 5 extractions — go back and re-read what they discussed.
`;
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
    for (const p of prospects.slice(0, 50)) {
      // Cap at 50 for token budget
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
    } catch {
      /* fallthrough */
    }

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
    maxTokens: 32768,
  });
}
