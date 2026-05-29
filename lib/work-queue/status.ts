export const WORK_QUEUE_STATUSES = ["blocked", "needs_review", "due", "waiting", "stale", "healthy", "done"] as const;

export type WorkQueueStatus = (typeof WORK_QUEUE_STATUSES)[number];

export const WORK_QUEUE_STATUS_LABELS: Record<WorkQueueStatus, string> = {
  blocked: "Blocked",
  needs_review: "Needs Review",
  due: "Due",
  waiting: "Waiting",
  stale: "Stale",
  healthy: "Healthy",
  done: "Done",
};

export const WORK_QUEUE_STATUS_ORDER: Record<WorkQueueStatus, number> = {
  blocked: 0,
  needs_review: 1,
  due: 2,
  stale: 3,
  waiting: 4,
  healthy: 5,
  done: 6,
};

const STATUS_BY_LABEL = new Map(
  Object.entries(WORK_QUEUE_STATUS_LABELS).map(([status, label]) => [label.toLowerCase(), status as WorkQueueStatus])
);

export function isWorkQueueStatus(value: string): value is WorkQueueStatus {
  return (WORK_QUEUE_STATUSES as readonly string[]).includes(value);
}

export function normalizeWorkQueueStatus(value: string): WorkQueueStatus | null {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (isWorkQueueStatus(normalized)) return normalized;
  return STATUS_BY_LABEL.get(value.trim().toLowerCase()) ?? null;
}

export function getWorkQueueStatusLabel(status: WorkQueueStatus): string {
  return WORK_QUEUE_STATUS_LABELS[status];
}
