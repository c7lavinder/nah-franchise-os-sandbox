/**
 * Automated Flag Generator
 *
 * Generates NAH-specific intelligence flags based on candidate data.
 * These are not generic stall alerts — they're specific to the NAH franchise
 * sales process and help the team know exactly what to do next.
 *
 * Per intelligence plan: flags are Scout-generated and explain the "why".
 */

import { createServerClient } from "@/lib/supabase/server";
import type { CandidateIntelligence } from "./types";

/** A generated flag with severity and context */
export interface IntelligenceFlag {
  text: string;
  severity: "info" | "warning" | "critical";
  category: "financial" | "engagement" | "personality" | "process" | "timing";
  createdAt: string;
}

/**
 * Generate flags for a candidate based on their intelligence profile.
 * Returns an array of flags sorted by severity (critical first).
 */
export function generateFlags(profile: CandidateIntelligence): IntelligenceFlag[] {
  const flags: IntelligenceFlag[] = [];
  const now = new Date().toISOString();

  // ─── Financial Flags ───
  if (profile.funding_path === "unknown") {
    flags.push({
      text: "Funding path unclear — PFS shows insufficient liquid capital for escrow",
      severity: "warning",
      category: "financial",
      createdAt: now,
    });
  }

  if (profile.liquid_capital !== null && profile.liquid_capital !== undefined && profile.liquid_capital < 50000) {
    flags.push({
      text: "Liquid capital under $50k — may not qualify without alternative funding",
      severity: "critical",
      category: "financial",
      createdAt: now,
    });
  }

  const financialFlags = (profile.financial_red_flags as string[] | null) ?? [];
  for (const flag of financialFlags) {
    flags.push({
      text: flag,
      severity: "critical",
      category: "financial",
      createdAt: now,
    });
  }

  // ─── Engagement Flags ───
  const pct = profile.trainual_completion_pct ?? 0;
  if (pct === 0 && profile.trainual_last_activity === null) {
    const daysSinceCreated = Math.floor(
      (Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceCreated >= 5) {
      flags.push({
        text: `PTO not started — 84% of candidates who don't start within 5 days never complete it (${daysSinceCreated} days since created)`,
        severity: "critical",
        category: "engagement",
        createdAt: now,
      });
    }
  } else if (pct >= 100) {
    // Check if they've stalled after completing PTO
    // This is a positive flag but worth noting
    flags.push({
      text: "PTO 100% complete — high engagement signal",
      severity: "info",
      category: "engagement",
      createdAt: now,
    });
  }

  if (profile.avg_response_time_hours !== null && profile.avg_response_time_hours !== undefined && profile.avg_response_time_hours > 72) {
    flags.push({
      text: `Candidate has not responded in ${Math.round(profile.avg_response_time_hours / 24)} days — surface to Chad for personal touch`,
      severity: "warning",
      category: "engagement",
      createdAt: now,
    });
  }

  // ─── Personality Flags ───
  if (profile.disc_profile === "D") {
    flags.push({
      text: "D personality — watch for analysis paralysis at offer stage",
      severity: "warning",
      category: "personality",
      createdAt: now,
    });
  }

  if (profile.disc_profile === "I") {
    flags.push({
      text: "High I personality — may oversell themselves on readiness, verify financials carefully",
      severity: "info",
      category: "personality",
      createdAt: now,
    });
  }

  // ─── Process Flags ───
  if (!profile.pfs_received && profile.funding_path !== "cash") {
    flags.push({
      text: "PFS not received — cannot verify financial readiness",
      severity: "warning",
      category: "process",
      createdAt: now,
    });
  }

  if (!profile.zorakle_completed) {
    flags.push({
      text: "Zorakle assessment not completed — personality profile unknown",
      severity: "info",
      category: "process",
      createdAt: now,
    });
  }

  if (profile.spouse_supportive === "no") {
    flags.push({
      text: "Spouse not supportive — significant risk factor for franchise purchase",
      severity: "critical",
      category: "process",
      createdAt: now,
    });
  }

  if (profile.spouse_supportive === "unknown") {
    flags.push({
      text: "Spouse support status unknown — Chad should ask on next call",
      severity: "info",
      category: "process",
      createdAt: now,
    });
  }

  // Sort: critical first, then warning, then info
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  flags.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return flags;
}

/**
 * Generate and save flags for a candidate.
 * Updates the active_flags field on candidate_intelligence.
 */
export async function updateCandidateFlags(contactId: string): Promise<IntelligenceFlag[]> {
  const supabase = createServerClient();

  const { data: profile } = await supabase
    .from("candidate_intelligence")
    .select("*")
    .eq("contact_id", contactId)
    .single();

  if (!profile) return [];

  const flags = generateFlags(profile as CandidateIntelligence);

  await supabase
    .from("candidate_intelligence")
    .update({
      active_flags: flags,
      updated_at: new Date().toISOString(),
    })
    .eq("contact_id", contactId);

  return flags;
}
