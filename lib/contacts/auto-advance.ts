/**
 * Auto-advance: after all required sub-tasks in a stage are complete,
 * automatically move the journey's pipeline state to the next stage — if
 * auto_advance_enabled is true on the current stage.
 *
 * Phase 4 final: operates on journey_pipeline_state directly. Input is
 * the canonical jps id for the (journey, pipeline). When multiple active
 * jps rows exist (runway/onboarding with multiple territories), they all
 * move together — matches legacy cps+sync semantics.
 */

import { createServerClient } from "@/lib/supabase/server";
import { syncStageToGHL } from "@/lib/ghl/stage-sync";

interface AutoAdvanceResult {
  advanced: boolean;
  newStageId?: string;
}

export async function checkAutoAdvance(
  jpsId: string,
  currentStageId: string
): Promise<AutoAdvanceResult> {
  const supabase = createServerClient();

  const { data: stage } = await supabase
    .from("pipeline_stages")
    .select("id, auto_advance_enabled, pipeline_id, sort_order")
    .eq("id", currentStageId)
    .single();

  if (!stage?.auto_advance_enabled) {
    return { advanced: false };
  }

  const { data: requiredTasks } = await supabase
    .from("pipeline_sub_tasks")
    .select("id, state_type")
    .eq("stage_id", currentStageId)
    .eq("is_required", true);

  if (!requiredTasks || requiredTasks.length === 0) {
    return { advanced: false };
  }

  for (const task of requiredTasks) {
    const { data: logs } = await supabase
      .from("contact_sub_task_logs")
      .select("state_advance")
      .eq("journey_pipeline_state_id", jpsId)
      .eq("sub_task_id", task.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1);

    const latest = logs?.[0];
    const complete =
      task.state_type === "single" ? !!latest : latest?.state_advance === "second";

    if (!complete) {
      return { advanced: false };
    }
  }

  const { data: stages } = await supabase
    .from("pipeline_stages")
    .select("id, sort_order, is_terminal, auto_spawn_pipeline_id")
    .eq("pipeline_id", stage.pipeline_id)
    .order("sort_order");

  const currentIdx = (stages ?? []).findIndex((s) => s.id === currentStageId);
  if (currentIdx === -1 || currentIdx >= (stages ?? []).length - 1) {
    return { advanced: false };
  }

  const nextStage = stages![currentIdx + 1];
  const now = new Date().toISOString();

  const { data: nextTasks } = await supabase
    .from("pipeline_sub_tasks")
    .select("id")
    .eq("stage_id", nextStage.id)
    .order("sort_order")
    .limit(1);

  // Resolve the journey owning this jps row so we can move every sister jps
  // row in the same (journey, pipeline) together (preserves legacy semantics).
  const { data: rootJps } = await supabase
    .from("journey_pipeline_state")
    .select("journey_id, pipeline_id")
    .eq("id", jpsId)
    .single();
  if (!rootJps) return { advanced: false };

  const { data: sistJps } = await supabase
    .from("journey_pipeline_state")
    .select("id, current_stage_id")
    .eq("journey_id", rootJps.journey_id)
    .eq("pipeline_id", rootJps.pipeline_id)
    .eq("is_active", true);

  const toAdvance = (sistJps ?? []).filter((r) => r.current_stage_id === currentStageId);
  const ids = toAdvance.map((r) => r.id);
  if (ids.length === 0) return { advanced: false };

  await supabase
    .from("journey_pipeline_state")
    .update({
      current_stage_id: nextStage.id,
      entered_current_stage_at: now,
      current_sub_task_id: nextTasks?.[0]?.id ?? null,
      current_sub_task_started_at: now,
    })
    .in("id", ids);

  await supabase.from("pipeline_stage_history").insert(
    toAdvance.map((r) => ({
      journey_pipeline_state_id: r.id,
      from_stage_id: r.current_stage_id,
      to_stage_id: nextStage.id,
      reason: "Auto-advanced: all required sub-tasks complete",
      was_skip: false,
      was_revert: false,
      was_auto: true,
    }))
  );

  // Auto-spawn when the new stage is terminal with an auto_spawn_pipeline_id.
  if (nextStage.is_terminal && nextStage.auto_spawn_pipeline_id) {
    const spawnPipelineId = nextStage.auto_spawn_pipeline_id;
    const { data: spawnPipeline } = await supabase
      .from("pipelines").select("slug").eq("id", spawnPipelineId).single();
    const { data: spawnStages } = await supabase
      .from("pipeline_stages").select("id")
      .eq("pipeline_id", spawnPipelineId).order("sort_order").limit(1);

    if (spawnStages?.[0]) {
      const { data: spawnTasks } = await supabase
        .from("pipeline_sub_tasks").select("id")
        .eq("stage_id", spawnStages[0].id).order("sort_order").limit(1);

      const fanOut = spawnPipeline?.slug === "runway" || spawnPipeline?.slug === "onboarding";
      let spawnSlugs: (string | null)[] = [null];
      if (fanOut) {
        const { data: journey } = await supabase
          .from("journeys").select("primary_contact_id").eq("id", rootJps.journey_id).single();
        if (journey) {
          const { data: contact } = await supabase
            .from("contacts").select("ghl_contact_id").eq("id", journey.primary_contact_id).maybeSingle();
          if (contact?.ghl_contact_id) {
            const { data: owners } = await supabase
              .from("territory_owners").select("ms_slug")
              .eq("ghl_contact_id", contact.ghl_contact_id).is("end_date", null);
            const slugs = (owners ?? []).map((o) => o.ms_slug);
            spawnSlugs = slugs.length > 0 ? slugs : [null];
          }
        }
      }

      await supabase.from("journey_pipeline_state").insert(
        spawnSlugs.map((slug) => ({
          journey_id: rootJps.journey_id,
          territory_ms_slug: slug,
          pipeline_id: spawnPipelineId,
          current_stage_id: spawnStages[0].id,
          current_sub_task_id: spawnTasks?.[0]?.id ?? null,
          current_sub_task_started_at: now,
          entered_pipeline_at: now,
          entered_current_stage_at: now,
          is_active: true,
        }))
      );
    }
  }

  // GHL write-back (fire-and-forget)
  const { data: pipeline } = await supabase
    .from("pipelines").select("slug").eq("id", rootJps.pipeline_id).single();
  const { data: nextStageDef } = await supabase
    .from("pipeline_stages").select("slug").eq("id", nextStage.id).single();
  const { data: journey } = await supabase
    .from("journeys").select("primary_contact_id").eq("id", rootJps.journey_id).single();

  if (pipeline?.slug && nextStageDef?.slug && journey?.primary_contact_id) {
    void syncStageToGHL(journey.primary_contact_id, pipeline.slug, nextStageDef.slug);
  }

  return { advanced: true, newStageId: nextStage.id };
}
