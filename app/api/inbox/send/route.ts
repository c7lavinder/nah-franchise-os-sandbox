export const dynamic = "force-dynamic";

/**
 * POST /api/inbox/send
 *
 * Sends an SMS or email reply through GHL.
 * Also updates the contact's Last Touch Date and Last Touch Channel
 * custom fields for engagement tracking.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import * as ghl from "@/lib/ghl";
import { customerFacingSendsDisabledReason, customerFacingSendsEnabled } from "@/lib/ghl/action-safety";
import { createServerClient } from "@/lib/supabase/server";
import {
  getAssignedSignalHouseNumber,
  getConfiguredSignalHouseNumbers,
  normalizeAssignedSignalHouseNumber,
} from "@/lib/sms/number-assignment";
import { sendContactSmsViaSignalHouse } from "@/lib/sms/contact-sms";
import { sendSignalHouseSms, signalHouseEnabled, type SignalHouseMessage } from "@/lib/sms/signalhouse-client";
import type { GHLSendMessagePayload } from "@/types/ghl";

interface SendRequest {
  type: "SMS" | "Email";
  contactId?: string | null;
  toNumber?: string;
  fromNumber?: string;
  message?: string;
  subject?: string;
  html?: string;
  emailFrom?: string;
  confirmed?: boolean;
}

async function logDirectSignalHouseMessage(
  message: SignalHouseMessage,
  body: string,
  toNumber: string,
  fromNumber: string
) {
  const supabase = createServerClient();
  await supabase.from("sms_messages").upsert(
    {
      provider: "signalhouse",
      provider_message_id: message._id,
      contact_id: null,
      ghl_contact_id: null,
      direction: "outbound",
      message_type: message.messageType ?? "SMS",
      from_number: normalizeAssignedSignalHouseNumber(message.senderPhoneNumber ?? message.phoneNumber ?? fromNumber),
      to_number: normalizeAssignedSignalHouseNumber(message.recipientPhoneNumber ?? toNumber),
      body,
      status: message.status ?? "ENQUEUED",
      segment_count: message.segmentCount ?? null,
      raw_payload: message,
      sent_at: message.createdAt ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "provider,provider_message_id" }
  );
}

/** Update engagement tracking fields after sending a message */
async function updateTouchFields(contactId: string, channel: "SMS" | "Email") {
  try {
    const supabase = createServerClient();
    const { data: mappings } = await supabase
      .from("ghl_custom_fields")
      .select("field_name, ghl_field_id")
      .eq("entity_type", "contact")
      .in("field_name", ["Last Touch Date", "Last Touch Channel", "Contact Attempt Count"]);

    if (!mappings || mappings.length === 0) return;

    // Get current attempt count to increment
    let currentCount = 0;
    const attemptFieldId = mappings.find((m) => m.field_name === "Contact Attempt Count")?.ghl_field_id;
    if (attemptFieldId) {
      try {
        const contact = await ghl.getContact(contactId);
        const attemptField = contact.customFields.find((f) => f.id === attemptFieldId);
        if (attemptField?.value) {
          currentCount = parseInt(attemptField.value) || 0;
        }
      } catch {
        // Continue with 0
      }
    }

    const customFields: { id: string; value: string }[] = [];
    for (const m of mappings) {
      if (m.field_name === "Last Touch Date") {
        customFields.push({ id: m.ghl_field_id, value: new Date().toISOString() });
      }
      if (m.field_name === "Last Touch Channel") {
        customFields.push({ id: m.ghl_field_id, value: channel });
      }
      if (m.field_name === "Contact Attempt Count") {
        customFields.push({ id: m.ghl_field_id, value: String(currentCount + 1) });
      }
    }

    if (customFields.length > 0) {
      await ghl.updateContact(contactId, { customFields });
    }

    // Auto-resolve stale lead alerts for this contact
    await supabase
      .from("inactivity_alerts")
      .update({ is_resolved: true, resolved_at: new Date().toISOString() })
      .eq("ghl_contact_id", contactId)
      .eq("is_resolved", false)
      .in("alert_type", ["stale_active", "stale_active_high", "stale_followup", "stale_reengaged", "speed_to_lead"]);
  } catch {
    // Non-critical — don't fail the send if touch tracking fails
    console.warn("Failed to update touch fields for", contactId);
  }
}

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  try {
    const body = (await request.json()) as SendRequest;

    if (!body.type) {
      return NextResponse.json({ error: "type is required" }, { status: 400 });
    }

    if (body.confirmed !== true) {
      return NextResponse.json(
        { error: "Customer-facing sends require explicit human confirmation.", success: false },
        { status: 409 }
      );
    }

    if (!customerFacingSendsEnabled()) {
      return NextResponse.json({ error: customerFacingSendsDisabledReason(), success: false }, { status: 409 });
    }

    let payload: GHLSendMessagePayload;

    if (body.type === "SMS") {
      if (!body.message?.trim()) {
        return NextResponse.json({ error: "Message text is required for SMS" }, { status: 400 });
      }
      if (!body.contactId && !body.toNumber) {
        return NextResponse.json({ error: "A contact or phone number is required for SMS" }, { status: 400 });
      }
      payload = {
        type: "SMS",
        contactId: body.contactId ?? "",
        message: body.message.trim(),
      };
    } else {
      if (!body.contactId) {
        return NextResponse.json({ error: "contactId is required for email" }, { status: 400 });
      }
      if (!body.html?.trim() || !body.subject?.trim()) {
        return NextResponse.json({ error: "Subject and body are required for email" }, { status: 400 });
      }
      payload = {
        type: "Email",
        contactId: body.contactId,
        html: body.html.trim(),
        subject: body.subject.trim(),
        emailFrom: body.emailFrom ?? "chad@newagainhouses.com",
      };
    }

    let message;
    if (body.type === "SMS" && signalHouseEnabled()) {
      const requestedFromNumber = normalizeAssignedSignalHouseNumber(body.fromNumber);
      const configuredNumbers = getConfiguredSignalHouseNumbers();
      const assignedNumber = await getAssignedSignalHouseNumber(user.id);
      const fromNumber = requestedFromNumber ?? assignedNumber;
      if (!fromNumber) {
        return NextResponse.json(
          { error: "Choose a SignalHouse sending number before replying.", success: false },
          { status: 409 }
        );
      }
      if (configuredNumbers.length > 0 && !configuredNumbers.includes(fromNumber)) {
        return NextResponse.json(
          { error: "That sending number is not configured for SignalHouse.", success: false },
          { status: 403 }
        );
      }
      if (body.contactId) {
        message = await sendContactSmsViaSignalHouse(body.contactId, body.message!.trim(), { fromNumber });
      } else {
        const toNumber = normalizeAssignedSignalHouseNumber(body.toNumber);
        if (!toNumber) {
          return NextResponse.json(
            { error: "A valid recipient phone number is required.", success: false },
            { status: 400 }
          );
        }
        const signalHouseMessage = await sendSignalHouseSms({
          to: toNumber,
          body: body.message!.trim(),
          from: fromNumber,
        });
        await logDirectSignalHouseMessage(signalHouseMessage, body.message!.trim(), toNumber, fromNumber);
        message = {
          id: signalHouseMessage._id,
          contactId: toNumber,
          type: "SMS",
          direction: "outbound",
          body: body.message!.trim(),
          dateAdded: signalHouseMessage.createdAt ?? new Date().toISOString(),
          status: signalHouseMessage.status,
          from:
            normalizeAssignedSignalHouseNumber(
              signalHouseMessage.senderPhoneNumber ?? signalHouseMessage.phoneNumber ?? fromNumber
            ) ?? undefined,
          to: normalizeAssignedSignalHouseNumber(signalHouseMessage.recipientPhoneNumber ?? toNumber) ?? undefined,
          source: "signalhouse",
        };
      }
    } else {
      message = await ghl.sendMessage(payload);
    }

    // Update touch tracking in background (don't block the response)
    if (body.contactId) void updateTouchFields(body.contactId, body.type);

    return NextResponse.json({ message });
  } catch (err) {
    console.error("Send message failed:", err);
    const msg = err instanceof Error ? err.message : "Failed to send message";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
