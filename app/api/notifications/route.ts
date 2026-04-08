export const dynamic = "force-dynamic";

/**
 * GET   /api/notifications — returns @-mention notifications for current user
 * PATCH /api/notifications — mark listed notifications as read
 *
 * Per §1.14: bell shows ONLY @-mention notifications from the notifications table.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const supabase = createServerClient();

  const authUser = await getAuthUser(request.headers.get("Authorization"));
  if (!authUser) {
    // Fallback: return empty for unauthenticated (bell still renders)
    return NextResponse.json({ notifications: [], count: 0 });
  }

  const { data, error } = await supabase
    .from("notifications")
    .select("id, recipient_user_id, source_type, source_id, contact_id, read_at, created_at")
    .eq("recipient_user_id", authUser.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const notifications = data ?? [];

  // Enrich with contact names and author names from the source messages
  const contactIds = [...new Set(notifications.map((n) => n.contact_id))];
  const sourceIds = [...new Set(notifications.map((n) => n.source_id))];

  const contactMap = new Map<string, string>();
  if (contactIds.length > 0) {
    const { data: contacts } = await supabase
      .from("contacts")
      .select("id, first_name, last_name")
      .in("id", contactIds);
    for (const c of contacts ?? []) {
      contactMap.set(c.id, `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Unknown");
    }
  }

  const messageMap = new Map<string, { authorName: string; preview: string }>();
  if (sourceIds.length > 0) {
    const { data: msgs } = await supabase
      .from("contact_activity_messages")
      .select("id, author_user_id, body")
      .in("id", sourceIds);

    if (msgs && msgs.length > 0) {
      const authorIds = [...new Set(msgs.map((m) => m.author_user_id))];
      const { data: authors } = await supabase
        .from("users")
        .select("id, full_name")
        .in("id", authorIds);
      const authorNameMap = new Map<string, string>();
      for (const a of authors ?? []) {
        authorNameMap.set(a.id, a.full_name);
      }

      for (const m of msgs) {
        messageMap.set(m.id, {
          authorName: authorNameMap.get(m.author_user_id) ?? "Unknown",
          preview: m.body.length > 80 ? m.body.slice(0, 80) + "..." : m.body,
        });
      }
    }
  }

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const enriched = notifications.map((n) => ({
    id: n.id,
    sourceType: n.source_type,
    sourceId: n.source_id,
    contactId: n.contact_id,
    contactName: contactMap.get(n.contact_id) ?? "Unknown",
    authorName: messageMap.get(n.source_id)?.authorName ?? "Unknown",
    preview: messageMap.get(n.source_id)?.preview ?? "",
    readAt: n.read_at,
    createdAt: n.created_at,
  }));

  return NextResponse.json({ notifications: enriched, count: unreadCount });
}

export async function PATCH(request: NextRequest) {
  const supabase = createServerClient();

  const authUser = await getAuthUser(request.headers.get("Authorization"));
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json() as { ids?: string[] };
  if (!body.ids || body.ids.length === 0) {
    return NextResponse.json({ error: "ids array is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .in("id", body.ids)
    .eq("recipient_user_id", authUser.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
