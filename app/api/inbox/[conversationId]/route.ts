export const dynamic = "force-dynamic";

/**
 * GET /api/inbox/[conversationId]
 *
 * Returns messages for a specific conversation with pagination.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import * as ghl from "@/lib/ghl";
import { createServerClient } from "@/lib/supabase/server";
import { samePhone } from "@/lib/sms/number-ownership";
import { signalHouseEnabled } from "@/lib/sms/signalhouse-client";

type SmsMessageRow = {
  id: string;
  provider_message_id: string;
  contact_id: string | null;
  ghl_contact_id: string | null;
  owner_user_id: string | null;
  direction: string;
  message_type: string;
  from_number: string | null;
  to_number: string | null;
  body: string | null;
  status: string | null;
  sent_at: string | null;
  received_at: string | null;
  created_at: string;
  owner?: { full_name: string; signalhouse_phone_number: string | null } | null;
};

function localNumber(row: SmsMessageRow) {
  return row.direction === "inbound" ? row.to_number : row.from_number;
}

function messageTime(row: SmsMessageRow) {
  return row.received_at ?? row.sent_at ?? row.created_at;
}

function parseSignalHouseConversationId(conversationId: string) {
  if (conversationId.startsWith("sms:")) return { contactId: conversationId.slice(4), phone: null };
  if (conversationId.startsWith("smsphone:")) return { contactId: null, phone: conversationId.slice(9) };
  return null;
}

async function getSignalHouseMessages(request: NextRequest, conversationId: string) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const parsed = parseSignalHouseConversationId(conversationId);
  if (!parsed) return null;

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") ?? "50", 10);
  const isAdmin = user.role === "admin" || user.role === "leadership";
  const supabase = createServerClient();

  const { data: currentUser } = await supabase
    .from("users")
    .select("signalhouse_phone_number")
    .eq("id", user.id)
    .maybeSingle();
  const assignedNumber = currentUser?.signalhouse_phone_number ?? null;

  let query = supabase
    .from("sms_messages")
    .select(
      `
      id,
      provider_message_id,
      contact_id,
      ghl_contact_id,
      owner_user_id,
      direction,
      message_type,
      from_number,
      to_number,
      body,
      status,
      sent_at,
      received_at,
      created_at,
      owner:users(full_name, signalhouse_phone_number)
    `
    )
    .order("created_at", { ascending: false })
    .limit(Math.min(limit, 100));

  if (parsed.contactId) query = query.eq("contact_id", parsed.contactId);
  else if (parsed.phone) query = query.or(`from_number.ilike.%${parsed.phone},to_number.ilike.%${parsed.phone}`);

  const { data, error } = await query;
  if (error) throw error;

  const rows = ((data ?? []) as unknown as SmsMessageRow[]).filter((row) => {
    if (isAdmin) return true;
    if (row.owner_user_id) return row.owner_user_id === user.id;
    return samePhone(localNumber(row), assignedNumber);
  });

  const messages = rows
    .map((row) => ({
      id: row.provider_message_id || row.id,
      contactId: row.ghl_contact_id ?? row.contact_id ?? "",
      type: "SMS",
      direction: row.direction,
      body: row.body ?? "",
      dateAdded: messageTime(row),
      messageType: row.message_type,
      status: row.status ?? undefined,
      from: row.from_number ?? undefined,
      to: row.to_number ?? undefined,
      source: "signalhouse",
      senderName: row.direction === "outbound" ? (row.owner?.full_name ?? null) : null,
    }))
    .reverse();

  return NextResponse.json({ messages, nextPage: false, provider: "signalhouse" });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  if (signalHouseEnabled()) {
    const signalHouseResponse = await getSignalHouseMessages(request, conversationId);
    if (signalHouseResponse) return signalHouseResponse;
  }

  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);
    const lastMessageId = searchParams.get("cursor") ?? undefined;

    const result = await ghl.getConversationMessages(conversationId, {
      limit,
      lastMessageId,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("Conversation messages fetch failed:", err);
    return NextResponse.json({ error: "Failed to load messages" }, { status: 502 });
  }
}
