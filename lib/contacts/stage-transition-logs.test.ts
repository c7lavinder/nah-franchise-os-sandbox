import { describe, expect, it } from "vitest";
import { buildStageTransitionHistoryRows } from "./stage-transition-logs";

const stages = [
  { id: "stage-a", sort_order: 10 },
  { id: "stage-b", sort_order: 20 },
  { id: "stage-c", sort_order: 30 },
  { id: "stage-d", sort_order: 40 },
];

describe("buildStageTransitionHistoryRows", () => {
  it("creates one row for a direct forward stage change", () => {
    const rows = buildStageTransitionHistoryRows({
      journeyPipelineStateId: "jps-1",
      stages,
      fromStageId: "stage-a",
      toStageId: "stage-b",
      movedByUserId: "user-1",
      timestamp: "2026-06-03T01:00:00.000Z",
    });

    expect(rows).toEqual([
      {
        journey_pipeline_state_id: "jps-1",
        from_stage_id: "stage-a",
        to_stage_id: "stage-b",
        moved_by_user_id: "user-1",
        reason: null,
        was_skip: false,
        was_revert: false,
        was_auto: false,
        created_at: "2026-06-03T01:00:00.000Z",
      },
    ]);
  });

  it("fills skipped forward stages with the moved-to timestamp", () => {
    const rows = buildStageTransitionHistoryRows({
      journeyPipelineStateId: "jps-1",
      stages,
      fromStageId: "stage-a",
      toStageId: "stage-d",
      movedByUserId: "user-1",
      reason: "Jumped ahead",
      timestamp: "2026-06-03T01:05:00.000Z",
    });

    expect(rows.map((row) => [row.from_stage_id, row.to_stage_id])).toEqual([
      ["stage-a", "stage-b"],
      ["stage-b", "stage-c"],
      ["stage-c", "stage-d"],
    ]);
    expect(rows.every((row) => row.created_at === "2026-06-03T01:05:00.000Z")).toBe(true);
    expect(rows.map((row) => row.was_skip)).toEqual([true, true, false]);
    expect(rows.every((row) => row.reason === "Jumped ahead")).toBe(true);
  });

  it("marks backwards movement as revert history", () => {
    const rows = buildStageTransitionHistoryRows({
      journeyPipelineStateId: "jps-1",
      stages,
      fromStageId: "stage-c",
      toStageId: "stage-b",
      timestamp: "2026-06-03T01:10:00.000Z",
    });

    expect(rows).toMatchObject([
      {
        from_stage_id: "stage-c",
        to_stage_id: "stage-b",
        was_skip: false,
        was_revert: true,
        created_at: "2026-06-03T01:10:00.000Z",
      },
    ]);
  });
});
