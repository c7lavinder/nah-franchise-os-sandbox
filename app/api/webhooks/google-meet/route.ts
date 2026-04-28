export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/google-meet
 *
 * Receives webhook events from Google Meet.
 * Event: Meeting ends → queues transcript analysis job
 *
 * Expected body: { meetingId, contactId?, duration }
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSecret } from "@/lib/auth/webhook-verify";import { createServerClient } from "@/lib/supabase/server";

interface GoogleMeetWebhookPayload {
  meetingId: string;
  contactId?: string;
  duration?: number;
  [key: string]: unknown;
}

export async function POST(request: NextRequest) {
  const webhookAuthError = verifyWebhookSecret(request);
  if (webhookAuthError) return webhookAuthError;
  const body = await request.json() as GoogleMeetWebhookPayload;
  const supabase = createServerClient();

  // Log + process async
  processWebhook(body, supabase).catch(console.error);
  return NextResponse.json({ received: true });
}

async function processWebhook(body: GoogleMeetWebhookPayload, supabase: any) {
  try {
    const { meetingId, contactId, duration } = body;

    // Queue transcript analysis job (just log intent for now)
    const payloadSummary = `Meeting ${meetingId} ended${duration ? ` after ${duration}s` : ""}${contactId ? ` - Contact: ${contactId}` : ""}`;

    await supabase.from("integration_logs").insert({
      integration_name: "google-meet",
      event_type: "meeting_ended",
      status: "success",
      payload_summary: payloadSummary,
      metadata: {
        meetingId,
        contactId: contactId || null,
        duration: duration || null,
        jobStatus: "queued_for_transcript_analysis",
      },
    });
  } catch (err) {
    await supabase.from("integration_logs").insert({
      integration_name: "google-meet",
      event_type: "error",
      status: "failed",
      error_message: err instanceof Error ? err.message : String(err),
      metadata: {
        body,
      },
    });
  }
}
