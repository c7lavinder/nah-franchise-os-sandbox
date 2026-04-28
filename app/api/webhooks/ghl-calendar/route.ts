export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/ghl-calendar
 *
 * Receives webhook events from GHL Calendar.
 * Event: Appointment created → maps appointment type to sub-task name
 *
 * Expected body: { appointmentId, contactId, calendarId, appointmentType, startTime }
 * Maps appointment types to sub-task names:
 *   - intro_call
 *   - matt_call
 *   - sam_call
 *   - mark_call
 *   - fdd_review_call
 *   - territory_call
 *   - matt_final_call
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSecret } from "@/lib/auth/webhook-verify";import { createServerClient } from "@/lib/supabase/server";

interface GHLCalendarWebhookPayload {
  appointmentId: string;
  contactId: string;
  calendarId: string;
  appointmentType: string;
  startTime: string;
  [key: string]: unknown;
}

const appointmentTypeMap: Record<string, string> = {
  intro_call: "intro_call",
  matt_call: "matt_call",
  sam_call: "sam_call",
  mark_call: "mark_call",
  fdd_review_call: "fdd_review_call",
  territory_call: "territory_call",
  matt_final_call: "matt_final_call",
};

export async function POST(request: NextRequest) {
  const webhookAuthError = verifyWebhookSecret(request);
  if (webhookAuthError) return webhookAuthError;
  const body = await request.json() as GHLCalendarWebhookPayload;
  const supabase = createServerClient();

  // Log + process async
  processWebhook(body, supabase).catch(console.error);
  return NextResponse.json({ received: true });
}

async function processWebhook(body: GHLCalendarWebhookPayload, supabase: any) {
  try {
    const { appointmentId, contactId, appointmentType, startTime } = body;

    // Map appointment type to sub-task name
    const subTaskName = appointmentTypeMap[appointmentType] || appointmentType;

    const payloadSummary = `Appointment ${appointmentId} created for contact ${contactId} - Type: ${subTaskName}`;

    await supabase.from("integration_logs").insert({
      integration_name: "ghl-calendar",
      event_type: "appointment_created",
      status: "success",
      payload_summary: payloadSummary,
      metadata: {
        appointmentId,
        contactId,
        subTaskName,
        startTime,
      },
    });
  } catch (err) {
    await supabase.from("integration_logs").insert({
      integration_name: "ghl-calendar",
      event_type: "error",
      status: "failed",
      error_message: err instanceof Error ? err.message : String(err),
      metadata: {
        body,
      },
    });
  }
}
