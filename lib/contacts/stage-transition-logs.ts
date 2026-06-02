export interface OrderedStage {
  id: string;
  sort_order: number;
}

export interface StageTransitionHistoryRow {
  journey_pipeline_state_id: string;
  from_stage_id: string | null;
  to_stage_id: string;
  moved_by_user_id: string | null;
  reason: string | null;
  was_skip: boolean;
  was_revert: boolean;
  was_auto: boolean;
  created_at: string;
}

interface BuildStageTransitionRowsInput {
  journeyPipelineStateId: string;
  stages: OrderedStage[];
  fromStageId: string;
  toStageId: string;
  movedByUserId?: string | null;
  reason?: string | null;
  timestamp: string;
  forceSkip?: boolean;
  wasAuto?: boolean;
}

export function buildStageTransitionHistoryRows({
  journeyPipelineStateId,
  stages,
  fromStageId,
  toStageId,
  movedByUserId = null,
  reason = null,
  timestamp,
  forceSkip = false,
  wasAuto = false,
}: BuildStageTransitionRowsInput): StageTransitionHistoryRow[] {
  const ordered = [...stages].sort((a, b) => a.sort_order - b.sort_order);
  const fromIdx = ordered.findIndex((stage) => stage.id === fromStageId);
  const toIdx = ordered.findIndex((stage) => stage.id === toStageId);

  if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return [];

  const direction = toIdx > fromIdx ? 1 : -1;
  const rows: StageTransitionHistoryRow[] = [];

  for (let idx = fromIdx + direction; direction > 0 ? idx <= toIdx : idx >= toIdx; idx += direction) {
    const previous = ordered[idx - direction];
    const current = ordered[idx];
    const isIntermediateForwardSkip = direction > 0 && idx < toIdx;

    rows.push({
      journey_pipeline_state_id: journeyPipelineStateId,
      from_stage_id: previous.id,
      to_stage_id: current.id,
      moved_by_user_id: movedByUserId,
      reason,
      was_skip: direction > 0 && (forceSkip || isIntermediateForwardSkip),
      was_revert: direction < 0,
      was_auto: wasAuto,
      created_at: timestamp,
    });
  }

  return rows;
}

interface RecordStageTransitionInput {
  supabase: { from: (table: "pipeline_stage_history") => any };
  journeyPipelineStateId: string;
  stages: OrderedStage[];
  fromStageId: string;
  toStageId: string;
  movedByUserId?: string | null;
  reason?: string | null;
  timestamp: string;
  forceSkip?: boolean;
  wasAuto?: boolean;
}

export async function recordStageTransitionHistory({
  supabase,
  ...input
}: RecordStageTransitionInput): Promise<StageTransitionHistoryRow[]> {
  const rows = buildStageTransitionHistoryRows(input);
  if (rows.length === 0) return [];

  const { error } = await supabase.from("pipeline_stage_history").insert(rows);
  if (error) throw new Error(error.message ?? "Failed to record stage history");

  return rows;
}
