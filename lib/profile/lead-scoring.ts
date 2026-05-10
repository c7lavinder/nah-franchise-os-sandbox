/**
 * Lead Scoring Engine — SALES PRIORITIZATION (early pipeline)
 *
 * Purpose: Tells reps WHO to call today. Used for pipeline leads in
 * Engagement → Discovery stages. Quick signal: Hot / Warm / Cool / Cold.
 *
 * This is SEPARATE from the Intelligence Scoring system in
 * lib/intelligence/scoring.ts, which answers "Can this person succeed
 * as a franchisee?" using deeper behavioral data (Zorakle, DISC, Trainual).
 *
 * See ADR-0012 for the decision to keep these as distinct systems.
 *
 * Calculates a 0-100 score for a contact based on the weighted model
 * defined in docs/pipeline.md:
 *
 * | Factor                          | Weight |
 * |---------------------------------|--------|
 * | Lead source quality             | 20%    |
 * | Capital awareness/availability  | 20%    |
 * | Territory availability          | 15%    |
 * | Engagement and response speed   | 15%    |
 * | Business ownership experience   | 15%    |
 * | Timeline                        | 15%    |
 *
 * Score tiers:
 * 80-100: Hot — priority in Chad's daily view
 * 60-79:  Warm — active follow-up
 * 40-59:  Cool — standard cadence
 * Below 40: Cold — nurture or disqualify
 */

interface ScoringInput {
  source: string | null;
  capitalAvailability: string | null;
  capitalSource: string | null;
  territoryStatus: string | null;
  lastTouchDate: string | null;
  daysSinceAdded: number;
  contactAttemptCount: number | null;
  businessOwnershipExperience: string | null;
  investmentTimeline: string | null;
  timelineToOpen: string | null;
  motivationClarity: string | null;
  trainualCompletion: number | null;
}

interface ScoreResult {
  total: number;
  tier: "Hot" | "Warm" | "Cool" | "Cold";
  breakdown: string;
  components: {
    source: number;
    capital: number;
    territory: number;
    engagement: number;
    experience: number;
    timeline: number;
  };
}

/** Score lead source quality (0-20 points) */
function scoreSource(source: string | null): number {
  if (!source) return 5;
  const s = source.toLowerCase();
  if (s.includes("referral")) return 20;
  if (s.includes("organic") || s.includes("website")) return 14;
  if (s.includes("event") || s.includes("show")) return 16;
  if (s.includes("paid") || s.includes("ad")) return 10;
  return 8; // Unknown source
}

/** Score capital awareness and availability (0-20 points) */
function scoreCapital(availability: string | null, capitalSource: string | null): number {
  let score = 0;

  // Capital availability (0-12)
  switch (availability) {
    case "Confirmed":
      score += 12;
      break;
    case "Needs Verification":
      score += 7;
      break;
    case "Unknown":
      score += 3;
      break;
    default:
      score += 2; // Not filled
  }

  // Capital source identified (0-8)
  if (!capitalSource || capitalSource === "Undecided") {
    score += 2;
  } else {
    score += 8; // Any specific source is a strong signal
  }

  return score;
}

/** Score territory availability (0-15 points) */
function scoreTerritory(status: string | null): number {
  switch (status) {
    case "Confirmed":
      return 15;
    case "Available":
      return 13;
    case "Waitlist":
      return 7;
    case "Unavailable":
      return 2;
    default:
      return 5; // Not assessed yet
  }
}

/** Score engagement and response speed (0-15 points) */
function scoreEngagement(
  lastTouchDate: string | null,
  daysSinceAdded: number,
  attemptCount: number | null,
  trainualCompletion: number | null
): number {
  let score = 0;

  // Recency of last touch (0-6)
  if (lastTouchDate) {
    const daysSinceTouch = Math.floor((Date.now() - new Date(lastTouchDate).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceTouch <= 1) score += 6;
    else if (daysSinceTouch <= 3) score += 5;
    else if (daysSinceTouch <= 7) score += 3;
    else if (daysSinceTouch <= 14) score += 1;
  } else {
    score += 2; // No touch data — neutral
  }

  // Speed to engage (0-4) — how quickly they entered the pipeline
  if (daysSinceAdded <= 7) score += 4;
  else if (daysSinceAdded <= 14) score += 3;
  else if (daysSinceAdded <= 30) score += 2;
  else score += 1;

  // Trainual engagement (0-5)
  if (trainualCompletion !== null) {
    if (trainualCompletion >= 75) score += 5;
    else if (trainualCompletion >= 50) score += 4;
    else if (trainualCompletion >= 25) score += 3;
    else if (trainualCompletion > 0) score += 2;
  }

  return Math.min(score, 15);
}

/** Score business ownership experience (0-15 points) */
function scoreExperience(businessOwnership: string | null, motivationClarity: string | null): number {
  let score = 0;

  // Business ownership (0-8)
  if (businessOwnership === "Yes") score += 8;
  else if (businessOwnership === "No")
    score += 4; // Not disqualifying — just less experienced
  else score += 3; // Unknown

  // Motivation clarity (0-7)
  switch (motivationClarity) {
    case "Strong":
      score += 7;
      break;
    case "Moderate":
      score += 4;
      break;
    case "Weak":
      score += 1;
      break;
    default:
      score += 3; // Unknown
  }

  return Math.min(score, 15);
}

/** Score timeline (0-15 points) */
function scoreTimeline(investmentTimeline: string | null, timelineToOpen: string | null): number {
  // Use investment timeline if available, fall back to timeline to open
  const timeline = investmentTimeline ?? timelineToOpen;

  switch (timeline) {
    case "Immediately":
      return 15;
    case "Under 6 months":
      return 13;
    case "1-3 months":
      return 14;
    case "3-6 months":
      return 11;
    case "6-12 months":
      return 7;
    case "6-12 months":
      return 7;
    case "12+ months":
      return 3;
    case "12+ months":
      return 3;
    default:
      return 5; // Unknown
  }
}

/** Calculate the full lead score for a contact */
export function calculateLeadScore(input: ScoringInput): ScoreResult {
  const components = {
    source: scoreSource(input.source),
    capital: scoreCapital(input.capitalAvailability, input.capitalSource),
    territory: scoreTerritory(input.territoryStatus),
    engagement: scoreEngagement(
      input.lastTouchDate,
      input.daysSinceAdded,
      input.contactAttemptCount,
      input.trainualCompletion
    ),
    experience: scoreExperience(input.businessOwnershipExperience, input.motivationClarity),
    timeline: scoreTimeline(input.investmentTimeline, input.timelineToOpen),
  };

  const total =
    components.source +
    components.capital +
    components.territory +
    components.engagement +
    components.experience +
    components.timeline;

  const tier: ScoreResult["tier"] = total >= 80 ? "Hot" : total >= 60 ? "Warm" : total >= 40 ? "Cool" : "Cold";

  const breakdown = [
    `source:${components.source}/20`,
    `capital:${components.capital}/20`,
    `territory:${components.territory}/15`,
    `engagement:${components.engagement}/15`,
    `experience:${components.experience}/15`,
    `timeline:${components.timeline}/15`,
  ].join(" ");

  return { total, tier, breakdown, components };
}

/** Build scoring input from a Supabase contacts row */
export function buildScoringInputFromContact(contact: {
  source?: string | null;
  opportunity_source?: string | null;
  NonRetirementCapitalAvailable?: string | null;
  territory_status?: string | null;
  BriefWorkHistory?: string | null;
  investment_timeline?: string | null;
  WhatInterestsInOpportunity?: string | null;
  trainual_completion_pct?: number | null;
  created_at: string;
}): ScoringInput {
  return {
    source: contact.opportunity_source ?? contact.source ?? null,
    capitalAvailability: contact.NonRetirementCapitalAvailable ?? null,
    capitalSource: null,
    territoryStatus: contact.territory_status ?? null,
    lastTouchDate: null,
    daysSinceAdded: Math.floor((Date.now() - new Date(contact.created_at).getTime()) / (1000 * 60 * 60 * 24)),
    contactAttemptCount: null,
    businessOwnershipExperience: contact.BriefWorkHistory ?? null,
    investmentTimeline: contact.investment_timeline ?? null,
    timelineToOpen: null,
    motivationClarity: contact.WhatInterestsInOpportunity ?? null,
    trainualCompletion: contact.trainual_completion_pct ?? null,
  };
}
