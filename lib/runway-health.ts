/**
 * Runway Health — Time threshold logic for territory pipelines
 *
 * First Offer: yellow 30d, red 60d
 * First Purchase: yellow 60d, red 90d
 * Inventory Building: yellow 90d, red 180d
 * Running: red if houses_last_12_months < 10
 */

export type HealthStatus = "fresh" | "yellow" | "red";

interface RunwayThresholds {
  yellowDays: number;
  redDays: number;
}

const STAGE_THRESHOLDS: Record<string, RunwayThresholds> = {
  "first-offer": { yellowDays: 30, redDays: 60 },
  "first-purchase": { yellowDays: 60, redDays: 90 },
  "inventory-building": { yellowDays: 90, redDays: 180 },
};

export function getRunwayHealthStatus(
  stageSlug: string,
  daysInStage: number
): HealthStatus {
  const thresholds = STAGE_THRESHOLDS[stageSlug];
  if (!thresholds) return "fresh";

  if (daysInStage >= thresholds.redDays) return "red";
  if (daysInStage >= thresholds.yellowDays) return "yellow";
  return "fresh";
}

export function getRunningHealthStatus(
  housesLast12Months: number
): HealthStatus {
  return housesLast12Months < 10 ? "red" : "fresh";
}
