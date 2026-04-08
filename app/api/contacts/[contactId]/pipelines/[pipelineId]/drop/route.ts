export const dynamic = "force-dynamic";

/**
 * POST /api/contacts/:contactId/pipelines/:pipelineId/drop
 *
 * Drops a contact from a pipeline to Follow-up or Nurture.
 * Per §1.13: closes source pipeline, spawns Follow-up entry.
 * Follow-up requires reason text; Nurture does not.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { resolveContactId } from "@/lib/contacts/pipeline-state";

const FOLLOWUP_PIPELINE_ID = "a0000000-0000-0000-0000-000000000002";
const FOLLOWUP_STAGE_ID = "c0000000-0000-0000-0000-000000000001";
const NURTURE_STAGE_ID = "c0000000-0000-0000-0000-000000000002";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string; pipelineId: string }> }
) {
  try {
    const { contactId: rawId, pipelineId } = await params;
    const { destination, reason } = (await request.json()) as {
      destination: "followup" | "nurture";
      reason?: string;
    };
    const supabase = createServerClient();

    if (destination === "followup" && !reason?.trim()) {
      return NextResponse.json({ error: "Reason is required for Follow-up" }, { status: 400 });
    }

    const localContactId = await resolveContactId(rawId);
    if (!localContactId) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

    // Get active pipeline state
    const { data: state } = await supabase
      .from("contact_pipeline_state")
      .select("id, current_stage_id")
      .eq("contact_id", localContactId)
      .eq("pipeline_id", pipelineId)
      .eq("is_active", true)
      .single();

    if (!state) return NextResponse.json({ error: "No active pipeline state" }, { status: 404 });

    const now = new Date().toISOString();
    const closedReason = destination === "followup" ? "dropped_to_followup" : "dropped_to_nurture";
    const targetStageId = destination === "followup" ? FOLLOWUP_STAGE_ID : NURTURE_STAGE_ID;

    // Close source pipeline state
    await supabase.from("contact_pipeline_state").update({
      is_active: false,
      closed_reason: closedReason,
      closed_at: now,
    }).eq("id", state.id);

    // Record history on source
    await supabase.from("pipeline_stage_history").insert({
      contact_pipeline_state_id: state.id,
      from_stage_id: state.current_stage_id,
      to_stage_id: state.current_stage_id,
      reason: reason ?? `Dropped to ${destination}`,
      was_skip: false,
      was_revert: false,
      was_auto: false,
    });

    // Create Follow-up pipeline state (check if one already exists)
    const { data: existingFollowup } = await supabase
      .from("contact_pipeline_state")
      .select("id")
      .eq("contact_id", localContactId)
      .eq("pipeline_id", FOLLOWUP_PIPELINE_ID)
      .eq("is_active", true)
      .maybeSingle();

    let newStateId: string | null = null;
    if (!existingFollowup) {
      const { data: newState } = await supabase
        .from("contact_pipeline_state")
        .insert({
          contact_id: localContactId,
          pipeline_id: FOLLOWUP_PIPELINE_ID,
          current_stage_id: targetStageId,
          current_sub_task_id: null,
          current_sub_task_started_at: null,
          entered_pipeline_at: now,
          entered_current_stage_at: now,
          is_active: true,
        })
        .select("id")
        .single();
      newStateId = newState?.id ?? null;
    }

    return NextResponse.json({ success: true, closedStateId: state.id, newStateId });
  } catch (err) {
    console.error("Drop error:", err);
    return NextResponse.json({ error: "Failed to drop contact" }, { status: 500 });
  }
}
