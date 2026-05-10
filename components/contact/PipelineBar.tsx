"use client";

/**
 * PipelineBar — persistent horizontal pipeline visualization for contact page.
 * Shows stage circles + action buttons. Renders above tabs.
 *
 * Phase 4B: when the selected pipeline has multiple territory-scoped jps
 * rows (Phil-style multi-territory franchisees in runway/onboarding), a
 * territory picker strip renders above the stage circles. Selecting a
 * territory overrides the displayed stage and threads the territory slug
 * into the stage action buttons so advance/drop/revert affect only that
 * territory's jps row.
 */

import { useEffect, useState } from "react";
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
  territories?: TerritoryState[];
}

interface PipelineBarProps {
  contactId: string;
  pipelineStates: PipelineStateAPI[];
  selectedPipelineId: string | null;
  onPipelineChange: (id: string) => void;
  expandedStageId: string | null;
  onStageClick: (stageId: string) => void;
  onRefresh: () => void;
  focusedTerritorySlug?: string | null;
  onTerritoryChange?: (slug: string | null) => void;
}

export default function PipelineBar({
  contactId,
  pipelineStates,
  selectedPipelineId,
  onPipelineChange,
  expandedStageId,
  onStageClick,
  onRefresh,
  focusedTerritorySlug,
  onTerritoryChange,
}: PipelineBarProps) {
  const [internalTerritory, setInternalTerritory] = useState<string | null>(null);
  const territorySlug = focusedTerritorySlug !== undefined ? focusedTerritorySlug : internalTerritory;

  const selected = pipelineStates.find((p) => p.id === selectedPipelineId) ?? pipelineStates[0] ?? null;
  const selectedId = selected?.id;

  // Hook called unconditionally — early returns live below. Resets internal
  // territory focus when the pipeline changes so stale slug doesn't leak across.
  useEffect(() => {
    if (focusedTerritorySlug === undefined) setInternalTerritory(null);
  }, [selectedId, focusedTerritorySlug]);

  if (pipelineStates.length === 0 || !selected) {
    return (
      <div className="px-4 py-3 bg-bg-secondary border border-border-default rounded-lg mb-3">
        <p className="text-caption text-text-tertiary text-center">Not in any active pipeline</p>
      </div>
    );
  }

  const territories = selected.territories ?? [];
  const hasMultipleTerritories = territories.length >= 2;

  // Resolve which territory is focused. Default: first territory. Respect URL.
  const activeTerritory = hasMultipleTerritories
    ? (territories.find((t) => t.TerritorySlug === territorySlug) ?? territories[0])
    : null;

  // Override displayed stage with the focused territory's stage for runway/onboarding.
  const displayStageId = activeTerritory?.stage_id ?? selected.current_stage_id;
  const displaySubTaskStartedAt = activeTerritory?.current_sub_task_started_at ?? selected.current_sub_task_started_at;

  const currentStage = selected.stages.find((s) => s.id === displayStageId);
  const colorLabel = computeColorLabel(displaySubTaskStartedAt);
  const currentSortOrder = getCurrentStageSortOrder(selected.stages, displayStageId);

  const currentIdx = selected.stages.findIndex((s) => s.id === displayStageId);
  const currentStageDef = selected.stages[currentIdx];
  const nextStage = currentIdx < selected.stages.length - 1 ? selected.stages[currentIdx + 1] : null;
  const prevStage = currentIdx > 0 ? selected.stages[currentIdx - 1] : null;

  const currentStageTasks = currentStageDef?.subTasks ?? [];
  const currentLogsMap = new Map(Object.entries(currentStageDef?.logsBySubTask ?? {}));
  // Sub-task completion is still derived from cps-backed logs. For per-territory
  // writes this is a known gap — all territories share the same log history during
  // the transition period. Good enough for v1: the Advance button stays wired to
  // the common cps completion signal.
  const allComplete = currentStageTasks
    .filter((t) => t.is_required)
    .every((t) => {
      const logs = (currentLogsMap.get(t.id) ?? []).filter((l) => !l.deleted_at);
      if (logs.length === 0) return false;
      if (t.state_type === "single") return true;
      return logs[0]?.state_advance === "second";
    });

  const handleTerritoryChange = (slug: string) => {
    if (onTerritoryChange) onTerritoryChange(slug);
    else setInternalTerritory(slug);
  };

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

      {/* Territory picker (only when 2+ territories in this pipeline) */}
      {hasMultipleTerritories && (
        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          <span className="text-[10px] font-semibold text-text-tertiary tracking-wider mr-1">TERRITORY:</span>
          {territories.map((t) => {
            const isActive = activeTerritory?.TerritorySlug === t.TerritorySlug;
            return (
              <button
                key={t.TerritorySlug}
                onClick={() => handleTerritoryChange(t.TerritorySlug)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-caption font-medium transition-colors ${
                  isActive ? "bg-nah-orange text-white" : "bg-bg-hover text-text-tertiary hover:text-text-primary"
                }`}
              >
                {t.Nickname}
                <span className={`text-[10px] font-normal ${isActive ? "text-white/75" : "text-text-tertiary"}`}>
                  · {t.stage_name}
                </span>
              </button>
            );
          })}
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
              stage,
              displayStageId,
              currentSortOrder,
              stage.subTasks,
              logsMap
            );
            const isCurrent = stage.id === displayStageId;

            const isPassed = stage.sort_order < currentSortOrder;
            const requiredTasks = stage.subTasks.filter((t) => t.is_required);
            const hasMissingLogs =
              isPassed &&
              requiredTasks.length > 0 &&
              requiredTasks.some((t) => {
                const logs = (logsMap.get(t.id) ?? []).filter((l) => !l.deleted_at);
                return logs.length === 0;
              });

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
                hasMissingLogs={hasMissingLogs}
                onClick={() => onStageClick(stage.id)}
              />
            );
          })}
        </div>
      </div>

      {/* Stage action buttons — carry territory context when one is focused */}
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
        territoryMsSlug={activeTerritory?.TerritorySlug ?? null}
        onRefresh={onRefresh}
      />

      {/* Resume Sales prompt for Follow-up → Re-engaged */}
      {selected.pipeline_slug === "followup" && currentStage?.slug === "reengaged" && (
        <ResumeSalesPrompt contactId={contactId} onRefresh={onRefresh} />
      )}
    </div>
  );
}
