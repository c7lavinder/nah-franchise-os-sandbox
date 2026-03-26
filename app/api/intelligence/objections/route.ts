export const dynamic = "force-dynamic";

/**
 * GET  /api/intelligence/objections?contactId=X — list objections for a contact
 * POST /api/intelligence/objections — manually log an objection
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { updateCandidateScore } from "@/lib/intelligence/scoring";
import { updateCandidateFlags } from "@/lib/intelligence/flags";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get("contactId");

    if (!contactId) {
      return NextResponse.json({ error: "contactId is required" }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("objection_registry")
      .select("*")
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ objections: data ?? [] });
  } catch (err) {
    console.error("GET objections error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const body = await request.json();

    const { contactId, stageAtTime, objectionType, objectionDetail, callLogId } = body;

    if (!contactId || !objectionType) {
      return NextResponse.json(
        { error: "contactId and objectionType are required" },
        { status: 400 }
      );
    }

    // Score impact based on objection type
    const impactMap: Record<string, number> = {
      capital: -10,
      value: -5,
      timing: -3,
      territory: -5,
      going_cold: -8,
      royalty: -5,
      other: -3,
    };

    const { data: objection, error } = await supabase
      .from("objection_registry")
      .insert({
        contact_id: contactId,
        stage_at_time: stageAtTime ?? "Unknown",
        call_log_id: callLogId ?? null,
        objection_type: objectionType,
        objection_detail: objectionDetail ?? null,
        score_impact: impactMap[objectionType] ?? -3,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Recalculate score and flags
    await updateCandidateScore(contactId, "objection", objection.id);
    await updateCandidateFlags(contactId);

    return NextResponse.json({ objection }, { status: 201 });
  } catch (err) {
    console.error("POST objection error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
