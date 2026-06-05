import { createServerClient } from "@/lib/supabase/server";
import { resolveContactId } from "@/lib/contacts/pipeline-state";
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

async function logSignalHouseMessage(contact: ContactRow, message: SignalHouseMessage, body: string) {
  const supabase = createServerClient();
  await supabase.from("sms_messages").upsert(
    {
      provider: "signalhouse",
      provider_message_id: message._id,
      contact_id: contact.id,
      ghl_contact_id: contact.ghl_contact_id,
      direction: "outbound",
      message_type: message.messageType ?? "SMS",
      from_number: message.senderPhoneNumber ?? message.phoneNumber ?? null,
      to_number: message.recipientPhoneNumber ?? null,
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

export async function sendContactSmsViaSignalHouse(contactId: string, body: string): Promise<GHLMessage> {
  const contact = await findContactForSms(contactId);
  if (!contact?.phone) {
    throw new Error("Contact does not have a phone number for SignalHouse SMS.");
  }

  const message = await sendSignalHouseSms({ to: contact.phone, body });
  await logSignalHouseMessage(contact, message, body);

  return {
    id: message._id,
    contactId,
    type: "SMS",
    direction: "outbound",
    body,
    dateAdded: message.createdAt ?? new Date().toISOString(),
    status: message.status,
    from: message.senderPhoneNumber ?? message.phoneNumber,
    to: message.recipientPhoneNumber ?? phoneLookupKey(contact.phone),
    source: "signalhouse",
  };
}
