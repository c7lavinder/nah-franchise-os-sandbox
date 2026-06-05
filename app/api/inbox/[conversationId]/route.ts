export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { getAssignedSignalHouseNumber } from "@/lib/sms/number-assignment";
import { phoneLookupKey } from "@/lib/sms/phone";
import type { GHLMessage } from "@/types/ghl";

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
};

function isAdminRole(role: string) {
  return role === "admin" || role === "leadership";
}

function parseConversationId(value: string) {
  const parts = decodeURIComponent(value).split("_");
  if (parts.length < 4 || parts[0] !== "sms") return null;
  const [, owner, kind, ...targetParts] = parts;
  const target = targetParts.join("_");
  if (!owner || !kind || !target) return null;
  return { owner, kind, target };
}

function ownedNumber(row: SmsMessageRow) {
  return phoneLookupKey(row.direction === "inbound" ? row.to_number : row.from_number);
}

function remoteNumber(row: SmsMessageRow) {
  return phoneLookupKey(row.direction === "inbound" ? row.from_number : row.to_number);
}

function rowMatchesConversation(row: SmsMessageRow, conversation: NonNullable<ReturnType<typeof parseConversationId>>) {
  if (ownedNumber(row) !== conversation.owner) return false;
  if (conversation.kind === "contact") return row.contact_id === conversation.target;
  return remoteNumber(row) === conversation.target;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  try {
    const conversation = parseConversationId(params.conversationId);
    if (!conversation) {
      return NextResponse.json({ error: "Invalid conversation id" }, { status: 400 });
    }

    const assignedNumber = await getAssignedSignalHouseNumber(user.id);
    const admin = isAdminRole(user.role);
    if (!admin && phoneLookupKey(assignedNumber) !== conversation.owner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);

    let query = supabase
      .from("sms_messages")
      .select("id, contact_id, direction, message_type, from_number, to_number, body, status, created_at, sent_at, received_at")
      .eq("provider", "signalhouse")
      .order("created_at", { ascending: false })
      .limit(300);

    if (conversation.kind === "contact") {
      query = query.eq("contact_id", conversation.target);
    } else {
      query = query.or(`from_number.ilike.%${conversation.target},to_number.ilike.%${conversation.target}`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = ((data ?? []) as SmsMessageRow[])
      .filter((row) => rowMatchesConversation(row, conversation))
      .slice(0, limit)
      .reverse();

    const messages: GHLMessage[] = rows.map((row) => ({
      id: row.id,
      contactId: row.contact_id ?? conversation.target,
      type: "SMS",
      direction: row.direction === "inbound" ? "inbound" : "outbound",
      body: row.body ?? "",
      dateAdded: row.received_at ?? row.sent_at ?? row.created_at,
      messageType: row.message_type,
      status: row.status ?? undefined,
      from: row.from_number ?? undefined,
      to: row.to_number ?? undefined,
      conversationId: params.conversationId,
      source: "signalhouse",
    }));

    return NextResponse.json({ messages, nextPage: false });
  } catch (err) {
    console.error("Conversation messages fetch failed:", err);
    return NextResponse.json({ error: "Failed to load messages" }, { status: 502 });
  }
}
