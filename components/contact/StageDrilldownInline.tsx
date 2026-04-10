"use client";

/**
 * StageDrilldownInline — shown below PipelineBar when a stage is clicked.
 * Reuses StageDrilldown logic inline with a close button.
 */

import { X } from "lucide-react";
import StageDrilldown from "./StageDrilldown";
import type { PipelineSubTask, SubTaskLog, StageHistoryEntry } from "@/lib/contacts/pipeline-state";

interface StageDrilldownInlineProps {
  contactId: string;
  stageName: string;
  subTasks: PipelineSubTask[];
  logsBySubTask: Map<string, SubTaskLog[]>;
  stageHistory: StageHistoryEntry[];
  stageId: string;
  isPastStage?: boolean;
  onRefresh: () => void;
  onClose: () => void;
}

export default function StageDrilldownInline({
  contactId,
  stageName,
  subTasks,
  logsBySubTask,
  stageHistory,
  stageId,
  isPastStage,
  onRefresh,
  onClose,
}: StageDrilldownInlineProps) {
  return (
    <div className="mb-3 border border-border-default rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-bg-secondary">
        <span className="text-body-sm font-medium text-text-primary">{stageName}</span>
        <button onClick={onClose} className="btn-ghost p-1">
          <X size={14} />
        </button>
      </div>
      <div className="px-0">
        <StageDrilldown
          contactId={contactId}
          subTasks={subTasks}
          logsBySubTask={logsBySubTask}
          stageHistory={stageHistory}
          stageId={stageId}
          isPastStage={isPastStage}
          onRefresh={onRefresh}
        />
      </div>
    </div>
  );
}
