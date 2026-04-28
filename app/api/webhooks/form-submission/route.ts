export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/form-submission
 *
 * Receives webhook events from form submissions.
 * Event: PFS form → logs sub-task + attaches file URL
 *
 * Expected body: { formType, contactId, fileUrl?, data? }
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSecret } from "@/lib/auth/webhook-verify";import { createServerClient } from "@/lib/supabase/server";

interface FormSubmissionWebhookPayload {
  formType: string;
  contactId: string;
  fileUrl?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

export async function POST(request: NextRequest) {
  const webhookAuthError = verifyWebhookSecret(request);
  if (webhookAuthError) return webhookAuthError;
  const body = await request.json() as FormSubmissionWebhookPayload;
  const supabase = createServerClient();

  // Log + process async
  processWebhook(body, supabase).catch(console.error);
  return NextResponse.json({ received: true });
}

async function processWebhook(body: FormSubmissionWebhookPayload, supabase: any) {
  try {
    const { formType, contactId, fileUrl, data } = body;

    const payloadSummary = `Form submitted for contact ${contactId} - Type: ${formType}${fileUrl ? ` - File attached` : ""}`;

    await supabase.from("integration_logs").insert({
      integration_name: "form-submission",
      event_type: "form_submitted",
      status: "success",
      payload_summary: payloadSummary,
      metadata: {
        contactId,
        formType,
        fileUrl: fileUrl || null,
        dataKeys: data ? Object.keys(data) : null,
      },
    });
  } catch (err) {
    await supabase.from("integration_logs").insert({
      integration_name: "form-submission",
      event_type: "error",
      status: "failed",
      error_message: err instanceof Error ? err.message : String(err),
      metadata: {
        body,
      },
    });
  }
}
