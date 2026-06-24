import { createServerClient } from "@/lib/supabase/server";
import { resolveContactId } from "@/lib/contacts/pipeline-state";
import { normalizeAssignedSignalHouseNumber } from "@/lib/sms/number-assignment";
import { phoneLookupKey } from "@/lib/sms/phone";
import { sendSignalHouseSms, signalHouseEnabled, type SignalHouseMessage } from "@/lib/sms/signalhouse-client";
import { sendVonageSms, vonageEnabled, type VonageSendResult } from "@/lib/vonage/client";
import { sendMessage as ghlSendMessage } from "@/lib/ghl/client";
import type { GHLMessage } from "@/types/ghl";

type ContactRow = {
  id: string;
  ghl_contact_id: string | null;
  phone: string | null;
  phone_normalized: string | null;
};

async function findContactForSms(contactId: string): Promise<ContactRow | null> {
  const localId = await resolveContactId(contactId);
  if (!localId) return null;

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("id, ghl_contact_id, phone, phone_normalized")
    .eq("id", localId)
    .maybeSingle();

  if (error) throw error;
  return (data as ContactRow | null) ?? null;
}

interface SendContactSmsOptions {
  fromNumber?: string | null;
}

async function logSignalHouseMessage(
  contact: ContactRow,
  message: SignalHouseMessage,
  body: string,
  fromNumber?: string | null
) {
  const supabase = createServerClient();
  await supabase.from("sms_messages").upsert(
    {
      provider: "signalhouse",
      provider_message_id: message._id,
      contact_id: contact.id,
      ghl_contact_id: contact.ghl_contact_id,
      direction: "outbound",
      message_type: message.messageType ?? "SMS",
      from_number: normalizeAssignedSignalHouseNumber(message.senderPhoneNumber ?? message.phoneNumber ?? fromNumber),
      to_number: normalizeAssignedSignalHouseNumber(message.recipientPhoneNumber),
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

/**
 * Send an SMS to a contact through whichever provider is active.
 * Vonage → SignalHouse → GHL fallback. Use this everywhere instead of branching
 * on signalHouseEnabled() at each call site, so adding/swapping providers is
 * a one-place change.
 */
export async function sendContactSmsViaActiveProvider(
  contactId: string,
  body: string,
  options: SendContactSmsOptions = {}
): Promise<GHLMessage> {
  if (vonageEnabled()) return sendContactSmsViaVonage(contactId, body, options);
  if (signalHouseEnabled()) return sendContactSmsViaSignalHouse(contactId, body, options);
  return ghlSendMessage({ type: "SMS", contactId, message: body });
}

async function logVonageMessage(contact: ContactRow, message: VonageSendResult, body: string) {
  const supabase = createServerClient();
  await supabase.from("sms_messages").upsert(
    {
      provider: "vonage",
      provider_message_id: message.messageUuid,
      contact_id: contact.id,
      ghl_contact_id: contact.ghl_contact_id,
      direction: "outbound",
      message_type: "SMS",
      from_number: normalizeAssignedSignalHouseNumber(message.from),
      to_number: normalizeAssignedSignalHouseNumber(message.to),
      body,
      status: message.status,
      raw_payload: message.raw as Record<string, unknown>,
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "provider,provider_message_id" }
  );
}

export async function sendContactSmsViaVonage(
  contactId: string,
  body: string,
  options: SendContactSmsOptions = {}
): Promise<GHLMessage> {
  const contact = await findContactForSms(contactId);
  if (!contact?.phone) {
    throw new Error("Contact does not have a phone number for Vonage SMS.");
  }

  const from = normalizeAssignedSignalHouseNumber(options.fromNumber);
  const message = await sendVonageSms({ to: contact.phone, body, from: from ?? undefined });
  await logVonageMessage(contact, message, body);

  return {
    id: message.messageUuid,
    contactId,
    type: "SMS",
    direction: "outbound",
    body,
    dateAdded: new Date().toISOString(),
    status: message.status,
    from: normalizeAssignedSignalHouseNumber(message.from) ?? undefined,
    to: normalizeAssignedSignalHouseNumber(message.to) ?? phoneLookupKey(contact.phone),
    source: "vonage",
  };
}

export async function sendContactSmsViaSignalHouse(
  contactId: string,
  body: string,
  options: SendContactSmsOptions = {}
): Promise<GHLMessage> {
  const contact = await findContactForSms(contactId);
  if (!contact?.phone) {
    throw new Error("Contact does not have a phone number for SignalHouse SMS.");
  }

  const from = normalizeAssignedSignalHouseNumber(options.fromNumber);
  const message = await sendSignalHouseSms({ to: contact.phone, body, from: from ?? undefined });
  await logSignalHouseMessage(contact, message, body, from);

  return {
    id: message._id,
    contactId,
    type: "SMS",
    direction: "outbound",
    body,
    dateAdded: message.createdAt ?? new Date().toISOString(),
    status: message.status,
    from: normalizeAssignedSignalHouseNumber(message.senderPhoneNumber ?? message.phoneNumber ?? from) ?? undefined,
    to: normalizeAssignedSignalHouseNumber(message.recipientPhoneNumber) ?? phoneLookupKey(contact.phone),
    source: "signalhouse",
  };
}
