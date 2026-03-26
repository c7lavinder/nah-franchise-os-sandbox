/**
 * Score Recommendation Engine
 *
 * Per Phase 3c: "What would move this score" — Scout recommendation.
 * Analyzes the current intelligence profile and suggests specific
 * actions that would increase the candidate's score.
 */

import type { CandidateIntelligence } from "./types";

/** A single recommendation */
export interface ScoreRecommendation {
  action: string;
  category: "financial" | "operational" | "engagement" | "momentum";
  potentialPoints: number;
  priority: "high" | "medium" | "low";
}

/**
 * Generate recommendations for what would move a candidate's score.
 * Returns actions sorted by potential impact (highest first).
 */
export function getScoreRecommendations(profile: CandidateIntelligence): ScoreRecommendation[] {
  const recs: ScoreRecommendation[] = [];

  // ─── Financial ───
  if (!profile.pfs_received) {
    recs.push({
      action: "Get PFS (Personal Financial Statement) from candidate",
      category: "financial",
      potentialPoints: 5,
      priority: "high",
    });
  }

  if (profile.funding_path === "unknown" || !profile.funding_path) {
    recs.push({
      action: "Identify funding path — discuss Guidant, SBA, or cash options",
      category: "financial",
      potentialPoints: 8,
      priority: "high",
    });
  }

  if (profile.liquid_capital === null || profile.liquid_capital === undefined) {
    recs.push({
      action: "Verify liquid capital amount during next call",
      category: "financial",
      potentialPoints: 10,
      priority: "high",
    });
  }

  // ─── Operational ───
  if (!profile.zorakle_completed) {
    recs.push({
      action: "Complete Zorakle assessment — unlocks personality profile and up to +10 points",
      category: "operational",
      potentialPoints: 10,
      priority: "medium",
    });
  }

  if (profile.construction_comfort === null || profile.construction_comfort === undefined) {
    recs.push({
      action: "Assess construction comfort level on next call",
      category: "operational",
      potentialPoints: 6,
      priority: "medium",
    });
  }

  // ─── Engagement ───
  const pct = profile.trainual_completion_pct ?? 0;
  if (pct < 100) {
    const pointsAvail = pct >= 50 ? 5 : 10;
    recs.push({
      action: pct === 0
        ? "Get candidate to start PTO (Trainual) — this is the #1 engagement predictor"
        : `PTO at ${pct}% — encourage completion for +${pointsAvail} points`,
      category: "engagement",
      potentialPoints: pointsAvail,
      priority: pct === 0 ? "high" : "medium",
    });
  }

  if (profile.homework_completion_rate === null || profile.homework_completion_rate === undefined || profile.homework_completion_rate < 0.8) {
    recs.push({
      action: "Assign and track homework before Matt Call",
      category: "engagement",
      potentialPoints: 5,
      priority: "medium",
    });
  }

  if (profile.avg_response_time_hours !== null && profile.avg_response_time_hours !== undefined && profile.avg_response_time_hours > 24) {
    recs.push({
      action: "Response time is slow — try a different communication channel (call vs text)",
      category: "engagement",
      potentialPoints: 5,
      priority: "low",
    });
  }

  // ─── Momentum ───
  const flags = (profile.active_flags as Array<{ text: string; severity: string }> | null) ?? [];
  const stallFlags = flags.filter((f) =>
    f.text.toLowerCase().includes("stall") || f.text.toLowerCase().includes("stale") || f.text.toLowerCase().includes("not responded")
  );

  if (stallFlags.length > 0) {
    recs.push({
      action: `Resolve ${stallFlags.length} active stall flag(s) — personal outreach from Chad`,
      category: "momentum",
      potentialPoints: stallFlags.length >= 2 ? 15 : 10,
      priority: "high",
    });
  }

  // ─── Objection Resolution ───
  const unresolvedObjections = flags.filter((f) =>
    f.text.toLowerCase().includes("objection") || f.text.toLowerCase().includes("concern")
  );
  if (unresolvedObjections.length > 0) {
    recs.push({
      action: "Address unresolved objections — capital concerns suppress the score by up to 10 points each",
      category: "financial",
      potentialPoints: 10,
      priority: "high",
    });
  }

  // Sort by potential impact
  recs.sort((a, b) => b.potentialPoints - a.potentialPoints);

  return recs;
}
