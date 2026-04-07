export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/ghl/contacts
 *
 * Receives GHL contact webhook events (ContactCreate, ContactUpdate).
 * Syncs the contact to the local contacts table and auto-creates a
 * Sales Pipeline entry at Engagement stage for new contacts.
 *
 * Per §1.18 of MASTER_PLAN.md:
 * - New contact in GHL → webhook → contact mirrored → Sales Pipeline entry at Stage 1
 * - Fields: name, address, contact info, source, notes
 * - Outreach sub-task starts empty
 */

import { NextRequest, NextResponse } from "next/server";
import { syncContactFromGhl } from "@/lib/ghl/sync";
import { autoCreatePipelineState } from "@/lib/ghl/auto-create-pipeline-state";
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
  try {
    const payload = (await request.json()) as WebhookPayload;

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

    return NextResponse.json({
      received: true,
      contactId: localContactId,
      pipelineStateCreated: stateId !== null,
      pipelineStateId: stateId,
    });
  } catch (err) {
    console.error("GHL contacts webhook error:", err);
    return NextResponse.json(
      { error: "Internal webhook processing error" },
      { status: 500 }
    );
  }
}
