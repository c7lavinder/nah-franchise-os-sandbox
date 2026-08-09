export const dynamic = "force-dynamic";

/**
 * POST /api/contacts/:contactId/pipelines/:pipelineId/drop
 *
 * Drops a contact from a pipeline to Follow-up or Nurture.
 * Per §1.13: closes source pipeline, spawns Follow-up entry.
 * Follow-up requires reason text; Nurture does not.
 *
 * Phase 4 final: writes jps directly. Contact-wide drop closes every
 * active jps row for (journey, pipeline) and spawns one Follow-up /
 * Nurture jps row (NULL territory — Follow-up/Nurture is journey-level).
 * Per-territory drop closes the one targeted jps row without spawning.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { resolveContactId } from "@/lib/contacts/pipeline-state";

const FOLLOWUP_PIPELINE_ID = "a0000000-0000-0000-0000-000000000002";
const FOLLOWUP_STAGE_ID = "c0000000-0000-0000-0000-000000000001";
const NURTURE_STAGE_ID = "c0000000-0000-0000-0000-000000000002";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string; pipelineId: string }> }
) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  try {
    const { contactId: rawId, pipelineId } = await params;
    const { destination, reason, TerritorySlug } = (await request.json()) as {
      destination: "followup" | "nurture";
      reason?: string;
      TerritorySlug?: string | null;
    };
    const supabase = createServerClient();

    if (destination === "followup" && !reason?.trim()) {
      return NextResponse.json({ error: "Reason is required for Follow-up" }, { status: 400 });
    }

    const localContactId = await resolveContactId(rawId);
    if (!localContactId) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

    const { data: journey } = await supabase
      .from("journeys")
      .select("id")
      .eq("primary_contact_id", localContactId)
      .maybeSingle();
    if (!journey?.id) return NextResponse.json({ error: "No journey for contact" }, { status: 404 });

    const now = new Date().toISOString();
    const closedReason = destination === "followup" ? "dropped_to_followup" : "dropped_to_nurture";
    const targetStageId = destination === "followup" ? FOLLOWUP_STAGE_ID : NURTURE_STAGE_ID;

    // Per-territory: close just the one jps row. No Follow-up spawn.
    if (TerritorySlug) {
      const { data: jps } = await supabase
        .from("journey_pipeline_state")
        .select("id, current_stage_id")
        .eq("journey_id", journey.id)
        .eq("pipeline_id", pipelineId)
        .eq("TerritorySlug", TerritorySlug)
        .eq("is_active", true)
        .maybeSingle();
      if (!jps) return NextResponse.json({ error: "No active state for territory" }, { status: 404 });

      await supabase
        .from("journey_pipeline_state")
        .update({
          is_active: false,
          closed_reason: closedReason,
          closed_at: now,
        })
        .eq("id", jps.id);

      await supabase.from("pipeline_stage_history").insert({
        journey_pipeline_state_id: jps.id,
        from_stage_id: jps.current_stage_id,
        to_stage_id: jps.current_stage_id,
        reason: reason ?? `Dropped to ${destination} (territory)`,
        was_skip: false,
        was_revert: false,
        was_auto: false,
      });

      return NextResponse.json({ success: true, closedStateId: jps.id, newStateId: null, scope: "territory" });
    }

    // Contact-wide: close every active jps row for (journey, pipeline) and
    // spawn one Follow-up/Nurture jps row if none exists yet.
    const { data: jpsRows } = await supabase
      .from("journey_pipeline_state")
      .select("id, current_stage_id")
      .eq("journey_id", journey.id)
      .eq("pipeline_id", pipelineId)
      .eq("is_active", true);
    if (!jpsRows || jpsRows.length === 0) {
      return NextResponse.json({ error: "No active pipeline state" }, { status: 404 });
    }

    const jpsIds = jpsRows.map((r) => r.id);

    await supabase
      .from("journey_pipeline_state")
      .update({
        is_active: false,
        closed_reason: closedReason,
        closed_at: now,
      })
      .in("id", jpsIds);

    await supabase.from("pipeline_stage_history").insert(
      jpsRows.map((r) => ({
        journey_pipeline_state_id: r.id,
        from_stage_id: r.current_stage_id,
        to_stage_id: r.current_stage_id,
        reason: reason ?? `Dropped to ${destination}`,
        was_skip: false,
        was_revert: false,
        was_auto: false,
      }))
    );

    const { data: existingFollowup } = await supabase
      .from("journey_pipeline_state")
      .select("id")
      .eq("journey_id", journey.id)
      .eq("pipeline_id", FOLLOWUP_PIPELINE_ID)
      .eq("is_active", true)
      .maybeSingle();

    let newStateId: string | null = null;
    if (!existingFollowup) {
      const { data: newState } = await supabase
        .from("journey_pipeline_state")
        .insert({
          journey_id: journey.id,
          pipeline_id: FOLLOWUP_PIPELINE_ID,
          TerritorySlug: null,
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

    return NextResponse.json({ success: true, closedStateId: jpsIds[0], newStateId, scope: "contact" });
  } catch (err) {
    console.error("Drop error:", err);
    return NextResponse.json({ error: "Failed to drop contact" }, { status: 500 });
  }
}
