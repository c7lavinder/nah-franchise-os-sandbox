/**
 * Lookalike Scoring — FRANCHISE CONVERSION RESEMBLANCE
 *
 * Purpose: Answers "How much does this prospect look like someone who converted?"
 * Compares a prospect's profile against the pattern of 71 converted franchisees.
 *
 * This is SEPARATE from:
 *   - Lead Scoring (lib/profile/lead-scoring.ts) → "Is this a hot lead?" (rep daily view)
 *   - Intelligence Scoring (lib/intelligence/scoring.ts) → "Can this person succeed?" (leadership)
 *
 * Lookalike answers a different question: "Does this prospect match the PROFILE of past winners?"
 * It's backward-looking (pattern matching) rather than forward-looking (predictive).
 *
 * Score: 0-100 with tier labels (Strong Match / Moderate / Weak / No Match)
 *
 * When labeled outcome data (30+ formally "lost" contacts) becomes available,
 * this can be upgraded to a trained model. Until then, rule-based weights.
 */

// ════════════════════════════════════════════════════════════════════
// CONVERTED FRANCHISEE BASELINE (from phase10-data-audit analysis)
// ════════════════════════════════════════════════════════════════════

// These are the observed patterns from 71 converted franchisees as of 2026-05-22.
// Weights reflect how strongly each trait correlates with conversion.

export interface LookalikeInput {
  // Profile completeness
  profileFieldCount: number;

  // Source & demographics
  opportunitySource: string | null;
  state: string | null;

  // Engagement signals
  callCount: number;
  commitmentCount: number;
  commitmentFulfillmentRate: number | null; // 0-1

  // Financial readiness
  capitalAvailability: string | null;
  fundingPath: string | null;
  hasPfs: boolean;

  // Intelligence score (if available)
  intelligenceScore: number | null;

  // Operational fit
  priorBusinessOwner: boolean | null;
  constructionComfort: string | null;
  spouseSupportive: string | null;

  // Engagement quality
  trainualCompletionPct: number | null;
  avgResponseTimeHours: number | null;

  // Timeline
  urgency: string | null;
}

export interface LookalikeResult {
  score: number;
  tier: "Strong Match" | "Moderate" | "Weak" | "No Match";
  breakdown: {
    profileCompleteness: number;
    engagementDepth: number;
    financialReadiness: number;
    operationalFit: number;
    behavioralSignals: number;
  };
  topMatchFactors: string[];
  topGaps: string[];
}

// ════════════════════════════════════════════════════════════════════
// SCORING DIMENSIONS (5 dimensions, 20 points each = 100 total)
// ════════════════════════════════════════════════════════════════════

/** Profile Completeness (0-20) — converted franchisees avg ~10 fields */
function scoreProfileCompleteness(input: LookalikeInput, factors: string[], gaps: string[]): number {
  const count = input.profileFieldCount;

  // Converted franchisees: top had 14, median ~8, mean ~6
  if (count >= 12) {
    factors.push("Rich profile (12+ fields)");
    return 20;
  }
  if (count >= 8) {
    factors.push("Good profile depth (8+ fields)");
    return 16;
  }
  if (count >= 5) {
    factors.push("Moderate profile (5+ fields)");
    return 12;
  }
  if (count >= 3) {
    gaps.push("Thin profile — only " + count + " fields");
    return 7;
  }
  gaps.push("Very sparse profile — " + count + " fields");
  return 3;
}

/** Engagement Depth (0-20) — converted franchisees: median 2 calls, mean 9.2 commitments */
function scoreEngagementDepth(input: LookalikeInput, factors: string[], gaps: string[]): number {
  let score = 0;

  // Call count (0-10): converted median = 2, range 1-5
  if (input.callCount >= 3) {
    score += 10;
    factors.push("Multiple calls completed (" + input.callCount + ")");
  } else if (input.callCount >= 2) {
    score += 8;
    factors.push("2 calls completed");
  } else if (input.callCount >= 1) {
    score += 5;
  } else {
    gaps.push("No calls on record");
  }

  // Commitments (0-6): converted mean = 9.2
  if (input.commitmentCount >= 8) {
    score += 6;
    factors.push("Strong commitment history (" + input.commitmentCount + ")");
  } else if (input.commitmentCount >= 4) {
    score += 4;
  } else if (input.commitmentCount >= 1) {
    score += 2;
  } else {
    gaps.push("No commitments tracked");
  }

  // Commitment fulfillment (0-4)
  if (input.commitmentFulfillmentRate !== null) {
    if (input.commitmentFulfillmentRate >= 0.75) {
      score += 4;
      factors.push("High commitment fulfillment (" + Math.round(input.commitmentFulfillmentRate * 100) + "%)");
    } else if (input.commitmentFulfillmentRate >= 0.5) {
      score += 2;
    }
  }

  return Math.min(20, score);
}

/** Financial Readiness (0-20) */
function scoreFinancialReadiness(input: LookalikeInput, factors: string[], gaps: string[]): number {
  let score = 0;

  // Capital availability (0-8)
  if (input.capitalAvailability === "Confirmed") {
    score += 8;
    factors.push("Capital confirmed");
  } else if (input.capitalAvailability === "Needs Verification") {
    score += 5;
  } else if (input.capitalAvailability) {
    score += 3;
  } else {
    gaps.push("Capital availability unknown");
  }

  // Funding path (0-6)
  if (input.fundingPath && input.fundingPath !== "unknown") {
    score += 6;
    factors.push("Funding path: " + input.fundingPath);
  } else if (input.fundingPath === "unknown") {
    score += 2;
  } else {
    gaps.push("No funding path identified");
  }

  // PFS (0-6)
  if (input.hasPfs) {
    score += 6;
    factors.push("PFS submitted");
  }

  return Math.min(20, score);
}

/** Operational Fit (0-20) */
function scoreOperationalFit(input: LookalikeInput, factors: string[], gaps: string[]): number {
  let score = 0;

  // Prior business owner (0-6)
  if (input.priorBusinessOwner === true) {
    score += 6;
    factors.push("Prior business owner");
  } else if (input.priorBusinessOwner === false) {
    score += 3; // Not disqualifying
  }

  // Construction comfort (0-6)
  if (input.constructionComfort === "hands_on") {
    score += 6;
    factors.push("Construction: hands-on");
  } else if (input.constructionComfort === "oversight_only") {
    score += 4;
  } else if (input.constructionComfort === "no_experience") {
    score += 1;
    gaps.push("No construction experience");
  }

  // Spouse supportive (0-4)
  if (input.spouseSupportive === "yes") {
    score += 4;
    factors.push("Spouse supportive");
  } else if (input.spouseSupportive === "no") {
    gaps.push("Spouse not supportive");
  }

  // Intelligence score as a proxy for deep viability (0-4)
  if (input.intelligenceScore !== null) {
    if (input.intelligenceScore >= 60) {
      score += 4;
    } else if (input.intelligenceScore >= 40) {
      score += 2;
    }
  }

  return Math.min(20, score);
}

/** Behavioral Signals (0-20) — response speed, trainual, urgency, source quality */
function scoreBehavioralSignals(input: LookalikeInput, factors: string[], gaps: string[]): number {
  let score = 0;

  // Trainual completion (0-6): strong conversion signal
  if (input.trainualCompletionPct !== null) {
    if (input.trainualCompletionPct >= 75) {
      score += 6;
      factors.push("Trainual " + input.trainualCompletionPct + "% complete");
    } else if (input.trainualCompletionPct >= 50) {
      score += 4;
    } else if (input.trainualCompletionPct > 0) {
      score += 2;
    }
  }

  // Response time (0-4)
  if (input.avgResponseTimeHours !== null) {
    if (input.avgResponseTimeHours <= 4) {
      score += 4;
      factors.push("Fast responder (< 4h avg)");
    } else if (input.avgResponseTimeHours <= 12) {
      score += 2;
    }
  }

  // Urgency (0-4): converted franchisees: 22/27 were "exploring"
  if (input.urgency === "ready_now") {
    score += 4;
    factors.push("Ready to move now");
  } else if (input.urgency === "3_6_months") {
    score += 3;
  } else if (input.urgency === "exploring") {
    score += 2; // Most common among converted — not a strong signal either way
  }

  // Opportunity source (0-6): Referral strongest, Organic next
  if (input.opportunitySource) {
    const src = input.opportunitySource.toLowerCase();
    if (src.includes("referral")) {
      score += 6;
      factors.push("Referral source");
    } else if (src.includes("organic") || src.includes("website")) {
      score += 4;
      factors.push("Organic source");
    } else if (src.includes("event") || src.includes("show")) {
      score += 5;
    } else if (src.includes("paid") || src.includes("ad")) {
      score += 3;
    } else {
      score += 2;
    }
  }

  return Math.min(20, score);
}

// ════════════════════════════════════════════════════════════════════
// PUBLIC API
// ════════════════════════════════════════════════════════════════════

export function calculateLookalikeScore(input: LookalikeInput): LookalikeResult {
  const factors: string[] = [];
  const gaps: string[] = [];

  const breakdown = {
    profileCompleteness: scoreProfileCompleteness(input, factors, gaps),
    engagementDepth: scoreEngagementDepth(input, factors, gaps),
    financialReadiness: scoreFinancialReadiness(input, factors, gaps),
    operationalFit: scoreOperationalFit(input, factors, gaps),
    behavioralSignals: scoreBehavioralSignals(input, factors, gaps),
  };

  const score =
    breakdown.profileCompleteness +
    breakdown.engagementDepth +
    breakdown.financialReadiness +
    breakdown.operationalFit +
    breakdown.behavioralSignals;

  const tier: LookalikeResult["tier"] =
    score >= 70 ? "Strong Match" : score >= 45 ? "Moderate" : score >= 25 ? "Weak" : "No Match";

  return {
    score,
    tier,
    breakdown,
    topMatchFactors: factors.slice(0, 5),
    topGaps: gaps.slice(0, 3),
  };
}
