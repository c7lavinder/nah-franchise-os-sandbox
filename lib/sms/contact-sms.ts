import { createServerClient } from "@/lib/supabase/server";
import { resolveContactId } from "@/lib/contacts/pipeline-state";
import { normalizeAssignedSignalHouseNumber } from "@/lib/sms/number-assignment";
import { phoneLookupKey } from "@/lib/sms/phone";
import { sendSignalHouseSms, type SignalHouseMessage } from "@/lib/sms/signalhouse-client";
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

async function logSignalHouseMessage(contact: ContactRow, message: SignalHouseMessage, body: string, fromNumber?: string | null) {
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
