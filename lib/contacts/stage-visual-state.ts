/**
 * Sprint 4A — Stage and sub-task visual state derivation.
 *
 * Computes 'empty' / 'half' / 'full' for stage and sub-task circles
 * based on actual log data, plus §1.14 time-in-stage coloring.
 */

import type { PipelineStage, PipelineSubTask, SubTaskLog } from "./pipeline-state";

export type CircleState = "empty" | "half" | "full";
export type ColorLabel = "fresh" | "at_risk" | "losing";

/**
 * Compute whether a stage circle should be empty, half-filled, or full.
 * - 'empty': stage hasn't been reached yet (sort_order > current stage sort_order)
 * - 'half': stage is the current stage AND some (but not all) required sub-tasks complete
 * - 'full': all required sub-tasks complete, OR stage is in the past
 */
export function computeStageVisualState(
  stage: PipelineStage,
  currentStageId: string,
  currentStageSortOrder: number,
  subTasks: PipelineSubTask[],
  logsBySubTask: Map<string, SubTaskLog[]>
): CircleState {
  // Stage is in the future — not reached yet
  if (stage.sort_order > currentStageSortOrder) return "empty";

  // Stage is in the past — already passed through
  if (stage.sort_order < currentStageSortOrder) return "full";

  // Terminal stage reached — always show full
  if (stage.is_terminal) return "full";

  // Stage is the current stage — check sub-task completion
  const requiredTasks = subTasks.filter((st) => st.is_required);
  if (requiredTasks.length === 0) return "half"; // No sub-tasks = in progress

  let completedCount = 0;
  for (const task of requiredTasks) {
    const logs = logsBySubTask.get(task.id) ?? [];
    const state = computeSubTaskVisualState(task, logs);
    if (state === "full") completedCount++;
  }

  if (completedCount === 0) return "half"; // In stage but nothing done
  if (completedCount === requiredTasks.length) return "full"; // All done
  return "half"; // Some done
}

/**
 * Compute sub-task circle state.
 * - 'empty': no logs at all
 * - 'half': for two-state subs, latest log is state_advance='first'
 * - 'full': for two-state subs, latest log is 'second'; for single-state, any log
 */
export function computeSubTaskVisualState(subTask: PipelineSubTask, logs: SubTaskLog[]): CircleState {
  const activeLogs = logs.filter((l) => !l.deleted_at);
  if (activeLogs.length === 0) return "empty";

  if (subTask.state_type === "single") return "full";

  // Two-state: check the latest log's state_advance
  const latest = activeLogs[0]; // Already sorted newest first
  if (latest.state_advance === "second") return "full";
  if (latest.state_advance === "first") return "half";
  return "half"; // Has logs but no state_advance set — treat as half
}

/**
 * Compute time-in-stage color label per §1.14.
 * - fresh: 0-5 days
 * - at_risk: 5-10 days
 * - losing: 10+ days
 */
export function computeColorLabel(startedAt: string | null): ColorLabel {
  if (!startedAt) return "fresh";
  const days = Math.floor((Date.now() - new Date(startedAt).getTime()) / (1000 * 60 * 60 * 24));
  if (days >= 10) return "losing";
  if (days >= 5) return "at_risk";
  return "fresh";
}

/** Get the current stage's sort_order from a list of stages */
export function getCurrentStageSortOrder(stages: PipelineStage[], currentStageId: string): number {
  const current = stages.find((s) => s.id === currentStageId);
  return current?.sort_order ?? 0;
}
