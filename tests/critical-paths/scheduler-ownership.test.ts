import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("scheduler ownership contract", () => {
  it("keeps MasterSuite sync production ownership on Vercel Cron", () => {
    const vercel = JSON.parse(read("vercel.json")) as { crons?: Array<{ path: string; schedule: string }> };
    const cronPaths = new Set((vercel.crons ?? []).map((cron) => cron.path));

    // The syncs still on the schedule — territories (reference table + market-data
    // round-trip), EOS (scorecard round-trip), prospects (live lead inflow).
    expect(Array.from(cronPaths)).toEqual(
      expect.arrayContaining([
        "/frandev/api/cron/sync-ms-territories",
        "/frandev/api/cron/sync-ms-prospects",
        "/frandev/api/cron/sync-ms-eos",
      ])
    );

    // Retired by ADR-0014 (2026-08-09): native MasterSuite reads the MySQL property
    // originals directly, so these mirrors have no consumer that needs freshness.
    // They must STAY retired — re-adding one silently reopens the inbound seam.
    expect(cronPaths.has("/frandev/api/cron/sync-ms-lead-list")).toBe(false);
    expect(cronPaths.has("/frandev/api/cron/sync-ms-properties")).toBe(false);
  });

  it("keeps GitHub MasterSuite sync manual-only", () => {
    const workflow = read(".github/workflows/sync-mastersuite.yml");

    expect(workflow).toContain("workflow_dispatch");
    expect(workflow).toContain("Cron disabled");
    expect(workflow).not.toMatch(/^\s+schedule:\s*$/m);
  });

  it("documents that local launchd is not the production MasterSuite sync owner", () => {
    const ownershipDoc = read("docs/scheduler-ownership.md");
    const runbook = read("docs/build-deploy-runbook.md");

    expect(ownershipDoc).toContain("FranDev production scheduling is owned by Vercel Cron");
    expect(ownershipDoc).toContain("Local launchd/node-cron jobs are not production owners for MasterSuite sync");
    expect(runbook).toContain("MasterSuite DB sync runs from Vercel cron, not Corey's local machine");
  });
});
