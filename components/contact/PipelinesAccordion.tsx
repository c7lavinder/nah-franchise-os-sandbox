"use client";

/**
 * PipelinesAccordion — Sprint 4A read-only Stages tab.
 *
 * Fetches all active pipelines for a contact and renders each as a
 * collapsible section with stage circles, sub-task drilldown, and history.
 */

import { useState, useEffect, useCallback } from "react";
import { ChevronDown, ChevronRight, Loader2, GitBranch } from "lucide-react";
import StageCircle from "./StageCircle";
import StageDrilldown from "./StageDrilldown";
import StageActionButtons from "./StageActionButtons";
import type { SubTaskLog, StageHistoryEntry } from "@/lib/contacts/pipeline-state";
import {
  computeStageVisualState,
  computeColorLabel,
  getCurrentStageSortOrder,
} from "@/lib/contacts/stage-visual-state";
import type { CircleState } from "@/lib/contacts/stage-visual-state";

// ─── API response types ───

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

interface PipelinesAccordionProps {
  contactId: string; // GHL contact ID
}

export default function PipelinesAccordion({ contactId }: PipelinesAccordionProps) {
  const [pipelineStates, setPipelineStates] = useState<PipelineStateAPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPipeline, setExpandedPipeline] = useState<string | null>(null);
  const [expandedStage, setExpandedStage] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}/pipeline-state`);
      if (res.ok) {
        const data = await res.json();
        const states = data.pipelineStates ?? [];
        setPipelineStates(states);

        // Auto-expand if only one pipeline, or expand the most recently active
        if (states.length === 1) {
          setExpandedPipeline(states[0].id);
        } else if (states.length > 0) {
          setExpandedPipeline(states[0].id); // First = most recent activity
        }
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [contactId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-text-tertiary" />
      </div>
    );
  }

  if (pipelineStates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <GitBranch size={32} className="text-text-tertiary mb-3" />
        <p className="text-body-sm text-text-tertiary">No active pipelines for this contact</p>
        <p className="text-caption text-text-tertiary mt-1">
          This contact hasn&apos;t been synced to a pipeline yet.
        </p>
      </div>
    );
  }

  const singlePipeline = pipelineStates.length === 1;

  return (
    <div className="space-y-3">
      {pipelineStates.map((pState) => {
        const isExpanded = expandedPipeline === pState.id;
        const currentStage = pState.stages.find((s) => s.id === pState.current_stage_id);
        const colorLabel = computeColorLabel(pState.current_sub_task_started_at);

        return (
          <div key={pState.id} className="border border-border-default rounded-lg overflow-hidden">
            {/* Accordion header — hidden if single pipeline */}
            {!singlePipeline && (
              <button
                onClick={() => setExpandedPipeline(isExpanded ? null : pState.id)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-bg-secondary hover:bg-bg-hover transition-colors"
              >
                {isExpanded ? <ChevronDown size={16} className="text-text-tertiary" /> : <ChevronRight size={16} className="text-text-tertiary" />}
                <span className="text-body-sm font-medium text-text-primary">{pState.pipeline_name}</span>
                {currentStage && (
                  <span className="text-caption text-text-tertiary">
                    Current: {currentStage.name}
                  </span>
                )}
                <ColorDot label={colorLabel} />
              </button>
            )}

            {/* Pipeline body */}
            {(isExpanded || singlePipeline) && (
              <div className="p-4">
                {/* Single pipeline header */}
                {singlePipeline && (
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-overline text-text-tertiary tracking-wider">{pState.pipeline_name}</span>
                    {currentStage && (
                      <span className="text-caption text-text-tertiary">
                        — {currentStage.name}
                      </span>
                    )}
                    <ColorDot label={colorLabel} />
                  </div>
                )}

                {/* Stage circles row */}
                <StagesRow
                  contactId={contactId}
                  pipelineId={pState.pipeline_id}
                  stages={pState.stages}
                  currentStageId={pState.current_stage_id}
                  currentSubTaskStartedAt={pState.current_sub_task_started_at}
                  expandedStage={expandedStage}
                  onStageClick={(stageId) => setExpandedStage(expandedStage === stageId ? null : stageId)}
                  stageHistory={pState.stageHistory}
                  onRefresh={fetchData}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StagesRow({
  contactId,
  pipelineId,
  stages,
  currentStageId,
  currentSubTaskStartedAt,
  expandedStage,
  onStageClick,
  stageHistory,
  onRefresh,
}: {
  contactId: string;
  pipelineId: string;
  stages: StageAPI[];
  currentStageId: string;
  currentSubTaskStartedAt: string | null;
  expandedStage: string | null;
  onStageClick: (stageId: string) => void;
  stageHistory: StageHistoryEntry[];
  onRefresh: () => void;
}) {
  const currentSortOrder = getCurrentStageSortOrder(stages, currentStageId);
  const colorLabel = computeColorLabel(currentSubTaskStartedAt);

  return (
    <div>
      {/* Horizontal stage circles */}
      <div className="relative">
        {stages.length > 1 && (
          <div className="absolute top-6 left-8 right-8 h-0.5 bg-border-default hidden sm:block" />
        )}
        <div className="flex items-start justify-between gap-1">
          {stages.map((stage) => {
            const logsMap = new Map(Object.entries(stage.logsBySubTask));
            const state: CircleState = computeStageVisualState(
              stage, currentStageId, currentSortOrder, stage.subTasks, logsMap
            );
            const isCurrent = stage.id === currentStageId;
            const totalLogs = stage.totalLogs;

            return (
              <StageCircle
                key={stage.id}
                name={stage.name}
                state={state}
                logCount={totalLogs}
                isActive={state !== "empty"}
                isCurrent={isCurrent}
                colorLabel={isCurrent ? colorLabel : null}
                isExpanded={expandedStage === stage.id}
                onClick={() => onStageClick(stage.id)}
              />
            );
          })}
        </div>
      </div>

      {/* Drilldown when stage is expanded */}
      {expandedStage && (() => {
        const stage = stages.find((s) => s.id === expandedStage);
        if (!stage) return null;
        const logsMap = new Map(Object.entries(stage.logsBySubTask));

        return (
          <StageDrilldown
            contactId={contactId}
            subTasks={stage.subTasks}
            logsBySubTask={logsMap}
            stageHistory={stageHistory}
            stageId={expandedStage}
            onRefresh={onRefresh}
          />
        );
      })()}

      {/* Stage action buttons */}
      {(() => {
        const currentIdx = stages.findIndex((s) => s.id === currentStageId);
        const currentStage = stages[currentIdx];
        const nextStage = currentIdx < stages.length - 1 ? stages[currentIdx + 1] : null;
        const prevStage = currentIdx > 0 ? stages[currentIdx - 1] : null;

        // Check if all required sub-tasks in current stage are complete
        const currentStageTasks = currentStage?.subTasks ?? [];
        const currentLogsMap = new Map(Object.entries(currentStage?.logsBySubTask ?? {}));
        const allComplete = currentStageTasks
          .filter((t) => t.is_required)
          .every((t) => {
            const logs = (currentLogsMap.get(t.id) ?? []).filter((l) => !l.deleted_at);
            if (logs.length === 0) return false;
            if (t.state_type === "single") return true;
            return logs[0]?.state_advance === "second";
          });

        return (
          <StageActionButtons
            contactId={contactId}
            pipelineId={pipelineId}
            currentStageName={currentStage?.name ?? ""}
            nextStageName={nextStage?.name ?? null}
            prevStageName={prevStage?.name ?? null}
            allSubTasksComplete={allComplete}
            isFirstStage={currentIdx === 0}
            isLastStage={currentIdx === stages.length - 1}
            onRefresh={onRefresh}
          />
        );
      })()}
    </div>
  );
}

function ColorDot({ label }: { label: "fresh" | "at_risk" | "losing" }) {
  const colors = {
    fresh: "bg-[#2e7d32]",
    at_risk: "bg-[#e65100]",
    losing: "bg-[#c62828]",
  };
  return <span className={`w-2 h-2 rounded-full ${colors[label]} flex-shrink-0`} />;
}
