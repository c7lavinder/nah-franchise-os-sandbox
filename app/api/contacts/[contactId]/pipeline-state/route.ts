export const dynamic = "force-dynamic";

/**
 * GET /api/contacts/:contactId/pipeline-state
 *
 * Returns all pipeline state data for a contact's Stages tab.
 * The contactId here is a GHL contact ID (from the URL).
 * Returns: pipeline states, stages, sub-tasks, logs, and stage history.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  resolveContactId,
  getContactByIdentifier,
  getContactPipelineStates,
  getStagesForPipeline,
  getSubTasksForStage,
  getSubTaskLogs,
  getStageHistory,
} from "@/lib/contacts/pipeline-state";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const { contactId: ghlContactId } = await params;

    // Sprint 4A bugfix: resolve identifier (may be local UUID or GHL ID)
    const localContactId = await resolveContactId(ghlContactId);
    const contactInfo = await getContactByIdentifier(ghlContactId);
    if (!localContactId) {
      return NextResponse.json({ pipelineStates: [], localContactId: null, contact: contactInfo });
    }

    // Get all active pipeline states
    const pipelineStates = await getContactPipelineStates(localContactId);

    // For each pipeline state, fetch stages, sub-tasks, logs, and history
    const enrichedStates = await Promise.all(
      pipelineStates.map(async (state) => {
        const stages = await getStagesForPipeline(state.pipeline_id);
        const stageHistory = await getStageHistory(state.id);

        // For each stage, get sub-tasks and logs
        const enrichedStages = await Promise.all(
          stages.map(async (stage) => {
            const subTasks = await getSubTasksForStage(stage.id);
            const allLogs = await getSubTaskLogs(state.id);

            // Group logs by sub-task
            const logsBySubTask: Record<string, typeof allLogs> = {};
            for (const log of allLogs) {
              if (!logsBySubTask[log.sub_task_id]) logsBySubTask[log.sub_task_id] = [];
              logsBySubTask[log.sub_task_id].push(log);
            }

            return {
              ...stage,
              subTasks,
              logsBySubTask,
              totalLogs: subTasks.reduce((sum, st) => sum + (logsBySubTask[st.id]?.length ?? 0), 0),
            };
          })
        );

        return {
          ...state,
          stages: enrichedStages,
          stageHistory,
        };
      })
    );

    return NextResponse.json({
      pipelineStates: enrichedStates,
      localContactId,
      contact: contactInfo,
    });
  } catch (err) {
    console.error("Pipeline state fetch error:", err);
    return NextResponse.json({ error: "Failed to load pipeline state" }, { status: 500 });
  }
}
