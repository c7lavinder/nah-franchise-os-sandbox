export const dynamic = "force-dynamic";

/**
 * POST /api/contacts/:contactId/pipelines/resume-sales
 *
 * Per §1.13: Re-engaged → spawn new Sales Pipeline entry on the contact's
 * journey. User picks fresh start (Stage 1) or resume at most recent
 * prior stage from the journey's closed Sales jps rows.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { resolveContactId } from "@/lib/contacts/pipeline-state";

const SALES_PIPELINE_ID = "a0000000-0000-0000-0000-000000000001";
const ENGAGEMENT_STAGE_ID = "b0000000-0000-0000-0000-000000000001";

export async function POST(request: NextRequest, { params }: { params: Promise<{ contactId: string }> }) {
  try {
    const { contactId: rawId } = await params;
    const { mode } = (await request.json()) as { mode: "fresh" | "resume" };
    const supabase = createServerClient();

    const localContactId = await resolveContactId(rawId);
    if (!localContactId) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

    const { data: journey } = await supabase
      .from("journeys")
      .select("id")
      .eq("primary_contact_id", localContactId)
      .maybeSingle();
    if (!journey?.id) return NextResponse.json({ error: "No journey for contact" }, { status: 404 });

    // Check if already has active Sales entry (scoped to this journey).
    const { data: existingSales } = await supabase
      .from("journey_pipeline_state")
      .select("id")
      .eq("journey_id", journey.id)
      .eq("pipeline_id", SALES_PIPELINE_ID)
      .eq("is_active", true)
      .maybeSingle();

    if (existingSales) {
      return NextResponse.json({ error: "Contact already has an active Sales pipeline entry" }, { status: 400 });
    }

    let targetStageId = ENGAGEMENT_STAGE_ID;

    if (mode === "resume") {
      const { data: priorSales } = await supabase
        .from("journey_pipeline_state")
        .select("current_stage_id")
        .eq("journey_id", journey.id)
        .eq("pipeline_id", SALES_PIPELINE_ID)
        .eq("is_active", false)
        .order("closed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (priorSales?.current_stage_id) {
        targetStageId = priorSales.current_stage_id;
      }
    }

    const now = new Date().toISOString();

    const { data: firstTask } = await supabase
      .from("pipeline_sub_tasks")
      .select("id")
      .eq("stage_id", targetStageId)
      .order("sort_order")
      .limit(1)
      .maybeSingle();

    const { data: newState, error: insertErr } = await supabase
      .from("journey_pipeline_state")
      .insert({
        journey_id: journey.id,
        pipeline_id: SALES_PIPELINE_ID,
        TerritorySlug: null,
        current_stage_id: targetStageId,
        current_sub_task_id: firstTask?.id ?? null,
        current_sub_task_started_at: now,
        entered_pipeline_at: now,
        entered_current_stage_at: now,
        is_active: true,
      })
      .select("id")
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    await supabase.from("pipeline_stage_history").insert({
      journey_pipeline_state_id: newState.id,
      from_stage_id: null,
      to_stage_id: targetStageId,
      reason: mode === "fresh" ? "Re-engaged — fresh start" : "Re-engaged — resumed at prior stage",
      was_skip: mode === "resume",
      was_revert: false,
      was_auto: false,
    });

    return NextResponse.json({ success: true, stateId: newState.id, stageId: targetStageId });
  } catch (err) {
    console.error("Resume sales error:", err);
    return NextResponse.json({ error: "Failed to resume sales" }, { status: 500 });
  }
}
