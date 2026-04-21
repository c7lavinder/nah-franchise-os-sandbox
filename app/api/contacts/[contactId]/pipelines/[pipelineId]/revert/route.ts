export const dynamic = "force-dynamic";

/**
 * POST /api/contacts/:contactId/pipelines/:pipelineId/revert
 *
 * Reverts a contact to the previous stage. Per §1.6: logs persist, visual reverts.
 * Reason is required for reverts.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { resolveContactId } from "@/lib/contacts/pipeline-state";
import { syncJourneyForContact } from "@/lib/journeys/sync";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string; pipelineId: string }> }
) {
  try {
    const { contactId: rawId, pipelineId } = await params;
    const { reason, territory_ms_slug } = (await request.json()) as {
      reason: string;
      territory_ms_slug?: string | null;
    };
    const supabase = createServerClient();

    if (!reason?.trim()) {
      return NextResponse.json({ error: "Reason is required for revert" }, { status: 400 });
    }

    const localContactId = await resolveContactId(rawId);
    if (!localContactId) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

    const { data: stages } = await supabase
      .from("pipeline_stages")
      .select("id, sort_order")
      .eq("pipeline_id", pipelineId)
      .order("sort_order");
    if (!stages || stages.length === 0) {
      return NextResponse.json({ error: "Pipeline has no stages" }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Per-territory path: revert just the jps row. Skip cps and stage_history.
    if (territory_ms_slug) {
      const { data: journey } = await supabase
        .from("journeys").select("id")
        .eq("primary_contact_id", localContactId).maybeSingle();
      if (!journey?.id) return NextResponse.json({ error: "No journey for contact" }, { status: 404 });

      const { data: jps } = await supabase
        .from("journey_pipeline_state")
        .select("id, current_stage_id")
        .eq("journey_id", journey.id)
        .eq("pipeline_id", pipelineId)
        .eq("territory_ms_slug", territory_ms_slug)
        .eq("is_active", true)
        .maybeSingle();
      if (!jps) return NextResponse.json({ error: "No active state for territory" }, { status: 404 });

      const currentIdx = stages.findIndex((s) => s.id === jps.current_stage_id);
      if (currentIdx <= 0) {
        return NextResponse.json({ error: "Cannot revert from the first stage" }, { status: 400 });
      }
      const prevStage = stages[currentIdx - 1];

      const { data: prevTasks } = await supabase
        .from("pipeline_sub_tasks")
        .select("id").eq("stage_id", prevStage.id).order("sort_order").limit(1);

      await supabase.from("journey_pipeline_state").update({
        current_stage_id: prevStage.id,
        entered_current_stage_at: now,
        current_sub_task_id: prevTasks?.[0]?.id ?? null,
        current_sub_task_started_at: now,
      }).eq("id", jps.id);

      return NextResponse.json({ success: true, newStageId: prevStage.id, scope: "territory" });
    }

    const { data: state } = await supabase
      .from("contact_pipeline_state")
      .select("id, current_stage_id")
      .eq("contact_id", localContactId)
      .eq("pipeline_id", pipelineId)
      .eq("is_active", true)
      .single();

    if (!state) return NextResponse.json({ error: "No active pipeline state" }, { status: 404 });

    const currentIdx = stages.findIndex((s) => s.id === state.current_stage_id);
    if (currentIdx <= 0) {
      return NextResponse.json({ error: "Cannot revert from the first stage" }, { status: 400 });
    }

    const prevStage = stages[currentIdx - 1];

    // Get first sub-task of previous stage
    const { data: prevTasks } = await supabase
      .from("pipeline_sub_tasks")
      .select("id")
      .eq("stage_id", prevStage.id)
      .order("sort_order")
      .limit(1);

    await supabase.from("contact_pipeline_state").update({
      current_stage_id: prevStage.id,
      entered_current_stage_at: now,
      current_sub_task_id: prevTasks?.[0]?.id ?? null,
      current_sub_task_started_at: now,
    }).eq("id", state.id);

    await supabase.from("pipeline_stage_history").insert({
      contact_pipeline_state_id: state.id,
      from_stage_id: state.current_stage_id,
      to_stage_id: prevStage.id,
      reason,
      was_skip: false,
      was_revert: true,
      was_auto: false,
    });

    // Phase 2 dual-write: mirror revert onto journey_pipeline_state.
    await syncJourneyForContact(supabase, localContactId, pipelineId);

    return NextResponse.json({ success: true, newStageId: prevStage.id });
  } catch (err) {
    console.error("Stage revert error:", err);
    return NextResponse.json({ error: "Failed to revert stage" }, { status: 500 });
  }
}
