export const dynamic = "force-dynamic";

/**
 * GET /api/inbox
 *
 * Returns paginated conversation list for the inbox view.
 * Filters out conversations that only have system activity (no real messages).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import * as ghl from "@/lib/ghl";
import { createServerClient } from "@/lib/supabase/server";
import { phoneLookupKey } from "@/lib/sms/phone";
import { samePhone } from "@/lib/sms/number-ownership";
import { signalHouseEnabled } from "@/lib/sms/signalhouse-client";

/** Message types that represent real communication */
const REAL_MESSAGE_TYPES = new Set([
  "TYPE_SMS",
  "TYPE_EMAIL",
  "TYPE_CALL",
  "TYPE_VOICEMAIL",
  "TYPE_WHATSAPP",
  "TYPE_FB",
  "TYPE_IG",
  "TYPE_LIVE_CHAT",
]);

type SmsMessageRow = {
  id: string;
  contact_id: string | null;
  ghl_contact_id: string | null;
  owner_user_id: string | null;
  direction: string;
  from_number: string | null;
  to_number: string | null;
  body: string | null;
  status: string | null;
  read_at: string | null;
  sent_at: string | null;
  received_at: string | null;
  created_at: string;
  updated_at: string;
  contact?: {
    id: string;
    ghl_contact_id: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    email: string | null;
  } | null;
  owner?: {
    id: string;
    full_name: string;
    signalhouse_phone_number: string | null;
  } | null;
};

function messageLocalNumber(row: SmsMessageRow) {
  return row.direction === "inbound" ? row.to_number : row.from_number;
}

function messageRemoteNumber(row: SmsMessageRow) {
  return row.direction === "inbound" ? row.from_number : row.to_number;
}

function messageTime(row: SmsMessageRow) {
  return row.received_at ?? row.sent_at ?? row.created_at;
}

async function getSignalHouseConversations(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") ?? "50", 10);
  const unreadOnly = searchParams.get("unread") === "true";
  const isAdmin = user.role === "admin" || user.role === "leadership";
  const supabase = createServerClient();

  const { data: currentUser } = await supabase
    .from("users")
    .select("id, signalhouse_phone_number")
    .eq("id", user.id)
    .maybeSingle();
  const assignedNumber = currentUser?.signalhouse_phone_number ?? null;

  if (!isAdmin && !assignedNumber) {
    return NextResponse.json({ conversations: [], assignedNumber: null, provider: "signalhouse" });
  }

  const { data, error } = await supabase
    .from("sms_messages")
    .select(
      `
      id,
      contact_id,
      ghl_contact_id,
      owner_user_id,
      direction,
      from_number,
      to_number,
      body,
      status,
      read_at,
      sent_at,
      received_at,
      created_at,
      updated_at,
      contact:contacts(id, ghl_contact_id, first_name, last_name, phone, email),
      owner:users(id, full_name, signalhouse_phone_number)
    `
    )
    .order("created_at", { ascending: false })
    .limit(Math.min(limit * 10, 500));

  if (error) throw error;

  const visibleRows = ((data ?? []) as unknown as SmsMessageRow[]).filter((row) => {
    if (isAdmin) return true;
    if (row.owner_user_id) return row.owner_user_id === user.id;
    return samePhone(messageLocalNumber(row), assignedNumber);
  });

  const grouped = new Map<string, { latest: SmsMessageRow; rows: SmsMessageRow[] }>();
  for (const row of visibleRows) {
    if (unreadOnly && !(row.direction === "inbound" && !row.read_at)) continue;
    const key = row.contact_id ?? row.ghl_contact_id ?? phoneLookupKey(messageRemoteNumber(row)) ?? row.id;
    const existing = grouped.get(key);
    if (!existing) grouped.set(key, { latest: row, rows: [row] });
    else existing.rows.push(row);
  }

  const conversations = [...grouped.entries()]
    .map(([key, group]) => {
      const row = group.latest;
      const contact = row.contact;
      const contactName =
        [contact?.first_name, contact?.last_name].filter(Boolean).join(" ").trim() ||
        messageRemoteNumber(row) ||
        "Unknown";
      const unreadCount = group.rows.filter((msg) => msg.direction === "inbound" && !msg.read_at).length;

      return {
        id: row.contact_id ? `sms:${row.contact_id}` : `smsphone:${phoneLookupKey(messageRemoteNumber(row)) ?? key}`,
        contactId: contact?.ghl_contact_id ?? row.ghl_contact_id ?? row.contact_id ?? "",
        locationId: "signalhouse",
        lastMessageDate: messageTime(row),
        type: "TYPE_SMS",
        unreadCount,
        contactName,
        fullName: contactName,
        email: contact?.email ?? null,
        phone: contact?.phone ?? messageRemoteNumber(row),
        lastMessageType: "TYPE_SMS",
        lastMessageBody: row.body ?? "",
        lastMessageDirection: row.direction,
        assignedTo: row.owner?.full_name ?? null,
        assignedNumber: row.owner?.signalhouse_phone_number ?? messageLocalNumber(row),
        status: row.status,
      };
    })
    .sort((a, b) => new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime())
    .slice(0, limit);

  return NextResponse.json({ conversations, provider: "signalhouse", assignedNumber });
}

export async function GET(request: NextRequest) {
  if (signalHouseEnabled()) return getSignalHouseConversations(request);

  {
    const _auth = await requireAuth(request);
    if (_auth instanceof Response) return _auth;
  }
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);
    const lastId = searchParams.get("lastId") ?? undefined;
    const unreadOnly = searchParams.get("unread") === "true";

    // Fetch more than needed so we have enough after filtering
    const conversations = await ghl.getConversations({
      limit: Math.min(limit * 2, 100),
      lastId,
      unreadOnly,
    });

    // Filter to only conversations with real messages (not system activity)
    const filtered = conversations.filter((conv) => {
      const msgType = (conv.lastMessageType as unknown as string) ?? "";
      return REAL_MESSAGE_TYPES.has(msgType);
    });

    return NextResponse.json({ conversations: filtered.slice(0, limit) });
  } catch (err) {
    console.error("Inbox fetch failed:", err);
    return NextResponse.json({ error: "Failed to load inbox" }, { status: 502 });
  }
}
