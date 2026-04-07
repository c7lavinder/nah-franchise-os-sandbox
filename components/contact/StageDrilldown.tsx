"use client";

/**
 * StageDrilldown — shows sub-tasks + stage history when a stage is clicked.
 * Left/top: sub-task circles connected by vertical line.
 * Right/bottom: stage history entries for this stage.
 */

import { useState } from "react";
import { AlertTriangle, RotateCcw, Bot, ArrowRight } from "lucide-react";
import SubTaskCircle from "./SubTaskCircle";
import SubTaskLogHistory from "./SubTaskLogHistory";
import type { PipelineSubTask, SubTaskLog, StageHistoryEntry } from "@/lib/contacts/pipeline-state";
import { computeSubTaskVisualState } from "@/lib/contacts/stage-visual-state";

interface StageDrilldownProps {
  subTasks: PipelineSubTask[];
  logsBySubTask: Map<string, SubTaskLog[]>;
  stageHistory: StageHistoryEntry[];
  stageId: string;
}

export default function StageDrilldown({
  subTasks,
  logsBySubTask,
  stageHistory,
  stageId,
}: StageDrilldownProps) {
  const [expandedSubTask, setExpandedSubTask] = useState<string | null>(null);

  // Filter history to entries where to_stage_id matches this stage
  const relevantHistory = stageHistory.filter((h) => h.to_stage_id === stageId);

  return (
    <div className="mt-3 bg-bg-secondary border border-border-default rounded-lg p-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Sub-tasks column */}
        <div>
          {subTasks.length === 0 ? (
            <p className="text-caption text-text-tertiary italic">No sub-tasks for this stage</p>
          ) : (
            <div className="relative">
              {/* Vertical connector line */}
              {subTasks.length > 1 && (
                <div className="absolute left-[17px] top-5 bottom-5 w-0.5 bg-border-default" />
              )}

              <div className="space-y-0.5">
                {subTasks.map((task) => {
                  const logs = logsBySubTask.get(task.id) ?? [];
                  const state = computeSubTaskVisualState(task, logs);
                  const isExpanded = expandedSubTask === task.id;

                  return (
                    <div key={task.id}>
                      <SubTaskCircle
                        name={task.name}
                        state={state}
                        stateType={task.state_type}
                        firstStateLabel={task.first_state_label}
                        secondStateLabel={task.second_state_label}
                        logCount={logs.length}
                        isExpanded={isExpanded}
                        onClick={() => setExpandedSubTask(isExpanded ? null : task.id)}
                      />
                      {isExpanded && <SubTaskLogHistory logs={logs} />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Stage history column */}
        <div>
          {relevantHistory.length > 0 && (
            <>
              <h4 className="text-caption font-medium text-text-tertiary mb-2">Stage History</h4>
              <div className="space-y-2">
                {relevantHistory.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start gap-2 text-caption text-text-secondary"
                  >
                    {/* Icon based on type */}
                    {entry.was_skip ? (
                      <AlertTriangle size={12} className="text-warning flex-shrink-0 mt-0.5" />
                    ) : entry.was_revert ? (
                      <RotateCcw size={12} className="text-danger flex-shrink-0 mt-0.5" />
                    ) : entry.was_auto ? (
                      <Bot size={12} className="text-scout-purple flex-shrink-0 mt-0.5" />
                    ) : (
                      <ArrowRight size={12} className="text-text-tertiary flex-shrink-0 mt-0.5" />
                    )}

                    <div className="flex-1">
                      <span>
                        {entry.from_stage_name
                          ? `From ${entry.from_stage_name}`
                          : "Initial entry"
                        }
                        {entry.moved_by_name && ` by ${entry.moved_by_name}`}
                        {entry.was_skip && " (skipped)"}
                        {entry.was_revert && " (reverted)"}
                        {entry.was_auto && " (auto)"}
                      </span>
                      {entry.reason && (
                        <p className="text-text-tertiary italic mt-0.5">{entry.reason}</p>
                      )}
                      <p className="text-text-tertiary text-[10px]">
                        {new Date(entry.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
