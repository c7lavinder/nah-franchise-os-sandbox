import { describe, expect, it } from "vitest";
import { getStaleRunningCutoff, isActiveRunningJob } from "./cron-lock";

const now = new Date("2026-05-28T20:00:00.000Z");

describe("MasterSuite cron lock helpers", () => {
  it("marks recent running jobs active", () => {
    expect(isActiveRunningJob({ id: "1", started_at: "2026-05-28T19:45:00.000Z" }, now)).toBe(true);
  });

  it("does not mark stale running jobs active", () => {
    expect(isActiveRunningJob({ id: "1", started_at: "2026-05-28T19:20:00.000Z" }, now)).toBe(false);
  });

  it("computes the stale cutoff for cleanup queries", () => {
    expect(getStaleRunningCutoff(now)).toBe("2026-05-28T19:30:00.000Z");
  });
});
