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
import { getAssignedSmsNumber, getConfiguredSmsNumbers, normalizeSmsNumber } from "@/lib/sms/number-assignment";
import { sendContactSmsViaSignalHouse, sendContactSmsViaVonage } from "@/lib/sms/contact-sms";
import { updateTouchFields } from "@/lib/ghl/touch-fields";
import { sendSignalHouseSms, signalHouseEnabled, type SignalHouseMessage } from "@/lib/sms/signalhouse-client";
import { sendVonageSms, vonageEnabled } from "@/lib/vonage/client";
import type { GHLMessage, GHLSendMessagePayload } from "@/types/ghl";

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
      from_number: normalizeSmsNumber(message.senderPhoneNumber ?? message.phoneNumber ?? fromNumber),
      to_number: normalizeSmsNumber(message.recipientPhoneNumber ?? toNumber),
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

/** Send an SMS to a raw number (no contact) via Vonage and log it. */
async function sendDirectVonageSms(toNumber: string, body: string, fromNumber: string): Promise<GHLMessage> {
  const result = await sendVonageSms({ to: toNumber, body, from: fromNumber });
  const supabase = createServerClient();
  await supabase.from("sms_messages").upsert(
    {
      provider: "vonage",
      provider_message_id: result.messageUuid,
      contact_id: null,
      ghl_contact_id: null,
      direction: "outbound",
      message_type: "SMS",
      from_number: normalizeSmsNumber(result.from),
      to_number: normalizeSmsNumber(result.to),
      body,
      status: result.status,
      raw_payload: result.raw as Record<string, unknown>,
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "provider,provider_message_id" }
  );
  return {
    id: result.messageUuid,
    contactId: toNumber,
    type: "SMS",
    direction: "outbound",
    body,
    dateAdded: new Date().toISOString(),
    status: result.status,
    from: normalizeSmsNumber(result.from) ?? undefined,
    to: normalizeSmsNumber(result.to) ?? undefined,
    source: "vonage",
  };
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
    if (body.type === "SMS" && (vonageEnabled() || signalHouseEnabled())) {
      const providerLabel = vonageEnabled() ? "Vonage" : "SignalHouse";
      const requestedFromNumber = normalizeSmsNumber(body.fromNumber);
      const configuredNumbers = getConfiguredSmsNumbers();
      const assignedNumber = await getAssignedSmsNumber(user.id);
      const fromNumber = requestedFromNumber ?? assignedNumber;
      if (!fromNumber) {
        return NextResponse.json(
          { error: `Choose a ${providerLabel} sending number before replying.`, success: false },
          { status: 409 }
        );
      }
      if (configuredNumbers.length > 0 && !configuredNumbers.includes(fromNumber)) {
        return NextResponse.json(
          { error: `That sending number is not configured for ${providerLabel}.`, success: false },
          { status: 403 }
        );
      }
      const text = body.message!.trim();
      if (body.contactId) {
        message = vonageEnabled()
          ? await sendContactSmsViaVonage(body.contactId, text, { fromNumber })
          : await sendContactSmsViaSignalHouse(body.contactId, text, { fromNumber });
      } else {
        const toNumber = normalizeSmsNumber(body.toNumber);
        if (!toNumber) {
          return NextResponse.json(
            { error: "A valid recipient phone number is required.", success: false },
            { status: 400 }
          );
        }
        if (vonageEnabled()) {
          message = await sendDirectVonageSms(toNumber, text, fromNumber);
        } else {
          const signalHouseMessage = await sendSignalHouseSms({ to: toNumber, body: text, from: fromNumber });
          await logDirectSignalHouseMessage(signalHouseMessage, text, toNumber, fromNumber);
          message = {
            id: signalHouseMessage._id,
            contactId: toNumber,
            type: "SMS",
            direction: "outbound",
            body: text,
            dateAdded: signalHouseMessage.createdAt ?? new Date().toISOString(),
            status: signalHouseMessage.status,
            from:
              normalizeSmsNumber(
                signalHouseMessage.senderPhoneNumber ?? signalHouseMessage.phoneNumber ?? fromNumber
              ) ?? undefined,
            to: normalizeSmsNumber(signalHouseMessage.recipientPhoneNumber ?? toNumber) ?? undefined,
            source: "signalhouse",
          };
        }
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
