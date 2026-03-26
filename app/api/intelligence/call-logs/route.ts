export const dynamic = "force-dynamic";

/**
 * GET  /api/intelligence/call-logs?contactId=X — list call logs for a contact
 * POST /api/intelligence/call-logs — create a new call log
 *
 * On POST: saves the call log, updates candidate_intelligence profile,
 * recalculates score, and generates flags.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { updateCandidateScore } from "@/lib/intelligence/scoring";
import { updateCandidateFlags } from "@/lib/intelligence/flags";
import type { CallLogInsert } from "@/lib/intelligence/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get("contactId");

    if (!contactId) {
      return NextResponse.json({ error: "contactId is required" }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data: logs, error } = await supabase
      .from("call_logs")
      .select("*")
      .eq("contact_id", contactId)
      .order("called_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ callLogs: logs ?? [] });
  } catch (err) {
    console.error("GET call-logs error:", err);
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

    const { contactId, callType, loggedBy, calledAt, fields, transcriptUrl, aiPrefilled, repConfidence, redFlagsRaised, notes } = body;

    if (!contactId || !callType || !loggedBy || !fields) {
      return NextResponse.json(
        { error: "contactId, callType, loggedBy, and fields are required" },
        { status: 400 }
      );
    }

    // Create the call log
    const insert: CallLogInsert = {
      contact_id: contactId,
      call_type: callType,
      logged_by: loggedBy,
      called_at: calledAt ?? new Date().toISOString(),
      fields,
      transcript_url: transcriptUrl ?? null,
      ai_prefilled: aiPrefilled ?? false,
      human_confirmed: true, // If they're submitting, they've confirmed
      rep_confidence: repConfidence ?? null,
      red_flags_raised: redFlagsRaised ?? null,
      notes: notes ?? null,
    };

    const { data: callLog, error } = await supabase
      .from("call_logs")
      .insert(insert)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Ensure candidate_intelligence profile exists
    const locationId = process.env.GHL_LOCATION_ID ?? "";
    await supabase
      .from("candidate_intelligence")
      .upsert(
        { contact_id: contactId, ghl_location_id: locationId },
        { onConflict: "contact_id" }
      );

    // Update candidate profile from call log fields
    await updateProfileFromCallLog(contactId, callType, fields);

    // Recalculate score
    const scoreResult = await updateCandidateScore(contactId, "call_log", callLog.id);

    // Generate flags
    const flags = await updateCandidateFlags(contactId);

    // Log objections if any were raised
    await logObjectionsFromCall(contactId, callType, fields, callLog.id);

    return NextResponse.json({
      callLog,
      score: scoreResult,
      flags,
    }, { status: 201 });
  } catch (err) {
    console.error("POST call-logs error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

/** Update candidate_intelligence profile based on call log structured fields */
async function updateProfileFromCallLog(
  contactId: string,
  callType: string,
  fields: Record<string, unknown>
): Promise<void> {
  const supabase = createServerClient();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (callType === "intro") {
    if (fields.stated_motivation) updates.stated_motivation = fields.stated_motivation;
    if (fields.prior_business_owner !== undefined) updates.prior_business_owner = fields.prior_business_owner === "yes" || fields.prior_business_owner === true;
    if (fields.prior_business_type) updates.prior_business_type = fields.prior_business_type;
    if (fields.construction_comfort) updates.construction_comfort = fields.construction_comfort;
    if (fields.spouse_supportive) updates.spouse_supportive = fields.spouse_supportive;
    if (fields.urgency) updates.urgency = fields.urgency;
    if (fields.funding_path) updates.funding_path = fields.funding_path;

    // Map liquid capital dropdown to dollar amount
    const capitalMap: Record<string, number> = {
      under_50k: 25000,
      "50_75k": 62500,
      "75_100k": 87500,
      "100k_plus": 150000,
    };
    if (fields.liquid_capital && typeof fields.liquid_capital === "string") {
      updates.liquid_capital = capitalMap[fields.liquid_capital] ?? null;
    }
  }

  if (callType === "matt") {
    if (fields.disc_impression) updates.disc_profile = fields.disc_impression;
    if (fields.homework_done === "yes") updates.homework_completion_rate = 1.0;
    else if (fields.homework_done === "partially") updates.homework_completion_rate = 0.5;
    else if (fields.homework_done === "no") updates.homework_completion_rate = 0.0;
  }

  if (callType === "mark") {
    if (fields.pfs_complete === "yes") updates.pfs_received = true;
    if (fields.funding_path_confirmed === "yes" || fields.funding_path_confirmed === true) {
      updates.funding_path = "combination"; // Confirmed via Mark
    }
  }

  if (Object.keys(updates).length > 1) { // More than just updated_at
    await supabase
      .from("candidate_intelligence")
      .update(updates)
      .eq("contact_id", contactId);
  }
}

/** Log objections from call fields to objection_registry */
async function logObjectionsFromCall(
  contactId: string,
  callType: string,
  fields: Record<string, unknown>,
  callLogId: string
): Promise<void> {
  const supabase = createServerClient();
  const objections: { type: string; detail: string }[] = [];

  // Check for capital concern
  if (fields.capital_concern_surfaced === "yes" || fields.capital_concern_surfaced === true) {
    objections.push({
      type: "capital",
      detail: (fields.capital_concern_detail as string) ?? "Capital concern raised",
    });
  }

  // Check for royalty objection
  if (fields.royalty_objection_raised === "yes" || fields.royalty_objection_raised === true) {
    objections.push({
      type: "royalty",
      detail: "Royalty objection raised during call",
    });
  }

  // Check for territory concern
  if (fields.deal_breaker_flags === "territory") {
    objections.push({
      type: "territory",
      detail: "Territory availability is a deal-breaker",
    });
  }

  // Check for undercapitalized flag
  if (fields.deal_breaker_flags === "undercapitalized") {
    objections.push({
      type: "capital",
      detail: "Undercapitalized — flagged as deal-breaker",
    });
  }

  // Map call type to stage name
  const stageMap: Record<string, string> = {
    intro: "Contacted",
    matt: "Discovery Call",
    sam: "Validation Call",
    mark: "Lending Call",
  };

  for (const obj of objections) {
    await supabase.from("objection_registry").insert({
      contact_id: contactId,
      stage_at_time: stageMap[callType] ?? callType,
      call_log_id: callLogId,
      objection_type: obj.type,
      objection_detail: obj.detail,
      score_impact: obj.type === "capital" ? -10 : -5,
    });
  }
}
