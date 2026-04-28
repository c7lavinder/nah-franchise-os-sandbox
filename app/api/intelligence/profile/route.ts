export const dynamic = "force-dynamic";

/**
 * GET /api/intelligence/profile?contactId=X
 *
 * Returns the full intelligence profile for a candidate:
 * - candidate_intelligence record
 * - call logs
 * - score history (last 5 changes)
 * - active objections
 * - generated flags
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";import { createServerClient } from "@/lib/supabase/server";
import { generateFlags } from "@/lib/intelligence/flags";
import { getScoreRecommendations } from "@/lib/intelligence/recommendations";
import type { CandidateIntelligence } from "@/lib/intelligence/types";

export async function GET(request: NextRequest) {
  { const _auth = await requireAuth(request); if (_auth instanceof Response) return _auth; }
  try {
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get("contactId");

    if (!contactId) {
      return NextResponse.json({ error: "contactId is required" }, { status: 400 });
    }

    const supabase = createServerClient();

    // Fetch all intelligence data in parallel
    const [profileRes, callLogsRes, scoreHistoryRes, objectionsRes] = await Promise.all([
      supabase
        .from("candidate_intelligence")
        .select("*")
        .eq("contact_id", contactId)
        .single(),
      supabase
        .from("call_logs")
        .select("*")
        .eq("contact_id", contactId)
        .order("called_at", { ascending: false }),
      supabase
        .from("candidate_score_history")
        .select("*")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("objection_registry")
        .select("*")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false }),
    ]);

    const profile = profileRes.data as CandidateIntelligence | null;
    const flags = profile ? generateFlags(profile) : [];
    const recommendations = profile ? getScoreRecommendations(profile) : [];

    return NextResponse.json({
      profile: profile ?? null,
      callLogs: callLogsRes.data ?? [],
      scoreHistory: scoreHistoryRes.data ?? [],
      objections: objectionsRes.data ?? [],
      flags,
      recommendations,
    });
  } catch (err) {
    console.error("GET intelligence profile error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
