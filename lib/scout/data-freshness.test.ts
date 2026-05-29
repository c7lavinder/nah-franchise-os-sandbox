import { describe, expect, it, vi } from "vitest";
import { loadDataFreshness } from "./data-freshness";

function mockSupabase(data: Array<{ job_name: string; finished_at: string | null }>) {
  const builder = {
    select: vi.fn(() => builder),
    in: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => Promise.resolve({ data })),
  };

  return {
    supabase: { from: vi.fn(() => builder) },
    builder,
  };
}

describe("loadDataFreshness", () => {
  it("loads successful MasterSuite cron runs using current cron health status semantics", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-28T20:00:00.000Z"));
    const { supabase, builder } = mockSupabase([
      { job_name: "sync-ms-prospects", finished_at: "2026-05-28T19:50:00.000Z" },
      { job_name: "sync-ms-properties", finished_at: "2026-05-28T19:45:00.000Z" },
      { job_name: "sync-ms-territories", finished_at: "2026-05-28T19:40:00.000Z" },
    ]);

    const result = await loadDataFreshness(supabase as never);

    expect(builder.eq).toHaveBeenCalledWith("status", "success");
    expect(result).toBe("");
    vi.useRealTimers();
  });

  it("warns when a required MasterSuite sync has no successful run in the freshness window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-28T20:00:00.000Z"));
    const { supabase } = mockSupabase([
      { job_name: "sync-ms-prospects", finished_at: "2026-05-28T19:50:00.000Z" },
      { job_name: "sync-ms-properties", finished_at: "2026-05-28T19:45:00.000Z" },
    ]);

    const result = await loadDataFreshness(supabase as never);

    expect(result).toContain("DATA FRESHNESS WARNING");
    expect(result).toContain("sync-ms-territories: no successful sync on record");
    vi.useRealTimers();
  });
});
