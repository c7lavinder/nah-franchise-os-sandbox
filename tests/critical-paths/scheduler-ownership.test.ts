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

    // Retired at the DOMAIN-5 flip (2026-08-09): native lead intake owns the
    // prospect inflow (two importers racing one source = duplicate contacts)
    // and the native runway derivation owns jps placement. Re-adding either
    // reopens the race the flip closed.
    expect(cronPaths.has("/frandev/api/cron/sync-ms-territories")).toBe(false);
    expect(cronPaths.has("/frandev/api/cron/sync-ms-prospects")).toBe(false);
    expect(cronPaths.has("/frandev/api/cron/runway-pipeline-guardian")).toBe(false);

    // The agents retired with them — their native twins run in Hangfire.
    expect(cronPaths.has("/frandev/api/cron/research-contacts")).toBe(false);
    expect(cronPaths.has("/frandev/api/cron/reengagement-scan")).toBe(false);
    expect(cronPaths.has("/frandev/api/cron/coaching-brief")).toBe(false);

    // Retired at the DOMAIN-6 flip (2026-08-10, ADR-0016): the journals cron's
    // contact half double-ran with the native contact-journals agent (its rep +
    // system halves wrote tables with zero readers); weekly-report wrote
    // scout_performance_reports (zero readers); pre-call-briefs produced
    // nothing durable and MS #733's native pre-call cue replaced it. Re-adding
    // journals reopens the journal double-run.
    expect(cronPaths.has("/frandev/api/cron/journals")).toBe(false);
    expect(cronPaths.has("/frandev/api/cron/weekly-report")).toBe(false);
    expect(cronPaths.has("/frandev/api/cron/pre-call-briefs")).toBe(false);

    // The bridge stays: the replay keeps Supabase trailing native writes, and
    // the push still carries the non-retired tables for domains 6/7.
    expect(Array.from(cronPaths)).toEqual(
      expect.arrayContaining(["/frandev/api/cron/apply-mastersuite-writes", "/frandev/api/cron/push-frandev"])
    );

    // Retired by ADR-0014 (2026-08-09): native MasterSuite reads the MySQL property
    // originals directly, so these mirrors have no consumer that needs freshness.
    // They must STAY retired — re-adding one silently reopens the inbound seam.
    expect(cronPaths.has("/frandev/api/cron/sync-ms-lead-list")).toBe(false);
    expect(cronPaths.has("/frandev/api/cron/sync-ms-properties")).toBe(false);

    // Retired after MasterSuite PR #718 deployed: the native EOS tab reads the
    // Eos_* originals, so the 7 eos_territory_* mirrors have no native consumer.
    // Goals tab + market data deliberately STAY on mirrors (app-born data).
    expect(cronPaths.has("/frandev/api/cron/sync-ms-eos")).toBe(false);
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
