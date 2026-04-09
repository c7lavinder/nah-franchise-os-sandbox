export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/zorakle
 *
 * Receives webhook events from Zorakle.
 * Events:
 *   - assessment.sent → logs event
 *   - assessment.completed → DIRECT WRITE to contact_zorakle_data with computed fit_score and risk_flag
 *
 * Expected body: {
 *   event: "assessment.sent" | "assessment.completed",
 *   ghl_contact_id: string,
 *   eclipse_overall?: number,
 *   values_type?: string,
 *   work_style?: string,
 *   culture?: string,
 *   eclipse_drive_id?: string,
 *   spoton_drive_id?: string
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { computeFitScore, computeRiskFlag } from "@/lib/zorakle";

interface ZorakleWebhookPayload {
  event: "assessment.sent" | "assessment.completed";
  ghl_contact_id: string;
  eclipse_overall?: number;
  values_type?: string;
  work_style?: string;
  culture?: string;
  eclipse_drive_id?: string;
  spoton_drive_id?: string;
  [key: string]: unknown;
}

export async function POST(request: NextRequest) {
  const body = await request.json() as ZorakleWebhookPayload;
  const supabase = createServerClient();

  // Log + process async
  processWebhook(body, supabase).catch(console.error);
  return NextResponse.json({ received: true });
}

async function processWebhook(body: ZorakleWebhookPayload, supabase: any) {
  try {
    const { event, ghl_contact_id, eclipse_overall, values_type, work_style } = body;

    if (event === "assessment.sent") {
      // Log assessment sent event
      await supabase.from("integration_logs").insert({
        integration_name: "zorakle",
        event_type: "assessment_sent",
        status: "success",
        payload_summary: `Assessment sent to contact ${ghl_contact_id}`,
        metadata: {
          ghl_contact_id,
        },
      });
    } else if (event === "assessment.completed") {
      // Compute fit score and risk flag
      const fitScore = computeFitScore({
        eclipse_overall: eclipse_overall ?? null,
        values_type: values_type ?? null,
        work_style: work_style ?? null,
      });

      const riskFlag = computeRiskFlag({
        eclipse_overall: eclipse_overall ?? null,
        values_type: values_type ?? null,
        work_style: work_style ?? null,
      });

      // DIRECT WRITE to contact_zorakle_data
      const { error: writeError } = await supabase
        .from("contact_zorakle_data")
        .upsert(
          {
            ghl_contact_id,
            eclipse_overall: eclipse_overall ?? null,
            values_type: values_type ?? null,
            work_style: work_style ?? null,
            culture: (body as Record<string, unknown>)["culture"] ?? null,
            eclipse_drive_id: (body as Record<string, unknown>)["eclipse_drive_id"] ?? null,
            spoton_drive_id: (body as Record<string, unknown>)["spoton_drive_id"] ?? null,
            fit_score: fitScore,
            risk_flag: riskFlag,
          },
          { onConflict: "ghl_contact_id" }
        );

      if (writeError) {
        throw new Error(`Failed to write contact_zorakle_data: ${writeError.message}`);
      }

      // Log the completion
      await supabase.from("integration_logs").insert({
        integration_name: "zorakle",
        event_type: "assessment_completed",
        status: "success",
        payload_summary: `Assessment completed for contact ${ghl_contact_id} - Fit: ${fitScore}, Risk: ${riskFlag}`,
        metadata: {
          ghl_contact_id,
          fitScore,
          riskFlag,
          eclipse_overall: eclipse_overall ?? null,
          values_type: values_type ?? null,
          work_style: work_style ?? null,
        },
      });
    }
  } catch (err) {
    await supabase.from("integration_logs").insert({
      integration_name: "zorakle",
      event_type: "error",
      status: "failed",
      error_message: err instanceof Error ? err.message : String(err),
      metadata: {
        body,
      },
    });
  }
}
