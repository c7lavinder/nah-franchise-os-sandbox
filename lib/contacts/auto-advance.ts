/**
 * Auto-advance: after all required sub-tasks in a stage are complete,
 * automatically move the contact to the next stage — if auto_advance_enabled
 * is true on the current stage.
 */

import { createServerClient } from "@/lib/supabase/server";
import { syncStageToGHL } from "@/lib/ghl/stage-sync";

interface AutoAdvanceResult {
  advanced: boolean;
  newStageId?: string;
}

export async function checkAutoAdvance(
  pipelineStateId: string,
  currentStageId: string
): Promise<AutoAdvanceResult> {
  const supabase = createServerClient();

  // Check if auto-advance is enabled on this stage
  const { data: stage } = await supabase
    .from("pipeline_stages")
    .select("id, auto_advance_enabled, pipeline_id, sort_order")
    .eq("id", currentStageId)
    .single();

  if (!stage?.auto_advance_enabled) {
    return { advanced: false };
  }

  // Get all required sub-tasks for this stage
  const { data: requiredTasks } = await supabase
    .from("pipeline_sub_tasks")
    .select("id, state_type")
    .eq("stage_id", currentStageId)
    .eq("is_required", true);

  if (!requiredTasks || requiredTasks.length === 0) {
    return { advanced: false };
  }

  // Check if every required sub-task is complete
  for (const task of requiredTasks) {
    const { data: logs } = await supabase
      .from("contact_sub_task_logs")
      .select("state_advance")
      .eq("contact_pipeline_state_id", pipelineStateId)
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

  // All required sub-tasks complete — find next stage
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

  // Get first sub-task of next stage
  const { data: nextTasks } = await supabase
    .from("pipeline_sub_tasks")
    .select("id")
    .eq("stage_id", nextStage.id)
    .order("sort_order")
    .limit(1);

  // Advance the pipeline state
  await supabase
    .from("contact_pipeline_state")
    .update({
      current_stage_id: nextStage.id,
      entered_current_stage_at: now,
      current_sub_task_id: nextTasks?.[0]?.id ?? null,
      current_sub_task_started_at: now,
    })
    .eq("id", pipelineStateId);

  // Write history
  await supabase.from("pipeline_stage_history").insert({
    contact_pipeline_state_id: pipelineStateId,
    from_stage_id: currentStageId,
    to_stage_id: nextStage.id,
    reason: "Auto-advanced: all required sub-tasks complete",
    was_skip: false,
    was_revert: false,
    was_auto: true,
  });

  // Handle auto-spawn if next stage is terminal
  if (nextStage.is_terminal && nextStage.auto_spawn_pipeline_id) {
    const { data: pState } = await supabase
      .from("contact_pipeline_state")
      .select("contact_id")
      .eq("id", pipelineStateId)
      .single();

    if (pState) {
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
          contact_id: pState.contact_id,
          pipeline_id: nextStage.auto_spawn_pipeline_id,
          current_stage_id: spawnStages[0].id,
          current_sub_task_id: spawnTasks?.[0]?.id ?? null,
          current_sub_task_started_at: now,
          entered_pipeline_at: now,
          entered_current_stage_at: now,
          is_active: true,
        });
      }
    }
  }

  // GHL write-back (fire-and-forget)
  const { data: pState2 } = await supabase
    .from("contact_pipeline_state")
    .select("contact_id, pipeline_id")
    .eq("id", pipelineStateId)
    .single();

  if (pState2) {
    const { data: pipeline } = await supabase
      .from("pipelines")
      .select("slug")
      .eq("id", pState2.pipeline_id)
      .single();

    const { data: nextStageDef } = await supabase
      .from("pipeline_stages")
      .select("slug")
      .eq("id", nextStage.id)
      .single();

    if (pipeline?.slug && nextStageDef?.slug) {
      void syncStageToGHL(pState2.contact_id, pipeline.slug, nextStageDef.slug);
    }
  }

  return { advanced: true, newStageId: nextStage.id };
}
