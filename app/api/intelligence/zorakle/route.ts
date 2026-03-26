export const dynamic = "force-dynamic";

/**
 * POST /api/intelligence/zorakle — Log Zorakle assessment results
 *
 * Accepts DISC profile, risk tolerance score, personality flags, and
 * optional fit score. Upserts candidate_intelligence with zorakle data,
 * recalculates score, and regenerates flags.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { updateCandidateScore } from "@/lib/intelligence/scoring";
import { updateCandidateFlags } from "@/lib/intelligence/flags";
import type { DiscProfile } from "@/lib/intelligence/types";

interface ZoraklePayload {
  contactId: string;
  discProfile: DiscProfile;
  riskToleranceScore: number;
  personalityFlags: string | null;
  fitScore: number | null;
}

const VALID_DISC: DiscProfile[] = ["D", "I", "S", "C"];

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ZoraklePayload;

    const { contactId, discProfile, riskToleranceScore, personalityFlags, fitScore } = body;

    // ─── Validation ───
    if (!contactId || !discProfile) {
      return NextResponse.json(
        { error: "contactId and discProfile are required" },
        { status: 400 }
      );
    }

    if (!VALID_DISC.includes(discProfile)) {
      return NextResponse.json(
        { error: "discProfile must be one of: D, I, S, C" },
        { status: 400 }
      );
    }

    if (typeof riskToleranceScore !== "number" || riskToleranceScore < 0 || riskToleranceScore > 100) {
      return NextResponse.json(
        { error: "riskToleranceScore must be a number between 0 and 100" },
        { status: 400 }
      );
    }

    if (fitScore !== null && fitScore !== undefined) {
      if (typeof fitScore !== "number" || fitScore < 0 || fitScore > 100) {
        return NextResponse.json(
          { error: "fitScore must be a number between 0 and 100 (or null)" },
          { status: 400 }
        );
      }
    }

    const supabase = createServerClient();
    const locationId = process.env.GHL_LOCATION_ID ?? "";

    // ─── Ensure candidate_intelligence row exists ───
    await supabase
      .from("candidate_intelligence")
      .upsert(
        { contact_id: contactId, ghl_location_id: locationId },
        { onConflict: "contact_id" }
      );

    // ─── Build zorakle_results JSON ───
    const zorakleResults: Record<string, unknown> = {
      disc_profile: discProfile,
      risk_tolerance_score: riskToleranceScore,
      personality_flags: personalityFlags,
      fit_score: fitScore,
      logged_at: new Date().toISOString(),
    };

    // ─── Build personality_flags array ───
    const flagsArray: Record<string, unknown>[] = [];
    if (personalityFlags) {
      flagsArray.push({
        text: personalityFlags,
        source: "zorakle",
        logged_at: new Date().toISOString(),
      });
    }

    // ─── Update candidate_intelligence ───
    const updateData: Record<string, unknown> = {
      zorakle_completed: true,
      zorakle_results: zorakleResults,
      disc_profile: discProfile,
      risk_tolerance_score: riskToleranceScore,
      updated_at: new Date().toISOString(),
    };

    if (flagsArray.length > 0) {
      updateData.personality_flags = flagsArray;
    }

    const { error: updateError } = await supabase
      .from("candidate_intelligence")
      .update(updateData)
      .eq("contact_id", contactId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // ─── Recalculate score ───
    const scoreResult = await updateCandidateScore(contactId, "zorakle");

    // ─── Regenerate flags ───
    const flags = await updateCandidateFlags(contactId);

    // ─── Return updated profile + score ───
    const { data: updatedProfile } = await supabase
      .from("candidate_intelligence")
      .select("*")
      .eq("contact_id", contactId)
      .single();

    return NextResponse.json({
      profile: updatedProfile,
      score: scoreResult,
      flags,
    }, { status: 200 });
  } catch (err) {
    console.error("POST zorakle error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
