export const dynamic = "force-dynamic";

/**
 * POST /api/pipeline/board/move
 *
 * Moves a journey_pipeline_state row to a new sub-task and/or stage.
 * Used by the Kanban board drag-and-drop.
 *
 * Body:
 *   stateId      — journey_pipeline_state.id (the row being moved)
 *   targetType   — "subtask" | "unsorted"
 *   targetId     — sub-task UUID (when targetType=subtask) or stage UUID (when targetType=unsorted)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

interface MoveBody {
  stateId: string;
  targetType: "subtask" | "unsorted";
  targetId: string;
}

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  try {
    const body = (await request.json()) as MoveBody;

    if (!body.stateId || !body.targetType || !body.targetId) {
      return NextResponse.json({ error: "stateId, targetType, and targetId are required" }, { status: 400 });
    }

    const supabase = createServerClient();
    const now = new Date().toISOString();

    if (body.targetType === "subtask") {
      // Look up the sub-task to find its stage_id
      const { data: subTask, error: stError } = await supabase
        .from("pipeline_sub_tasks")
        .select("id, stage_id")
        .eq("id", body.targetId)
        .single();

      if (stError || !subTask) {
        return NextResponse.json({ error: "Sub-task not found" }, { status: 404 });
      }

      // Get the current state to check if stage is changing
      const { data: current } = await supabase
        .from("journey_pipeline_state")
        .select("current_stage_id")
        .eq("id", body.stateId)
        .single();

      const stageChanging = current?.current_stage_id !== subTask.stage_id;

      const { error: updateError } = await supabase
        .from("journey_pipeline_state")
        .update({
          current_sub_task_id: subTask.id,
          current_sub_task_started_at: now,
          ...(stageChanging
            ? {
                current_stage_id: subTask.stage_id,
                entered_current_stage_at: now,
              }
            : {}),
        })
        .eq("id", body.stateId);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    } else {
      // targetType === "unsorted" — move to stage, clear sub-task
      const { data: stage, error: sgError } = await supabase
        .from("pipeline_stages")
        .select("id")
        .eq("id", body.targetId)
        .single();

      if (sgError || !stage) {
        return NextResponse.json({ error: "Stage not found" }, { status: 404 });
      }

      const { data: current } = await supabase
        .from("journey_pipeline_state")
        .select("current_stage_id")
        .eq("id", body.stateId)
        .single();

      const stageChanging = current?.current_stage_id !== stage.id;

      const { error: updateError } = await supabase
        .from("journey_pipeline_state")
        .update({
          current_sub_task_id: null,
          current_sub_task_started_at: now,
          ...(stageChanging
            ? {
                current_stage_id: stage.id,
                entered_current_stage_at: now,
              }
            : {}),
        })
        .eq("id", body.stateId);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }

    // Log the action
    try {
      await supabase.from("scout_action_logs").insert({
        user_id: user.id,
        session_id: null,
        action_type: "board_move",
        action_status: "executed",
        draft_content: {
          stateId: body.stateId,
          targetType: body.targetType,
          targetId: body.targetId,
          source: "pipeline_board",
        },
        executed_at: now,
      });
    } catch {
      // Non-fatal
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Board move failed:", err);
    return NextResponse.json({ error: "Failed to move" }, { status: 500 });
  }
}
