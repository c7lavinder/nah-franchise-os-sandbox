/**
 * Accountability Engine — background job definitions.
 *
 * Each function checks a specific pipeline rule against GHL data
 * and creates alerts in the inactivity_alerts table when violations are found.
 *
 * These are designed to be called by a cron scheduler (node-cron, Railway cron,
 * or a Next.js API route triggered on a schedule).
 */

import * as ghl from "@/lib/ghl";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Find a pipeline stage by matching against known name variants.
 * Handles mismatch between internal names and actual GHL stage names.
 * Per docs/pipeline.md GHL Stage Name Mapping table.
 */
function findStage(
  stages: { id: string; name: string }[],
  ...keywords: string[]
): { id: string; name: string } | undefined {
  const lower = keywords.map((k) => k.toLowerCase());
  return stages.find((s) => {
    const name = s.name.toLowerCase();
    return lower.some((k) => name.includes(k));
  });
}

/** Creates an alert in the database */
async function createAlert(params: {
  alertType: string;
  severity: "low" | "medium" | "high" | "critical";
  userId?: string;
  ghlContactId?: string;
  pipelineStage?: string;
  message: string;
  details?: Record<string, unknown>;
}) {
  const supabase = createServerClient();
  await supabase.from("inactivity_alerts").insert({
    alert_type: params.alertType,
    severity: params.severity,
    user_id: params.userId ?? null,
    ghl_contact_id: params.ghlContactId ?? null,
    pipeline_stage: params.pipelineStage ?? null,
    message: params.message,
    details: params.details ?? null,
    is_resolved: false,
  });
}

/**
 * Speed-to-Lead Monitor — runs every 1 minute.
 * Checks if new leads have been contacted within 5 minutes.
 */
export async function checkSpeedToLead(): Promise<number> {
  let alertCount = 0;
  try {
    const pipelines = await ghl.getPipelines();
    if (pipelines.length === 0) return 0;

    // Find "New Lead" stage (matches both "New Lead" and any variant)
    const pipeline = pipelines[0];
    const newLeadStage = findStage(pipeline.stages, "new lead");
    if (!newLeadStage) return 0;

    const opportunities = await ghl.searchOpportunities({
      pipelineId: pipeline.id,
      stageId: newLeadStage.id,
      status: "open",
    });

    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

    for (const opp of opportunities) {
      const createdAt = new Date(opp.createdAt);
      if (createdAt < fiveMinAgo) {
        await createAlert({
          alertType: "speed_to_lead",
          severity: "critical",
          userId: opp.assignedTo ?? undefined,
          ghlContactId: opp.contactId,
          pipelineStage: "New Lead",
          message: `Speed-to-lead: ${opp.name} has been in New Lead for over 5 minutes without contact.`,
          details: { opportunityId: opp.id, minutesElapsed: Math.round((Date.now() - createdAt.getTime()) / 60000) },
        });
        alertCount++;
      }
    }
  } catch (err) {
    console.error("Speed-to-lead check failed:", err);
  }
  return alertCount;
}

/**
 * Stale Lead Check — runs every 15 minutes.
 * Flags leads in New Lead stage for 1+ hour.
 */
export async function checkStaleLeads(): Promise<number> {
  let alertCount = 0;
  try {
    const pipelines = await ghl.getPipelines();
    if (pipelines.length === 0) return 0;

    const pipeline = pipelines[0];
    const newLeadStage = findStage(pipeline.stages, "new lead");
    if (!newLeadStage) return 0;

    const opportunities = await ghl.searchOpportunities({
      pipelineId: pipeline.id,
      stageId: newLeadStage.id,
      status: "open",
    });

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    for (const opp of opportunities) {
      if (new Date(opp.createdAt) < oneHourAgo) {
        await createAlert({
          alertType: "stale_lead",
          severity: "high",
          userId: opp.assignedTo ?? undefined,
          ghlContactId: opp.contactId,
          pipelineStage: "New Lead",
          message: `Stale lead: ${opp.name} has been in New Lead for over 1 hour.`,
        });
        alertCount++;
      }
    }
  } catch (err) {
    console.error("Stale lead check failed:", err);
  }
  return alertCount;
}

/**
 * Validation Staleness Check — runs every 4 hours.
 * Flags leads in Validation/Due Diligence for 10+ days with no activity.
 */
export async function checkValidationStaleness(): Promise<number> {
  let alertCount = 0;
  try {
    const pipelines = await ghl.getPipelines();
    if (pipelines.length === 0) return 0;

    const pipeline = pipelines[0];
    const validationStage = findStage(pipeline.stages, "validation", "sam call");
    if (!validationStage) return 0;

    const opportunities = await ghl.searchOpportunities({
      pipelineId: pipeline.id,
      stageId: validationStage.id,
      status: "open",
    });

    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

    for (const opp of opportunities) {
      if (new Date(opp.updatedAt) < tenDaysAgo) {
        await createAlert({
          alertType: "validation_stale",
          severity: "high",
          userId: opp.assignedTo ?? undefined,
          ghlContactId: opp.contactId,
          pipelineStage: "Validation/Due Diligence",
          message: `Validation stale: ${opp.name} has been in Validation for 10+ days with no activity.`,
        });
        alertCount++;
      }
    }
  } catch (err) {
    console.error("Validation staleness check failed:", err);
  }
  return alertCount;
}

/**
 * Closing Stall Detector — runs every 2 hours.
 * Flags leads in In Closing with no activity for 3+ days.
 */
export async function checkClosingStall(): Promise<number> {
  let alertCount = 0;
  try {
    const pipelines = await ghl.getPipelines();
    if (pipelines.length === 0) return 0;

    const pipeline = pipelines[0];
    const closingStage = findStage(pipeline.stages, "closing", "award", "matt final", "documents submitted");
    if (!closingStage) return 0;

    const opportunities = await ghl.searchOpportunities({
      pipelineId: pipeline.id,
      stageId: closingStage.id,
      status: "open",
    });

    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    for (const opp of opportunities) {
      if (new Date(opp.updatedAt) < threeDaysAgo) {
        await createAlert({
          alertType: "closing_stall",
          severity: "critical",
          userId: opp.assignedTo ?? undefined,
          ghlContactId: opp.contactId,
          pipelineStage: "In Closing",
          message: `Closing stall: ${opp.name} has had no activity in In Closing for 3+ days.`,
        });
        alertCount++;
      }
    }
  } catch (err) {
    console.error("Closing stall check failed:", err);
  }
  return alertCount;
}

/**
 * FDD Window Tracker — runs every 1 hour.
 * Tracks leads in FDD Sent stage and flags when the 14-day window is complete.
 */
export async function checkFDDWindow(): Promise<number> {
  let alertCount = 0;
  try {
    const pipelines = await ghl.getPipelines();
    if (pipelines.length === 0) return 0;

    const pipeline = pipelines[0];
    const fddStage = findStage(pipeline.stages, "fdd", "signed fdd");
    if (!fddStage) return 0;

    const opportunities = await ghl.searchOpportunities({
      pipelineId: pipeline.id,
      stageId: fddStage.id,
      status: "open",
    });

    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const sevenDaysIn = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    for (const opp of opportunities) {
      const enteredAt = new Date(opp.updatedAt);

      if (enteredAt < fourteenDaysAgo) {
        // 14-day window complete — eligible to close
        await createAlert({
          alertType: "fdd_window",
          severity: "medium",
          userId: opp.assignedTo ?? undefined,
          ghlContactId: opp.contactId,
          pipelineStage: "FDD Sent",
          message: `FDD window complete: ${opp.name} is now eligible to move to In Closing.`,
        });
        alertCount++;
      } else if (enteredAt < sevenDaysIn) {
        // Mid-window check — engagement reminder
        await createAlert({
          alertType: "fdd_window",
          severity: "low",
          userId: opp.assignedTo ?? undefined,
          ghlContactId: opp.contactId,
          pipelineStage: "FDD Sent",
          message: `FDD check-in: ${opp.name} is at the midpoint of their FDD review. Schedule a check-in.`,
        });
        alertCount++;
      }
    }
  } catch (err) {
    console.error("FDD window check failed:", err);
  }
  return alertCount;
}

/**
 * Run all accountability checks.
 * Returns total number of alerts generated.
 */
export async function runAllChecks(): Promise<{ total: number; results: Record<string, number> }> {
  const results: Record<string, number> = {};

  results.speedToLead = await checkSpeedToLead();
  results.staleLeads = await checkStaleLeads();
  results.validationStaleness = await checkValidationStaleness();
  results.closingStall = await checkClosingStall();
  results.fddWindow = await checkFDDWindow();

  const total = Object.values(results).reduce((sum, n) => sum + n, 0);
  return { total, results };
}
