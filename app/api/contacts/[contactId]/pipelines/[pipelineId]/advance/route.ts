export const dynamic = "force-dynamic";

/**
 * POST /api/contacts/:contactId/pipelines/:pipelineId/advance
 *
 * Advances a contact's pipeline state to the next stage.
 *
 * Body:
 *   - reason (optional)
 *   - force (optional) — skip sub-task completion check
 *   - territory_ms_slug (optional) — when set, advance ONLY the journey's
 *     jps row for (pipeline, territory). cps is left untouched and stage
 *     history is skipped for this move (known gap until stage_history
 *     gets a jps FK). Without this param, advance operates on cps as
 *     before and the dual-write sync fans the stage out to all jps rows.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { resolveContactId } from "@/lib/contacts/pipeline-state";
import { syncStageToGHL } from "@/lib/ghl/stage-sync";
import { syncJourneyForContact } from "@/lib/journeys/sync";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string; pipelineId: string }> }
) {
  try {
    const { contactId: rawId, pipelineId } = await params;
    const { reason, force, territory_ms_slug } = (await request.json()) as {
      reason?: string;
      force?: boolean;
      territory_ms_slug?: string | null;
    };
    const supabase = createServerClient();

    const localContactId = await resolveContactId(rawId);
    if (!localContactId) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

    // Get all stages ordered — used by both the cps path and the jps path.
    const { data: stages } = await supabase
      .from("pipeline_stages")
      .select("id, sort_order, is_terminal, auto_spawn_pipeline_id")
      .eq("pipeline_id", pipelineId)
      .order("sort_order");
    if (!stages || stages.length === 0) {
      return NextResponse.json({ error: "Pipeline has no stages" }, { status: 400 });
    }

    const now = new Date().toISOString();

    // ─── Per-territory path: write directly to jps, skip cps + history. ───
    if (territory_ms_slug) {
      const { data: journey } = await supabase
        .from("journeys")
        .select("id")
        .eq("primary_contact_id", localContactId)
        .maybeSingle();
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
      if (currentIdx === -1 || currentIdx >= stages.length - 1) {
        return NextResponse.json({ error: "No next stage available" }, { status: 400 });
      }
      const nextStage = stages[currentIdx + 1];

      const { data: nextTasks } = await supabase
        .from("pipeline_sub_tasks")
        .select("id")
        .eq("stage_id", nextStage.id)
        .order("sort_order")
        .limit(1);

      await supabase.from("journey_pipeline_state").update({
        current_stage_id: nextStage.id,
        entered_current_stage_at: now,
        current_sub_task_id: nextTasks?.[0]?.id ?? null,
        current_sub_task_started_at: now,
      }).eq("id", jps.id);

      const { data: pipeline } = await supabase.from("pipelines").select("slug").eq("id", pipelineId).single();
      const { data: nextStageDef } = await supabase.from("pipeline_stages").select("slug").eq("id", nextStage.id).single();
      if (pipeline?.slug && nextStageDef?.slug) {
        void syncStageToGHL(localContactId, pipeline.slug, nextStageDef.slug);
      }

      return NextResponse.json({ success: true, newStageId: nextStage.id, scope: "territory" });
    }

    // ─── Contact-wide path: existing cps-based advance flow. ───
    const { data: state } = await supabase
      .from("contact_pipeline_state")
      .select("id, current_stage_id, pipeline_id")
      .eq("contact_id", localContactId)
      .eq("pipeline_id", pipelineId)
      .eq("is_active", true)
      .single();

    if (!state) return NextResponse.json({ error: "No active pipeline state" }, { status: 404 });

    const currentIdx = stages.findIndex((s) => s.id === state.current_stage_id);
    if (currentIdx === -1 || currentIdx >= stages.length - 1) {
      return NextResponse.json({ error: "No next stage available" }, { status: 400 });
    }

    // Check sub-task completion if not forcing
    if (!force) {
      const { data: subTasks } = await supabase
        .from("pipeline_sub_tasks")
        .select("id, state_type, is_required")
        .eq("stage_id", state.current_stage_id);

      for (const task of (subTasks ?? []).filter((t) => t.is_required)) {
        const { data: logs } = await supabase
          .from("contact_sub_task_logs")
          .select("state_advance")
          .eq("contact_pipeline_state_id", state.id)
          .eq("sub_task_id", task.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(1);

        const latest = logs?.[0];
        const complete = task.state_type === "single" ? !!latest : latest?.state_advance === "second";
        if (!complete) {
          return NextResponse.json({
            error: "Not all required sub-tasks are complete. Use force=true to skip.",
          }, { status: 400 });
        }
      }
    }

    const nextStage = stages[currentIdx + 1];

    const { data: nextTasks } = await supabase
      .from("pipeline_sub_tasks")
      .select("id")
      .eq("stage_id", nextStage.id)
      .order("sort_order")
      .limit(1);

    await supabase.from("contact_pipeline_state").update({
      current_stage_id: nextStage.id,
      entered_current_stage_at: now,
      current_sub_task_id: nextTasks?.[0]?.id ?? null,
      current_sub_task_started_at: now,
    }).eq("id", state.id);

    await supabase.from("pipeline_stage_history").insert({
      contact_pipeline_state_id: state.id,
      from_stage_id: state.current_stage_id,
      to_stage_id: nextStage.id,
      reason: reason ?? (force ? "Skipped forward" : null),
      was_skip: force ?? false,
      was_revert: false,
      was_auto: false,
    });

    const { data: pipeline } = await supabase.from("pipelines").select("slug").eq("id", pipelineId).single();
    const { data: nextStageDef } = await supabase.from("pipeline_stages").select("slug").eq("id", nextStage.id).single();

    if (pipeline?.slug && nextStageDef?.slug) {
      void syncStageToGHL(localContactId, pipeline.slug, nextStageDef.slug);
    }

    if (nextStage.is_terminal && nextStage.auto_spawn_pipeline_id) {
      const { data: spawnStages } = await supabase
        .from("pipeline_stages")
        .select("id")
        .eq("pipeline_id", nextStage.auto_spawn_pipeline_id)
        .order("sort_order")
        .limit(1);

      if (spawnStages?.[0]) {
        const { data: spawnTasks } = await supabase
          .from("pipeline_sub_tasks")
          .select("id")
          .eq("stage_id", spawnStages[0].id)
          .order("sort_order")
          .limit(1);

        await supabase.from("contact_pipeline_state").insert({
          contact_id: localContactId,
          pipeline_id: nextStage.auto_spawn_pipeline_id,
          current_stage_id: spawnStages[0].id,
          current_sub_task_id: spawnTasks?.[0]?.id ?? null,
          current_sub_task_started_at: now,
          entered_pipeline_at: now,
          entered_current_stage_at: now,
          is_active: true,
        });

        await syncJourneyForContact(supabase, localContactId, nextStage.auto_spawn_pipeline_id);
      }
    }

    await syncJourneyForContact(supabase, localContactId, pipelineId);

    return NextResponse.json({ success: true, newStageId: nextStage.id, scope: "contact" });
  } catch (err) {
    console.error("Stage advance error:", err);
    return NextResponse.json({ error: "Failed to advance stage" }, { status: 500 });
  }
}
