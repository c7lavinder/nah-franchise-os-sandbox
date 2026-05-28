export type SyncJobName =
  | "sync-ms-prospects"
  | "sync-ms-territories"
  | "sync-ms-properties"
  | "sync-ms-eos"
  | "sync-ms-lead-list"
  | "refresh-ghl-token";

export type SyncHealthStatus = "healthy" | "degraded" | "critical";
export type SyncJobStatus = "success" | "failed" | "running" | "stale" | "no_data";

export const SYNC_JOBS: SyncJobName[] = [
  "sync-ms-prospects",
  "sync-ms-territories",
  "sync-ms-properties",
  "sync-ms-eos",
  "sync-ms-lead-list",
  "refresh-ghl-token",
];

export const SYNC_JOB_LABELS: Record<SyncJobName, string> = {
  "sync-ms-prospects": "prospects",
  "sync-ms-territories": "territories",
  "sync-ms-properties": "properties",
  "sync-ms-eos": "EOS",
  "sync-ms-lead-list": "lead list",
  "refresh-ghl-token": "GHL token",
};

export interface CronJobLogRow {
  job_name: string;
  status: string;
  error: string | null;
  started_at: string;
  finished_at: string | null;
}

export interface SyncJobHealth {
  jobName: SyncJobName;
  label: string;
  lastRunAt: string | null;
  lastFinishedAt: string | null;
  lastSuccessAt: string | null;
  minutesSinceSuccess: number | null;
  status: SyncJobStatus;
  error: string | null;
}

export interface SyncHealthSummary {
  status: SyncHealthStatus;
  cronFailures24h: number;
  syncJobs: SyncJobHealth[];
}

const MS_SYNC_STALE_MINUTES = 90;
const GHL_TOKEN_STALE_MINUTES = 26 * 60;

function minutesBetween(now: Date, value: string | null): number | null {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return null;
  return Math.max(0, Math.round((now.getTime() - timestamp) / 60000));
}

function staleThresholdFor(jobName: SyncJobName): number {
  return jobName === "refresh-ghl-token" ? GHL_TOKEN_STALE_MINUTES : MS_SYNC_STALE_MINUTES;
}

function normalizeLastStatus(jobName: SyncJobName, lastRun: CronJobLogRow | null, minutesSinceSuccess: number | null): SyncJobStatus {
  if (!lastRun) return "no_data";
  if (lastRun.status === "failed") return "failed";
  if (lastRun.status === "running") return "running";
  if (minutesSinceSuccess != null && minutesSinceSuccess > staleThresholdFor(jobName)) return "stale";
  if (lastRun.status === "success") return "success";
  return "failed";
}

export function summarizeSyncHealth(rows: CronJobLogRow[], now = new Date()): SyncHealthSummary {
  const sorted = [...rows].sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const cronFailures24h = sorted.filter(
    (log) => log.status !== "success" && new Date(log.started_at) > oneDayAgo
  ).length;

  const syncJobs = SYNC_JOBS.map((jobName) => {
    const jobRows = sorted.filter((log) => log.job_name === jobName);
    const lastRun = jobRows[0] ?? null;
    const lastSuccess = jobRows.find((log) => log.status === "success") ?? null;
    const lastSuccessAt = lastSuccess?.finished_at ?? lastSuccess?.started_at ?? null;
    const minutesSinceSuccess = minutesBetween(now, lastSuccessAt);
    const status = normalizeLastStatus(jobName, lastRun, minutesSinceSuccess);

    return {
      jobName,
      label: SYNC_JOB_LABELS[jobName],
      lastRunAt: lastRun?.started_at ?? null,
      lastFinishedAt: lastRun?.finished_at ?? null,
      lastSuccessAt,
      minutesSinceSuccess,
      status,
      error: lastRun?.error ?? null,
    };
  });

  const criticalJobs = syncJobs.filter((job) => job.status === "failed").length;
  const degradedJobs = syncJobs.filter((job) => job.status === "running" || job.status === "stale" || job.status === "no_data").length;
  const status: SyncHealthStatus =
    criticalJobs > 0 || cronFailures24h >= 3 ? "critical" : cronFailures24h > 0 || degradedJobs > 0 ? "degraded" : "healthy";

  return { status, cronFailures24h, syncJobs };
}
