export const dynamic = "force-dynamic";

/**
 * GET /api/intelligence/scores?tier=high|medium|low&minScore=X&maxScore=X
 *
 * Returns candidate intelligence scores for pipeline filtering.
 * Leadership can filter leads by score tier.
 *
 * Tiers:
 * - high: 70-100
 * - medium: 40-69
 * - low: 0-39
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const TIERS: Record<string, { min: number; max: number }> = {
  high: { min: 70, max: 100 },
  medium: { min: 40, max: 69 },
  low: { min: 0, max: 39 },
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tier = searchParams.get("tier");
    const minScore = searchParams.get("minScore");
    const maxScore = searchParams.get("maxScore");

    const supabase = createServerClient();

    let query = supabase
      .from("candidate_intelligence")
      .select("contact_id, current_score, score_financial, score_operational, score_engagement, score_momentum, active_flags, disc_profile, funding_path, urgency")
      .order("current_score", { ascending: false });

    if (tier && TIERS[tier]) {
      query = query
        .gte("current_score", TIERS[tier].min)
        .lte("current_score", TIERS[tier].max);
    } else {
      if (minScore) query = query.gte("current_score", parseInt(minScore));
      if (maxScore) query = query.lte("current_score", parseInt(maxScore));
    }

    const { data: scores, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Build a contact_id → score map for fast lookup
    const scoreMap: Record<string, {
      score: number;
      financial: number;
      operational: number;
      engagement: number;
      momentum: number;
      flagCount: number;
    }> = {};

    for (const s of scores ?? []) {
      scoreMap[s.contact_id] = {
        score: s.current_score ?? 0,
        financial: s.score_financial ?? 0,
        operational: s.score_operational ?? 0,
        engagement: s.score_engagement ?? 0,
        momentum: s.score_momentum ?? 0,
        flagCount: Array.isArray(s.active_flags) ? (s.active_flags as unknown[]).length : 0,
      };
    }

    return NextResponse.json({
      scores: scores ?? [],
      scoreMap,
      total: (scores ?? []).length,
    });
  } catch (err) {
    console.error("GET intelligence scores error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
