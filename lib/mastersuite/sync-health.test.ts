import { describe, expect, it } from "vitest";
import { SYNC_JOBS, summarizeSyncHealth, type CronJobLogRow } from "./sync-health";

const now = new Date("2026-05-28T20:00:00.000Z");

function row(job_name: string, status: string, startedAtMinutesAgo: number, error: string | null = null): CronJobLogRow {
  const started = new Date(now.getTime() - startedAtMinutesAgo * 60000).toISOString();
  return {
    job_name,
    status,
    error,
    started_at: started,
    finished_at: status === "running" ? null : started,
  };
}

describe("summarizeSyncHealth", () => {
  it("reports healthy when every sync job has a recent successful run", () => {
    const rows = SYNC_JOBS.map((job) => row(job, "success", 20));

    const summary = summarizeSyncHealth(rows, now);

    expect(summary.status).toBe("healthy");
    expect(summary.cronFailures24h).toBe(0);
    expect(summary.syncJobs.every((job) => job.status === "success")).toBe(true);
  });

  it("marks MasterSuite sync jobs stale after the 30-minute cadence has been missed long enough", () => {
    const rows = SYNC_JOBS.map((job) => row(job, "success", job === "refresh-ghl-token" ? 120 : 100));

    const summary = summarizeSyncHealth(rows, now);
    const staleMsJobs = summary.syncJobs.filter((job) => job.jobName.startsWith("sync-ms-"));

    expect(summary.status).toBe("degraded");
    expect(staleMsJobs.every((job) => job.status === "stale")).toBe(true);
    expect(summary.syncJobs.find((job) => job.jobName === "refresh-ghl-token")?.status).toBe("success");
  });

  it("reports critical when a latest sync run failed", () => {
    const rows = SYNC_JOBS.map((job) => row(job, "success", 20));
    rows.unshift(row("sync-ms-prospects", "failed", 5, "MySQL unreachable"));

    const summary = summarizeSyncHealth(rows, now);

    expect(summary.status).toBe("critical");
    expect(summary.syncJobs.find((job) => job.jobName === "sync-ms-prospects")?.status).toBe("failed");
    expect(summary.syncJobs.find((job) => job.jobName === "sync-ms-prospects")?.error).toBe("MySQL unreachable");
  });

  it("keeps current health healthy when older 24h failures have been followed by latest successes", () => {
    const rows = SYNC_JOBS.flatMap((job) => [row(job, "success", 20), row(job, "failed", 40, "older failure")]);

    const summary = summarizeSyncHealth(rows, now);

    expect(summary.status).toBe("healthy");
    expect(summary.cronFailures24h).toBe(SYNC_JOBS.length);
    expect(summary.syncJobs.every((job) => job.status === "success")).toBe(true);
  });
});
