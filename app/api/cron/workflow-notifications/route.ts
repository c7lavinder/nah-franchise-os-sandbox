export const dynamic = "force-dynamic";

/**
 * POST /api/cron/workflow-notifications
 *
 * Runs all workflow notification checks:
 * 1. Steps pending human confirmation
 * 2. Unhealthy workflows (D or F health scores)
 * 3. Stale enrollments (no step executed in 5+ days)
 *
 * Intended to run every 4 hours via cron.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  notifyStepsPendingConfirmation,
  notifyUnhealthyWorkflows,
  notifyStaleEnrollments,
} from "@/lib/workflows/notifications";

/** Default: flag enrollments with no activity for 5+ days */
const STALE_ENROLLMENT_DAYS = 5;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const [confirmationResult, healthResult, staleResult] = await Promise.all([
      notifyStepsPendingConfirmation(),
      notifyUnhealthyWorkflows(),
      notifyStaleEnrollments(STALE_ENROLLMENT_DAYS),
    ]);

    const totalCreated =
      confirmationResult.alertsCreated +
      healthResult.alertsCreated +
      staleResult.alertsCreated;

    const totalErrors =
      confirmationResult.errors + healthResult.errors + staleResult.errors;

    return NextResponse.json({
      totalAlertsCreated: totalCreated,
      totalErrors,
      breakdown: {
        confirmationAlerts: confirmationResult.alertsCreated,
        healthAlerts: healthResult.alertsCreated,
        staleEnrollmentAlerts: staleResult.alertsCreated,
      },
    });
  } catch (err) {
    console.error("Workflow notifications cron failed:", err);
    return NextResponse.json(
      { error: "Workflow notifications cron failed" },
      { status: 502 }
    );
  }
}
