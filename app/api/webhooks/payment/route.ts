export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/payment
 *
 * Receives webhook events from payment processors.
 * Event: Franchise fee payment → logs sub-task + comment about triggerTerritoryCreation
 * Note: triggerTerritoryCreation is not yet implemented
 *
 * Expected body: { paymentType, contactId, amount, transactionId }
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSecret } from "@/lib/auth/webhook-verify";import { createServerClient } from "@/lib/supabase/server";

interface PaymentWebhookPayload {
  paymentType: string;
  contactId: string;
  amount: number;
  transactionId: string;
  [key: string]: unknown;
}

export async function POST(request: NextRequest) {
  const webhookAuthError = verifyWebhookSecret(request);
  if (webhookAuthError) return webhookAuthError;
  const body = await request.json() as PaymentWebhookPayload;
  const supabase = createServerClient();

  // Log + process async
  processWebhook(body, supabase).catch(console.error);
  return NextResponse.json({ received: true });
}

async function processWebhook(body: PaymentWebhookPayload, supabase: any) {
  try {
    const { paymentType, contactId, amount, transactionId } = body;

    const payloadSummary = `Payment received for contact ${contactId} - Type: ${paymentType}, Amount: $${amount}, TransactionID: ${transactionId}`;

    await supabase.from("integration_logs").insert({
      integration_name: "payment",
      event_type: "payment_received",
      status: "success",
      payload_summary: payloadSummary,
      metadata: {
        contactId,
        paymentType,
        amount,
        transactionId,
        note: paymentType === "franchise_fee" ? "TODO: triggerTerritoryCreation not yet implemented" : null,
      },
    });
  } catch (err) {
    await supabase.from("integration_logs").insert({
      integration_name: "payment",
      event_type: "error",
      status: "failed",
      error_message: err instanceof Error ? err.message : String(err),
      metadata: {
        body,
      },
    });
  }
}
