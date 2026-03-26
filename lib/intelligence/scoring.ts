/**
 * Candidate Intelligence Scoring Engine
 *
 * Implements the explainable 100-point score from the intelligence plan:
 * - Financial Readiness (0-25)
 * - Operational Fit (0-25)
 * - Engagement Quality (0-25)
 * - Pipeline Momentum (0-25)
 *
 * Every point change is logged to candidate_score_history with explanation.
 */

import { createServerClient } from "@/lib/supabase/server";
import type { CandidateIntelligence } from "./types";

/** A single score change explanation */
interface ScoreChange {
  field: string;
  delta: number;
  reason: string;
}

/** Full score result with breakdown */
export interface ScoreResult {
  total: number;
  financial: number;
  operational: number;
  engagement: number;
  momentum: number;
  changes: ScoreChange[];
}

/**
 * Calculate the full 100-point score for a candidate.
 * Uses data from candidate_intelligence + call_logs + pipeline state.
 */
export function calculateScore(profile: CandidateIntelligence): ScoreResult {
  const changes: ScoreChange[] = [];

  const financial = scoreFinancial(profile, changes);
  const operational = scoreOperational(profile, changes);
  const engagement = scoreEngagement(profile, changes);
  const momentum = scoreMomentum(profile, changes);

  return {
    total: financial + operational + engagement + momentum,
    financial,
    operational,
    engagement,
    momentum,
    changes,
  };
}

/** Financial Readiness (0-25) — per intelligence plan score architecture */
function scoreFinancial(p: CandidateIntelligence, changes: ScoreChange[]): number {
  let score = 0;

  // Liquid capital (0-10)
  if (p.liquid_capital !== null && p.liquid_capital !== undefined) {
    if (p.liquid_capital >= 100000) {
      score += 10;
      changes.push({ field: "liquid_capital", delta: 10, reason: "Liquid capital 100k+" });
    } else if (p.liquid_capital >= 75000) {
      score += 7;
      changes.push({ field: "liquid_capital", delta: 7, reason: "Liquid capital 75-100k" });
    } else if (p.liquid_capital >= 50000) {
      score += 4;
      changes.push({ field: "liquid_capital", delta: 4, reason: "Liquid capital 50-75k" });
    }
  }

  // Funding path (0-8)
  if (p.funding_path && p.funding_path !== "unknown") {
    if (["cash", "guidant", "sba", "combination"].includes(p.funding_path)) {
      score += 8;
      changes.push({ field: "funding_path", delta: 8, reason: `Funding path confirmed: ${p.funding_path}` });
    }
  } else if (p.funding_path === "unknown") {
    score += 4;
    changes.push({ field: "funding_path", delta: 4, reason: "Funding path identified but not confirmed" });
  }

  // PFS received (0-5)
  if (p.pfs_received) {
    score += 5;
    changes.push({ field: "pfs_received", delta: 5, reason: "PFS received and reviewed" });
  }

  // Financial red flags (-3 to -5)
  const flags = (p.financial_red_flags as string[] | null) ?? [];
  if (flags.length > 0) {
    const penalty = flags.some((f) => f.toLowerCase().includes("undercapitalized")) ? -5 : -3;
    score += penalty;
    changes.push({ field: "financial_red_flags", delta: penalty, reason: `Financial red flag: ${flags[0]}` });
  }

  return Math.max(0, Math.min(25, score));
}

/** Operational Fit (0-25) */
function scoreOperational(p: CandidateIntelligence, changes: ScoreChange[]): number {
  let score = 0;

  // Prior business owner (+5)
  if (p.prior_business_owner) {
    score += 5;
    changes.push({ field: "prior_business_owner", delta: 5, reason: "Prior business owner" });
  }

  // Construction comfort (0-6)
  if (p.construction_comfort === "hands_on") {
    score += 6;
    changes.push({ field: "construction_comfort", delta: 6, reason: "Construction comfort: hands-on" });
  } else if (p.construction_comfort === "oversight_only") {
    score += 4;
    changes.push({ field: "construction_comfort", delta: 4, reason: "Construction comfort: project oversight" });
  }

  // Zorakle completed (+4) + strong fit (+6)
  if (p.zorakle_completed) {
    score += 4;
    changes.push({ field: "zorakle_completed", delta: 4, reason: "Zorakle assessment completed" });

    const results = p.zorakle_results as Record<string, unknown> | null;
    if (results?.fit_score && (results.fit_score as number) >= 70) {
      score += 6;
      changes.push({ field: "zorakle_results", delta: 6, reason: "Strong Zorakle fit profile" });
    }
  }

  // DISC personality flags
  if (p.disc_profile === "D") {
    score -= 5;
    changes.push({ field: "disc_profile", delta: -5, reason: "D personality — analysis paralysis risk at offer stage" });
  } else if (p.disc_profile === "I") {
    score -= 3;
    changes.push({ field: "disc_profile", delta: -3, reason: "High I personality — oversell risk" });
  }

  return Math.max(0, Math.min(25, score));
}

/** Engagement Quality (0-25) */
function scoreEngagement(p: CandidateIntelligence, changes: ScoreChange[]): number {
  let score = 0;

  // Trainual completion (0-10, or -15 if not started after 5 days)
  const pct = p.trainual_completion_pct ?? 0;
  if (pct >= 100) {
    score += 10;
    changes.push({ field: "trainual_completion_pct", delta: 10, reason: "PTO completion 100%" });
  } else if (pct >= 50) {
    score += 5;
    changes.push({ field: "trainual_completion_pct", delta: 5, reason: `PTO completion ${pct}%` });
  } else if (pct === 0 && p.trainual_last_activity === null) {
    // Check if they should have started by now (5+ days since creation)
    const daysSinceCreated = Math.floor(
      (Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceCreated >= 5) {
      score -= 15;
      changes.push({ field: "trainual_completion_pct", delta: -15, reason: "PTO not started after 5 days — 84% never complete it" });
    }
  }

  // Homework completion (+5)
  if (p.homework_completion_rate !== null && p.homework_completion_rate !== undefined && p.homework_completion_rate >= 0.8) {
    score += 5;
    changes.push({ field: "homework_completion_rate", delta: 5, reason: "Homework done on Matt call" });
  }

  // Response time (+5)
  if (p.avg_response_time_hours !== null && p.avg_response_time_hours !== undefined && p.avg_response_time_hours <= 4) {
    score += 5;
    changes.push({ field: "avg_response_time_hours", delta: 5, reason: "Response time under 4 hours" });
  }

  return Math.max(0, Math.min(25, score));
}

/** Pipeline Momentum (0-25) */
function scoreMomentum(p: CandidateIntelligence, changes: ScoreChange[]): number {
  let score = 0;

  // Base momentum — having a score at all means some progress
  const activeFlags = (p.active_flags as string[] | null) ?? [];
  const stallAlerts = activeFlags.filter((f) =>
    f.toLowerCase().includes("stall") || f.toLowerCase().includes("stale")
  );

  if (stallAlerts.length === 0) {
    score += 15;
    changes.push({ field: "momentum", delta: 15, reason: "Progressing on pace (no stall alerts)" });
  } else if (stallAlerts.length === 1) {
    score += 8;
    score -= 5;
    changes.push({ field: "momentum", delta: -5, reason: `Stall alert active: ${stallAlerts[0]}` });
  } else {
    score -= 10;
    changes.push({ field: "momentum", delta: -10, reason: `Multiple stall alerts (${stallAlerts.length})` });
  }

  return Math.max(0, Math.min(25, score));
}

/**
 * Recalculate and save score for a candidate.
 * Logs the change to candidate_score_history.
 */
export async function updateCandidateScore(
  contactId: string,
  triggeredBy: string,
  triggerId?: string
): Promise<ScoreResult> {
  const supabase = createServerClient();

  // Get current profile
  const { data: profile } = await supabase
    .from("candidate_intelligence")
    .select("*")
    .eq("contact_id", contactId)
    .single();

  if (!profile) {
    return { total: 0, financial: 0, operational: 0, engagement: 0, momentum: 0, changes: [] };
  }

  const typedProfile = profile as CandidateIntelligence;
  const result = calculateScore(typedProfile);

  // Log the score change
  await supabase.from("candidate_score_history").insert({
    contact_id: contactId,
    triggered_by: triggeredBy,
    trigger_id: triggerId ?? null,
    score_before: typedProfile.current_score,
    score_after: result.total,
    financial_before: typedProfile.score_financial,
    financial_after: result.financial,
    operational_before: typedProfile.score_operational,
    operational_after: result.operational,
    engagement_before: typedProfile.score_engagement,
    engagement_after: result.engagement,
    momentum_before: typedProfile.score_momentum,
    momentum_after: result.momentum,
    changes_explained: result.changes,
  });

  // Update the profile with new scores
  await supabase
    .from("candidate_intelligence")
    .update({
      current_score: result.total,
      score_financial: result.financial,
      score_operational: result.operational,
      score_engagement: result.engagement,
      score_momentum: result.momentum,
      updated_at: new Date().toISOString(),
    })
    .eq("contact_id", contactId);

  return result;
}
