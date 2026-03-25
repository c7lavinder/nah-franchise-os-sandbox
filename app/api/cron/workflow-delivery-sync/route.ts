export const dynamic = "force-dynamic";

/**
 * POST /api/cron/workflow-delivery-sync
 *
 * Polls GHL for message delivery data and pipeline stage changes.
 * Replaces webhook-based tracking — uses PIT/OAuth API calls,
 * same approach as the inbox and pipeline features.
 *
 * Intended to run every 15 minutes via cron.
 *
 * Two jobs:
 * 1. syncDeliveryData — checks GHL conversations for delivery + response data
 * 2. syncStageEnrollments — checks pipeline stages for auto-enrollment triggers
 */

import { NextResponse } from "next/server";
import { syncDeliveryData, syncStageEnrollments } from "@/lib/workflows/delivery-sync";

export async function POST() {
  try {
    const startTime = Date.now();

    // Run both sync jobs
    const [deliveryResult, enrollmentResult] = await Promise.all([
      syncDeliveryData(),
      syncStageEnrollments(),
    ]);

    const durationMs = Date.now() - startTime;

    const summary = {
      delivery: {
        enrollmentsChecked: deliveryResult.enrollmentsChecked,
        messagesDelivered: deliveryResult.messagesDelivered,
        responsesDetected: deliveryResult.responsesDetected,
        errors: deliveryResult.errors.length,
      },
      enrollment: {
        enrolled: enrollmentResult.enrolled,
        errors: enrollmentResult.errors.length,
      },
      durationMs,
    };

    console.log(`[workflow-delivery-sync] ${JSON.stringify(summary)}`);

    return NextResponse.json({
      ...summary,
      deliveryErrors: deliveryResult.errors,
      enrollmentErrors: enrollmentResult.errors,
    });
  } catch (err) {
    console.error("[workflow-delivery-sync] Fatal error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
