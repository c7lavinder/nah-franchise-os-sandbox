export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/ghl/contacts
 *
 * Canonical handler for GHL ContactCreate events.
 * End-to-end flow: form fill → GHL webhook → contact synced → pipeline state → alert → action log.
 *
 * Steps:
 * 1. Sync contact to local DB via syncContactFromGhl (upsert)
 * 2. Auto-create Sales Pipeline state at Stage 1 Engagement (idempotent)
 * 3. Create speed-to-lead alert in inactivity_alerts
 * 4. Log webhook_event in scout_action_logs
 *
 * Returns 200 on all paths to prevent GHL retries.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireGhlSignature } from "@/lib/auth/ghl-webhook-verify";
import { createServerClient } from "@/lib/supabase/server";
import { syncContactFromGhl } from "@/lib/ghl/sync";
import { autoCreatePipelineState } from "@/lib/ghl/auto-create-pipeline-state";
import { matchWorkflowTriggers } from "@/lib/workflows/trigger-matcher";
import type { GHLContactForSync } from "@/lib/ghl/sync";

interface WebhookPayload {
  type?: string;
  event?: string;
  id?: string;
  contactId?: string;
  contact_id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  /** GHL v2 sometimes sends additionalEmails on the webhook payload. */
  additionalEmails?: string[];
  phone?: string;
  address1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  source?: string;
  tags?: string[];
  dateAdded?: string;
  customFields?: Array<{ id: string; value: string }>;
  [key: string]: unknown;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const sigError = requireGhlSignature(rawBody, request.headers);
  if (sigError) return sigError;
  try {
    const payload = JSON.parse(rawBody) as WebhookPayload;

    // Sprint 2: extract contact ID — GHL sends it in various fields
    const ghlContactId = payload.id ?? payload.contactId ?? payload.contact_id;

    if (!ghlContactId) {
      return NextResponse.json({ error: "Missing contact ID in payload" }, { status: 400 });
    }

    // Validate we have at least a name or email
    const hasIdentity = payload.firstName || payload.lastName || payload.email;
    if (!hasIdentity) {
      return NextResponse.json({ error: "Contact must have at least a name or email" }, { status: 400 });
    }

    // Build the contact object for sync
    const ghlContact: GHLContactForSync = {
      id: ghlContactId,
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      additionalEmails: payload.additionalEmails,
      phone: payload.phone,
      address1: payload.address1,
      city: payload.city,
      state: payload.state,
      postalCode: payload.postalCode,
      source: payload.source,
      tags: payload.tags,
      dateAdded: payload.dateAdded,
      customFields: payload.customFields,
    };

    // Step 1: Sync contact to local DB
    const localContactId = await syncContactFromGhl(ghlContact);

    // Step 2: Auto-create Sales Pipeline state row (idempotent)
    const stateId = await autoCreatePipelineState(localContactId);

    // Step 3: Speed-to-lead alert + action log
    const supabase = createServerClient();
    const contactName = [payload.firstName, payload.lastName].filter(Boolean).join(" ").trim() || "Unknown";

    await Promise.all([
      supabase.from("inactivity_alerts").insert({
        alert_type: "speed_to_lead",
        severity: "critical",
        ghl_contact_id: ghlContactId,
        message: `New lead: ${contactName}${payload.source ? ` (${payload.source})` : ""}. Contact within 5 minutes.`,
        details: {
          contactName,
          source: payload.source ?? "Unknown",
          receivedAt: new Date().toISOString(),
        },
      }),
      supabase.from("scout_action_logs").insert({
        action_type: "webhook_event",
        action_status: "executed",
        ghl_contact_id: ghlContactId,
        draft_content: { event: "contact_create", payload: { contactName, source: payload.source } },
        final_content: { event: "contact_create" },
        executed_at: new Date().toISOString(),
      }),
    ]);

    // Flexible workflow trigger matching for contact.created events
    await matchWorkflowTriggers("contact.created", ghlContactId, payload as Record<string, unknown>);

    return NextResponse.json({
      received: true,
      contactId: localContactId,
      pipelineStateCreated: stateId !== null,
      pipelineStateId: stateId,
    });
  } catch (err) {
    // Return 200 to prevent GHL retries — log error without PII
    console.error("GHL contacts webhook error:", err instanceof Error ? err.message : "Unknown error");
    return NextResponse.json({ received: true, error: "handler_error" });
  }
}
