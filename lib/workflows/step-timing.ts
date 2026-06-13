import type { WorkflowStep } from "@/lib/workflows/types";

export function getStepDelayHours(step: Pick<WorkflowStep, "condition_config" | "day_number">): number {
  const config = (step.condition_config ?? {}) as Record<string, unknown>;
  const rawDelay = config.delayHours ?? config.hoursAfterEnrollment;
  const numericDelay = typeof rawDelay === "number" ? rawDelay : typeof rawDelay === "string" ? Number(rawDelay) : NaN;

  if (Number.isFinite(numericDelay) && numericDelay >= 0) {
    return numericDelay;
  }

  return Math.max(0, (step.day_number - 1) * 24);
}

export function formatStepDelay(step: Pick<WorkflowStep, "condition_config" | "day_number">): string {
  const hours = getStepDelayHours(step);

  if (hours === 0) return "immediate";
  if (hours === 1) return "1h after lead";
  if (hours < 24) return `${hours}h after lead`;

  const days = hours / 24;
  if (Number.isInteger(days)) {
    return days === 1 ? "24h after lead" : `${hours}h after lead`;
  }

  return `${hours}h after lead`;
}

export function isStepDueForEnrollment(
  step: Pick<WorkflowStep, "condition_config" | "day_number">,
  enrollment: { enrolled_at?: string | null },
  now = new Date()
): boolean {
  if (!enrollment.enrolled_at) return true;

  const enrolledAt = new Date(enrollment.enrolled_at);
  if (Number.isNaN(enrolledAt.getTime())) return true;

  const elapsedHours = (now.getTime() - enrolledAt.getTime()) / (1000 * 60 * 60);
  return elapsedHours >= getStepDelayHours(step);
}
