export const dynamic = "force-dynamic";

/**
 * POST /api/contacts/:contactId/sub-tasks/:subTaskId/logs
 *
 * Creates a sub-task log entry. Per §1.5: a log is an attempt to hit a milestone.
 * Multiple logs can exist on a single sub-task.
 *
 * After creating the log, if the sub-task reaches its final state AND it's the
 * current sub-task, advances current_sub_task_id to the next required sub-task.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { resolveContactId } from "@/lib/contacts/pipeline-state";

interface LogBody {
  contentType: string;
  contentText?: string;
  contentFileUrl?: string;
  contentLinkUrl?: string;
  stateAdvance?: "first" | "second" | null;
  loggerUserId?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string; subTaskId: string }> }
) {
  try {
    const { contactId: rawContactId, subTaskId } = await params;
    const body = (await request.json()) as LogBody;
    const supabase = createServerClient();

    // Resolve contact
    const localContactId = await resolveContactId(rawContactId);
    if (!localContactId) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    // Get sub-task definition
    const { data: subTask, error: stError } = await supabase
      .from("pipeline_sub_tasks")
      .select("id, slug, name, state_type, stage_id, default_logger_type, default_logger_user_id")
      .eq("id", subTaskId)
      .single();

    if (stError || !subTask) {
      return NextResponse.json({ error: "Sub-task not found" }, { status: 404 });
    }

    // Validate state_advance
    if (subTask.state_type === "two_state" && !body.stateAdvance) {
      return NextResponse.json({ error: "stateAdvance is required for two-state sub-tasks" }, { status: 400 });
    }
    if (subTask.state_type === "single" && body.stateAdvance) {
      return NextResponse.json({ error: "stateAdvance must be null for single-state sub-tasks" }, { status: 400 });
    }

    // Find the active pipeline state for this contact + sub-task's pipeline
    const { data: stage } = await supabase
      .from("pipeline_stages")
      .select("id, pipeline_id")
      .eq("id", subTask.stage_id)
      .single();

    if (!stage) {
      return NextResponse.json({ error: "Stage not found" }, { status: 404 });
    }

    const { data: pipelineState } = await supabase
      .from("contact_pipeline_state")
      .select("id, current_sub_task_id, current_stage_id")
      .eq("contact_id", localContactId)
      .eq("pipeline_id", stage.pipeline_id)
      .eq("is_active", true)
      .maybeSingle();

    if (!pipelineState) {
      return NextResponse.json({ error: "No active pipeline state for this contact" }, { status: 404 });
    }

    // Resolve logger per §1.8
    const loggerUserId = body.loggerUserId
      ?? (subTask.default_logger_type === "user" ? subTask.default_logger_user_id : null);

    // Insert log
    const { data: newLog, error: logError } = await supabase
      .from("contact_sub_task_logs")
      .insert({
        contact_pipeline_state_id: pipelineState.id,
        sub_task_id: subTaskId,
        logger_user_id: loggerUserId,
        source: "manual",
        state_advance: body.stateAdvance ?? null,
        content_type: body.contentType ?? "note",
        content_text: body.contentText ?? null,
        content_file_url: body.contentFileUrl ?? null,
        content_link_url: body.contentLinkUrl ?? null,
      })
      .select("id")
      .single();

    if (logError) {
      return NextResponse.json({ error: logError.message }, { status: 500 });
    }

    // If this log completes the sub-task AND it's the current sub-task,
    // advance current_sub_task_id to the next required sub-task in the stage
    const isComplete =
      subTask.state_type === "single" ||
      (subTask.state_type === "two_state" && body.stateAdvance === "second");

    if (isComplete && pipelineState.current_sub_task_id === subTaskId) {
      // Get all sub-tasks in this stage ordered by sort_order
      const { data: stageTasks } = await supabase
        .from("pipeline_sub_tasks")
        .select("id, is_required, sort_order")
        .eq("stage_id", subTask.stage_id)
        .order("sort_order");

      // Find next incomplete required sub-task
      let nextSubTaskId: string | null = null;
      for (const task of stageTasks ?? []) {
        if (!task.is_required) continue;
        if (task.id === subTaskId) continue;

        // Check if this task has a completing log
        const { data: taskLogs } = await supabase
          .from("contact_sub_task_logs")
          .select("state_advance")
          .eq("contact_pipeline_state_id", pipelineState.id)
          .eq("sub_task_id", task.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(1);

        const latestLog = taskLogs?.[0];
        const taskSubDef = await supabase
          .from("pipeline_sub_tasks")
          .select("state_type")
          .eq("id", task.id)
          .single();

        const taskComplete =
          latestLog &&
          (taskSubDef.data?.state_type === "single" || latestLog.state_advance === "second");

        if (!taskComplete) {
          nextSubTaskId = task.id;
          break;
        }
      }

      // Update current sub-task pointer
      await supabase
        .from("contact_pipeline_state")
        .update({
          current_sub_task_id: nextSubTaskId,
          current_sub_task_started_at: new Date().toISOString(),
        })
        .eq("id", pipelineState.id);
    }

    return NextResponse.json({ logId: newLog.id, success: true });
  } catch (err) {
    console.error("Sub-task log error:", err);
    return NextResponse.json({ error: "Failed to create log" }, { status: 500 });
  }
}
