export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSecret } from "@/lib/auth/webhook-verify";
import { createServerClient } from "@/lib/supabase/server";
import { normalizeAssignedSignalHouseNumber } from "@/lib/sms/number-assignment";
import { phoneLookupKey } from "@/lib/sms/phone";

type SignalHouseWebhookPayload = {
  messageId?: string;
  identifier?: string;
  event?: string;
  _id?: string;
  status?: string;
  timestamp?: string;
  direction?: string;
  messageType?: string;
  phoneNumber?: string;
  senderPhoneNumber?: string;
  recipientPhoneNumber?: string;
  messageBody?: string;
  segmentCount?: number;
  carrier?: string;
  metaData?: {
    Message?: Record<string, unknown>;
    [key: string]: unknown;
  };
  statusHistory?: unknown;
  [key: string]: unknown;
};

function stringValue(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function nestedMessage(payload: SignalHouseWebhookPayload) {
  return payload.metaData?.Message ?? {};
}

function normalizeDirection(payload: SignalHouseWebhookPayload) {
  const direction = stringValue(payload.direction, nestedMessage(payload).direction);
  if (direction?.toLowerCase() === "inbound") return "inbound";
  if (direction?.toLowerCase() === "outbound") return "outbound";
  return payload.event === "MESSAGE_RECEIVED" ? "inbound" : "outbound";
}

function providerMessageId(payload: SignalHouseWebhookPayload) {
  const message = nestedMessage(payload);
  return stringValue(payload._id, payload.messageId, payload.identifier, message._id, message.messageId, message.identifier);
}

function messageStatus(payload: SignalHouseWebhookPayload) {
  return stringValue(payload.status, nestedMessage(payload).status) ?? (payload.event === "MESSAGE_RECEIVED" ? "RECEIVED" : null);
}

function messageType(payload: SignalHouseWebhookPayload) {
  return stringValue(payload.messageType, nestedMessage(payload).messageType) ?? "SMS";
}

function senderNumber(payload: SignalHouseWebhookPayload) {
  const message = nestedMessage(payload);
  return stringValue(
    payload.senderPhoneNumber,
    message.senderPhoneNumber,
    message.fromNumber,
    message.from,
    message.sourcePhoneNumber
  );
}

function recipientNumber(payload: SignalHouseWebhookPayload) {
  const message = nestedMessage(payload);
  return stringValue(
    payload.recipientPhoneNumber,
    message.recipientPhoneNumber,
    message.toNumber,
    message.to,
    message.destinationPhoneNumber
  );
}

function ownedNumber(payload: SignalHouseWebhookPayload) {
  return stringValue(payload.phoneNumber, nestedMessage(payload).phoneNumber);
}

function messageBody(payload: SignalHouseWebhookPayload) {
  const message = nestedMessage(payload);
  return stringValue(payload.messageBody, message.messageBody, message.body, message.text, message.content) ?? null;
}

function inboundFromNumber(payload: SignalHouseWebhookPayload) {
  return senderNumber(payload) ?? recipientNumber(payload);
}

function outboundToNumber(payload: SignalHouseWebhookPayload) {
  return recipientNumber(payload);
}

function verifySignalHouseWebhookSecret(request: NextRequest) {
  const secret = process.env.SIGNALHOUSE_WEBHOOK_SECRET;
  if (!secret || process.env.NODE_ENV === "development") return verifyWebhookSecret(request);

  const headerSecret = request.headers.get("x-webhook-secret");
  const urlSecret = new URL(request.url).searchParams.get("secret");
  if (headerSecret === secret || urlSecret === secret) return null;

  return NextResponse.json({ error: "Invalid webhook secret" }, { status: 401 });
}

async function findContactId(payload: SignalHouseWebhookPayload) {
  const supabase = createServerClient();
  const direction = normalizeDirection(payload);
  const remoteNumber = direction === "inbound" ? inboundFromNumber(payload) : outboundToNumber(payload);
  const key = phoneLookupKey(remoteNumber);
  if (!key) return null;

  const { data } = await supabase
    .from("contacts")
    .select("id, ghl_contact_id")
    .eq("phone_normalized", key)
    .maybeSingle();

  return data ?? null;
}

export async function POST(request: NextRequest) {
  const webhookAuthError = verifySignalHouseWebhookSecret(request);
  if (webhookAuthError) return webhookAuthError;

  const payload = (await request.json()) as SignalHouseWebhookPayload;
  const supabase = createServerClient();
  const messageId = providerMessageId(payload);

  if (!messageId) {
    await supabase.from("integration_logs").insert({
      integration_name: "signalhouse",
      event_type: "webhook_missing_message_id",
      status: "failed",
      error_message: "SignalHouse webhook did not include _id, messageId, or identifier",
      payload_summary: JSON.stringify(payload).slice(0, 500),
    });
    return NextResponse.json({ error: "Missing message id" }, { status: 400 });
  }

  const contact = await findContactId(payload);
  const direction = normalizeDirection(payload);
  const fromNumber =
    direction === "inbound" ? inboundFromNumber(payload) : senderNumber(payload) ?? ownedNumber(payload);
  const toNumber = direction === "inbound" ? ownedNumber(payload) ?? recipientNumber(payload) : outboundToNumber(payload);
  const status = messageStatus(payload);
  const timestamp = payload.timestamp ?? new Date().toISOString();

  await supabase.from("sms_messages").upsert(
    {
      provider: "signalhouse",
      provider_message_id: messageId,
      contact_id: contact?.id ?? null,
      ghl_contact_id: contact?.ghl_contact_id ?? null,
      direction,
      message_type: messageType(payload),
      from_number: normalizeAssignedSignalHouseNumber(fromNumber),
      to_number: normalizeAssignedSignalHouseNumber(toNumber),
      body: messageBody(payload),
      status,
      segment_count: payload.segmentCount ?? (Number(nestedMessage(payload).segmentCount) || null),
      carrier: payload.carrier ?? stringValue(nestedMessage(payload).carrier) ?? null,
      raw_payload: payload,
      received_at: direction === "inbound" ? timestamp : null,
      delivered_at: status === "DELIVERED" ? timestamp : null,
      failed_at: status === "FAILED" ? timestamp : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "provider,provider_message_id" }
  );

  await supabase.from("integration_logs").insert({
    integration_name: "signalhouse",
    event_type: direction === "inbound" ? "message_received" : "message_status",
    status: "success",
    payload_summary: `SignalHouse ${direction} ${status ?? "event"} ${messageId} contact:${contact?.id ?? "unmatched"}`,
    related_contact_id: contact?.id ?? null,
  });

  return NextResponse.json({ received: true });
}
