export const STALE_RUNNING_JOB_MS = 30 * 60 * 1000;

export type RunningCronLog = {
  id: string;
  started_at: string;
};

export function getStaleRunningCutoff(now = new Date()): string {
  return new Date(now.getTime() - STALE_RUNNING_JOB_MS).toISOString();
}

export function isActiveRunningJob(log: RunningCronLog | null | undefined, now = new Date()): boolean {
  if (!log?.started_at) return false;
  const startedAt = new Date(log.started_at).getTime();
  return Number.isFinite(startedAt) && now.getTime() - startedAt < STALE_RUNNING_JOB_MS;
}
