export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSecret } from "@/lib/auth/webhook-verify";
import { createServerClient } from "@/lib/supabase/server";
import { phoneLookupKey } from "@/lib/sms/phone";

type SignalHouseWebhookPayload = {
  messageId?: string;
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
  statusHistory?: unknown;
  [key: string]: unknown;
};

function normalizeDirection(value: string | undefined) {
  return value?.toLowerCase() === "inbound" ? "inbound" : "outbound";
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
  const direction = normalizeDirection(payload.direction);
  const remoteNumber = direction === "inbound" ? payload.senderPhoneNumber : payload.recipientPhoneNumber;
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
  const providerMessageId = payload._id ?? payload.messageId;

  if (!providerMessageId) {
    await supabase.from("integration_logs").insert({
      integration_name: "signalhouse",
      event_type: "webhook_missing_message_id",
      status: "failed",
      error_message: "SignalHouse webhook did not include _id or messageId",
      payload_summary: JSON.stringify(payload).slice(0, 500),
    });
    return NextResponse.json({ error: "Missing message id" }, { status: 400 });
  }

  const contact = await findContactId(payload);
  const direction = normalizeDirection(payload.direction);

  await supabase.from("sms_messages").upsert(
    {
      provider: "signalhouse",
      provider_message_id: providerMessageId,
      contact_id: contact?.id ?? null,
      ghl_contact_id: contact?.ghl_contact_id ?? null,
      direction,
      message_type: payload.messageType ?? "SMS",
      from_number: payload.senderPhoneNumber ?? payload.phoneNumber ?? null,
      to_number: payload.recipientPhoneNumber ?? null,
      body: payload.messageBody ?? null,
      status: payload.status ?? null,
      segment_count: payload.segmentCount ?? null,
      carrier: payload.carrier ?? null,
      raw_payload: payload,
      received_at: direction === "inbound" ? payload.timestamp ?? new Date().toISOString() : null,
      delivered_at: payload.status === "DELIVERED" ? payload.timestamp ?? new Date().toISOString() : null,
      failed_at: payload.status === "FAILED" ? payload.timestamp ?? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "provider,provider_message_id" }
  );

  await supabase.from("integration_logs").insert({
    integration_name: "signalhouse",
    event_type: direction === "inbound" ? "message_received" : "message_status",
    status: "success",
    payload_summary: `SignalHouse ${direction} ${payload.status ?? "event"} ${providerMessageId} contact:${contact?.id ?? "unmatched"}`,
    related_contact_id: contact?.id ?? null,
  });

  return NextResponse.json({ received: true });
}
