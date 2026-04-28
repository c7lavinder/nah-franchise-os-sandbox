export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/docusign
 *
 * Receives webhook events from DocuSign.
 * Event: Document signed → maps document name to sub-task
 *
 * Document name mappings:
 *   - NDA → "nda"
 *   - Franchise Agreement (FA) → "franchise_agreement"
 *   - FDD Item 23 (FDD) → "fdd_item_23"
 *   - Franchise Award Letter → "franchise_award_letter"
 *
 * Expected body: { documentName, contactId, signedAt }
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSecret } from "@/lib/auth/webhook-verify";import { createServerClient } from "@/lib/supabase/server";

interface DocusignWebhookPayload {
  documentName: string;
  contactId: string;
  signedAt: string;
  [key: string]: unknown;
}

const documentNameMap: Record<string, string> = {
  nda: "nda",
  "non-disclosure agreement": "nda",
  "franchise agreement": "franchise_agreement",
  fa: "franchise_agreement",
  "fdd item 23": "fdd_item_23",
  fdd: "fdd_item_23",
  "franchise award letter": "franchise_award_letter",
};

function mapDocumentToSubTask(documentName: string): string {
  const normalized = documentName.toLowerCase().trim();
  return documentNameMap[normalized] || documentName;
}

export async function POST(request: NextRequest) {
  const webhookAuthError = verifyWebhookSecret(request);
  if (webhookAuthError) return webhookAuthError;
  const body = await request.json() as DocusignWebhookPayload;
  const supabase = createServerClient();

  // Log + process async
  processWebhook(body, supabase).catch(console.error);
  return NextResponse.json({ received: true });
}

async function processWebhook(body: DocusignWebhookPayload, supabase: any) {
  try {
    const { documentName, contactId, signedAt } = body;

    // Map document name to sub-task
    const subTaskName = mapDocumentToSubTask(documentName);

    const payloadSummary = `Document signed for contact ${contactId} - Type: ${subTaskName}`;

    await supabase.from("integration_logs").insert({
      integration_name: "docusign",
      event_type: "document_signed",
      status: "success",
      payload_summary: payloadSummary,
      metadata: {
        contactId,
        documentName,
        subTaskName,
        signedAt,
      },
    });
  } catch (err) {
    await supabase.from("integration_logs").insert({
      integration_name: "docusign",
      event_type: "error",
      status: "failed",
      error_message: err instanceof Error ? err.message : String(err),
      metadata: {
        body,
      },
    });
  }
}
