export const dynamic = "force-dynamic";

/**
 * GET /api/contacts/:contactId/pipeline-state
 *
 * Returns all pipeline state data for a contact's Stages tab.
 * The contactId here is a GHL contact ID (from the URL).
 *
 * Phase 4B: every pipeline state is enriched with a `territories` array when
 * the contact's journey has per-territory jps rows in that pipeline (runway
 * and onboarding fan out one row per owned territory). The UI uses this to
 * render a territory picker above the pipeline bar so the rep can see each
 * territory's stage independently and, eventually, advance them separately.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import {
  resolveContactId,
  getContactByIdentifier,
  getContactPipelineStates,
  getStagesForPipeline,
  getSubTasksForStage,
  getSubTaskLogs,
  getStageHistory,
} from "@/lib/contacts/pipeline-state";

interface TerritoryState {
  TerritorySlug: string;
  Nickname: string;
  stage_id: string;
  stage_name: string;
  jps_id: string;
  entered_current_stage_at: string;
  current_sub_task_id: string | null;
  current_sub_task_started_at: string | null;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ contactId: string }> }) {
  try {
    const { contactId: ghlContactId } = await params;

    const localContactId = await resolveContactId(ghlContactId);
    const contactInfo = await getContactByIdentifier(ghlContactId);
    if (!localContactId) {
      return NextResponse.json({ pipelineStates: [], localContactId: null, contact: contactInfo });
    }

    const pipelineStates = await getContactPipelineStates(localContactId);

    const supabase = createServerClient();
    const { data: journeys } = await supabase
      .from("journeys")
      .select("id, status")
      .eq("primary_contact_id", localContactId)
      .order("created_at", { ascending: false });
    const journey = (journeys ?? []).find((j) => j.status === "active") ?? (journeys ?? [])[0] ?? null;

    // Preload jps rows for this journey (only needed for per-territory pipelines).
    type JpsRow = {
      id: string;
      pipeline_id: string;
      TerritorySlug: string | null;
      current_stage_id: string;
      current_sub_task_id: string | null;
      current_sub_task_started_at: string | null;
      entered_current_stage_at: string;
    };
    let jpsRows: JpsRow[] = [];
    if (journey?.id) {
      const { data } = await supabase
        .from("journey_pipeline_state")
        .select(
          "id, pipeline_id, TerritorySlug, current_stage_id, current_sub_task_id, current_sub_task_started_at, entered_current_stage_at"
        )
        .eq("journey_id", journey.id)
        .eq("is_active", true);
      jpsRows = (data ?? []) as JpsRow[];
    }

    const allTerritorySlugs = [...new Set(jpsRows.map((r) => r.TerritorySlug).filter(Boolean) as string[])];
    const territoryNameMap = new Map<string, string>();
    if (allTerritorySlugs.length > 0) {
      const { data: territories } = await supabase
        .from("territories")
        .select("TerritorySlug, Nickname")
        .in("TerritorySlug", allTerritorySlugs);
      for (const t of territories ?? []) territoryNameMap.set(t.TerritorySlug, t.Nickname);
    }

    const allStageIds = [...new Set(jpsRows.map((r) => r.current_stage_id))];
    const stageNameMap = new Map<string, string>();
    if (allStageIds.length > 0) {
      const { data: stages } = await supabase.from("pipeline_stages").select("id, name").in("id", allStageIds);
      for (const s of stages ?? []) stageNameMap.set(s.id, s.name);
    }

    const enrichedStates = await Promise.all(
      pipelineStates.map(async (state) => {
        const stages = await getStagesForPipeline(state.pipeline_id);
        const stageHistory = await getStageHistory(state.id);

        const enrichedStages = await Promise.all(
          stages.map(async (stage) => {
            const subTasks = await getSubTasksForStage(stage.id);
            const allLogs = await getSubTaskLogs(state.id);

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

        // Territory list for this pipeline: only populated when jps has per-
        // territory rows (runway/onboarding). Sales/followup jps rows carry
        // TerritorySlug=null, so this stays empty and the UI hides the picker.
        const territories: TerritoryState[] = jpsRows
          .filter((r) => r.pipeline_id === state.pipeline_id && r.TerritorySlug)
          .map((r) => ({
            TerritorySlug: r.TerritorySlug as string,
            Nickname: territoryNameMap.get(r.TerritorySlug as string) ?? (r.TerritorySlug as string),
            stage_id: r.current_stage_id,
            stage_name: stageNameMap.get(r.current_stage_id) ?? "Unknown",
            jps_id: r.id,
            entered_current_stage_at: r.entered_current_stage_at,
            current_sub_task_id: r.current_sub_task_id,
            current_sub_task_started_at: r.current_sub_task_started_at,
          }))
          .sort((a, b) => a.Nickname.localeCompare(b.Nickname));

        return {
          ...state,
          stages: enrichedStages,
          stageHistory,
          territories,
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
