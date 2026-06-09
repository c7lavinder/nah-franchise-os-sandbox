export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { getAssignedSignalHouseNumber, getConfiguredSignalHouseNumbers } from "@/lib/sms/number-assignment";
import { phoneLookupKey } from "@/lib/sms/phone";
import type { GHLConversation } from "@/types/ghl";

type SmsMessageRow = {
  id: string;
  contact_id: string | null;
  direction: string;
  message_type: string;
  from_number: string | null;
  to_number: string | null;
  body: string | null;
  status: string | null;
  created_at: string;
  sent_at: string | null;
  received_at: string | null;
  contacts?:
    | {
        id: string;
        first_name: string | null;
        last_name: string | null;
        email: string | null;
        phone: string | null;
      }
    | {
        id: string;
        first_name: string | null;
        last_name: string | null;
        email: string | null;
        phone: string | null;
      }[]
    | null;
};

type ReadRow = {
  conversation_key: string;
  read_at: string;
};

function isAdminRole(role: string) {
  return role === "admin" || role === "leadership";
}

function ownedNumber(row: SmsMessageRow) {
  return row.direction === "inbound" ? row.to_number : row.from_number;
}

function remoteNumber(row: SmsMessageRow) {
  return row.direction === "inbound" ? row.from_number : row.to_number;
}

function conversationTarget(row: SmsMessageRow) {
  if (row.contact_id) return { kind: "contact", value: row.contact_id };
  return { kind: "phone", value: phoneLookupKey(remoteNumber(row)) || remoteNumber(row) || "unknown" };
}

function conversationId(row: SmsMessageRow) {
  const owner = phoneLookupKey(ownedNumber(row)) || "unknown";
  const target = conversationTarget(row);
  return `sms_${owner}_${target.kind}_${target.value}`;
}

function contactName(row: SmsMessageRow) {
  const contact = Array.isArray(row.contacts) ? row.contacts[0] : row.contacts;
  const name = [contact?.first_name, contact?.last_name].filter(Boolean).join(" ").trim();
  return name || remoteNumber(row) || "Unknown";
}

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);
    const unreadOnly = searchParams.get("unread") === "true";
    const assignedNumber = await getAssignedSignalHouseNumber(user.id);
    const admin = isAdminRole(user.role);

    if (!admin && !assignedNumber) {
      return NextResponse.json({
        conversations: [],
        setupRequired: true,
        error: "Your user does not have a SignalHouse number assigned.",
      });
    }

    let query = supabase
      .from("sms_messages")
      .select(
        "id, contact_id, direction, message_type, from_number, to_number, body, status, created_at, sent_at, received_at, contacts(id, first_name, last_name, email, phone)"
      )
      .eq("provider", "signalhouse")
      .order("created_at", { ascending: false })
      .limit(500);

    if (!admin && assignedNumber) {
      query = query.or(`from_number.eq.${assignedNumber},to_number.eq.${assignedNumber}`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []) as unknown as SmsMessageRow[];
    const conversationIds = Array.from(new Set(rows.map(conversationId)));
    const { data: reads } = conversationIds.length
      ? await supabase
          .from("sms_conversation_reads")
          .select("conversation_key, read_at")
          .eq("user_id", user.id)
          .in("conversation_key", conversationIds)
      : { data: [] as ReadRow[] };
    const readAtByKey = new Map(((reads ?? []) as ReadRow[]).map((read) => [read.conversation_key, read.read_at]));

    const grouped = new Map<string, { latest: SmsMessageRow; unreadCount: number }>();
    for (const row of rows) {
      const id = conversationId(row);
      const current = grouped.get(id);
      const readAt = readAtByKey.get(id);
      const isUnreadInbound =
        row.direction === "inbound" && (!readAt || new Date(row.created_at).getTime() > new Date(readAt).getTime());

      if (!current) {
        grouped.set(id, { latest: row, unreadCount: isUnreadInbound ? 1 : 0 });
      } else {
        current.unreadCount += isUnreadInbound ? 1 : 0;
      }
    }

    const conversations: GHLConversation[] = Array.from(grouped.entries())
      .map(([id, group]) => {
        const latest = group.latest;
        const contact = Array.isArray(latest.contacts) ? latest.contacts[0] : latest.contacts;
        return {
          id,
          contactId: latest.contact_id ?? id,
          locationId: "signalhouse",
          lastMessageDate: latest.received_at ?? latest.sent_at ?? latest.created_at,
          type: "TYPE_SMS",
          unreadCount: group.unreadCount,
          contactName: contactName(latest),
          fullName: contactName(latest),
          email: contact?.email ?? undefined,
          phone: contact?.phone ?? remoteNumber(latest) ?? undefined,
          lastMessageType: "TYPE_SMS" as unknown as number,
          tags: [ownedNumber(latest) ?? "unassigned"],
        };
      })
      .filter((conv) => !unreadOnly || (conv.unreadCount ?? 0) > 0)
      .slice(0, limit);

    const availableNumbers = getConfiguredSignalHouseNumbers();

    return NextResponse.json({
      conversations,
      assignedNumber,
      availableNumbers,
      scope: admin ? "all" : "assigned",
    });
  } catch (err) {
    console.error("Inbox fetch failed:", err);
    return NextResponse.json({ error: "Failed to load inbox" }, { status: 502 });
  }
}
