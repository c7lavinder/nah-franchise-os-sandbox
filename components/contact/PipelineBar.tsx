"use client";

/**
 * PipelineBar — persistent horizontal pipeline visualization for contact page.
 * Shows stage circles + action buttons. Renders above tabs.
 */

import { useState } from "react";
import StageCircle from "./StageCircle";
import StageActionButtons from "./StageActionButtons";
import ResumeSalesPrompt from "./ResumeSalesPrompt";
import {
  computeStageVisualState,
  computeColorLabel,
  getCurrentStageSortOrder,
} from "@/lib/contacts/stage-visual-state";
import type { CircleState } from "@/lib/contacts/stage-visual-state";
import type { SubTaskLog, StageHistoryEntry } from "@/lib/contacts/pipeline-state";

interface SubTaskAPI {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
  state_type: "single" | "two_state";
  first_state_label: string | null;
  second_state_label: string | null;
  default_logger_type: string;
  default_logger_user_id: string | null;
  is_required: boolean;
  stage_id: string;
}

interface StageAPI {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
  is_terminal: boolean;
  pipeline_id: string;
  subTasks: SubTaskAPI[];
  logsBySubTask: Record<string, SubTaskLog[]>;
  totalLogs: number;
}

interface PipelineStateAPI {
  id: string;
  contact_id: string;
  pipeline_id: string;
  current_stage_id: string;
  current_sub_task_id: string | null;
  current_sub_task_started_at: string | null;
  entered_current_stage_at: string;
  pipeline_name: string;
  pipeline_slug: string;
  stages: StageAPI[];
  stageHistory: StageHistoryEntry[];
}

interface PipelineBarProps {
  contactId: string;
  pipelineStates: PipelineStateAPI[];
  selectedPipelineId: string | null;
  onPipelineChange: (id: string) => void;
  expandedStageId: string | null;
  onStageClick: (stageId: string) => void;
  onRefresh: () => void;
}

export default function PipelineBar({
  contactId,
  pipelineStates,
  selectedPipelineId,
  onPipelineChange,
  expandedStageId,
  onStageClick,
  onRefresh,
}: PipelineBarProps) {
  if (pipelineStates.length === 0) {
    return (
      <div className="px-4 py-3 bg-bg-secondary border border-border-default rounded-lg mb-3">
        <p className="text-caption text-text-tertiary text-center">Not in any active pipeline</p>
      </div>
    );
  }

  const selected = pipelineStates.find((p) => p.id === selectedPipelineId) ?? pipelineStates[0];
  const currentStage = selected.stages.find((s) => s.id === selected.current_stage_id);
  const colorLabel = computeColorLabel(selected.current_sub_task_started_at);
  const currentSortOrder = getCurrentStageSortOrder(selected.stages, selected.current_stage_id);

  // Stage action button props
  const currentIdx = selected.stages.findIndex((s) => s.id === selected.current_stage_id);
  const currentStageDef = selected.stages[currentIdx];
  const nextStage = currentIdx < selected.stages.length - 1 ? selected.stages[currentIdx + 1] : null;
  const prevStage = currentIdx > 0 ? selected.stages[currentIdx - 1] : null;

  const currentStageTasks = currentStageDef?.subTasks ?? [];
  const currentLogsMap = new Map(Object.entries(currentStageDef?.logsBySubTask ?? {}));
  const allComplete = currentStageTasks
    .filter((t) => t.is_required)
    .every((t) => {
      const logs = (currentLogsMap.get(t.id) ?? []).filter((l) => !l.deleted_at);
      if (logs.length === 0) return false;
      if (t.state_type === "single") return true;
      return logs[0]?.state_advance === "second";
    });

  return (
    <div className="px-4 py-3 bg-bg-secondary border border-border-default rounded-lg mb-3">
      {/* Pipeline selector (only if multiple) */}
      {pipelineStates.length > 1 && (
        <div className="flex items-center gap-2 mb-3">
          {pipelineStates.map((ps) => (
            <button
              key={ps.id}
              onClick={() => onPipelineChange(ps.id)}
              className={`px-3 py-1 rounded-full text-caption font-medium transition-colors ${
                ps.id === selected.id
                  ? "bg-nah-blue text-white"
                  : "bg-bg-hover text-text-tertiary hover:text-text-primary"
              }`}
            >
              {ps.pipeline_name}
            </button>
          ))}
        </div>
      )}

      {/* Pipeline name for single pipeline */}
      {pipelineStates.length === 1 && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-overline text-text-tertiary tracking-wider">{selected.pipeline_name}</span>
          {currentStage && <span className="text-caption text-text-tertiary">— {currentStage.name}</span>}
        </div>
      )}

      {/* Stage circles */}
      <div className="relative">
        {selected.stages.length > 1 && (
          <div className="absolute top-5 left-6 right-6 h-0.5 bg-border-default hidden sm:block" />
        )}
        <div className="flex items-start justify-between gap-1">
          {selected.stages.map((stage) => {
            const logsMap = new Map(Object.entries(stage.logsBySubTask));
            const state: CircleState = computeStageVisualState(
              stage, selected.current_stage_id, currentSortOrder, stage.subTasks, logsMap
            );
            const isCurrent = stage.id === selected.current_stage_id;

            return (
              <StageCircle
                key={stage.id}
                name={stage.name}
                state={state}
                logCount={stage.totalLogs}
                isActive={state !== "empty"}
                isCurrent={isCurrent}
                colorLabel={isCurrent ? colorLabel : null}
                isExpanded={expandedStageId === stage.id}
                onClick={() => onStageClick(stage.id)}
              />
            );
          })}
        </div>
      </div>

      {/* Stage action buttons */}
      <StageActionButtons
        contactId={contactId}
        pipelineId={selected.pipeline_id}
        pipelineSlug={selected.pipeline_slug}
        currentStageName={currentStageDef?.name ?? ""}
        nextStageName={nextStage?.name ?? null}
        prevStageName={prevStage?.name ?? null}
        allSubTasksComplete={allComplete}
        isFirstStage={currentIdx === 0}
        isLastStage={currentIdx === selected.stages.length - 1}
        onRefresh={onRefresh}
      />

      {/* Resume Sales prompt for Follow-up → Re-engaged */}
      {selected.pipeline_slug === "followup" && currentStage?.slug === "reengaged" && (
        <ResumeSalesPrompt contactId={contactId} onRefresh={onRefresh} />
      )}
    </div>
  );
}
