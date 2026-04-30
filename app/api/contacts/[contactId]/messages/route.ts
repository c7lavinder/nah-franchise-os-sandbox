export const dynamic = "force-dynamic";

/**
 * GET  /api/contacts/:contactId/messages — list activity messages
 * POST /api/contacts/:contactId/messages — create message + mention notifications
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { resolveContactId } from "@/lib/contacts/pipeline-state";
import { requireAuth } from "@/lib/auth";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ contactId: string }> }) {
  const { contactId: rawId } = await params;
  const supabase = createServerClient();

  const localId = await resolveContactId(rawId);
  if (!localId) {
    return NextResponse.json({ messages: [] });
  }

  const { data, error } = await supabase
    .from("contact_activity_messages")
    .select("id, contact_id, author_user_id, body, mentioned_user_ids, created_at, updated_at, deleted_at")
    .eq("contact_id", localId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Look up author names
  const authorIds = [...new Set((data ?? []).map((m) => m.author_user_id))];
  const authorMap = new Map<string, string>();
  if (authorIds.length > 0) {
    const { data: users } = await supabase.from("users").select("id, full_name").in("id", authorIds);
    for (const u of users ?? []) {
      authorMap.set(u.id, u.full_name);
    }
  }

  // Look up mentioned user names
  const allMentionIds = [...new Set((data ?? []).flatMap((m) => m.mentioned_user_ids ?? []))];
  const mentionMap = new Map<string, string>();
  if (allMentionIds.length > 0) {
    const { data: mentionUsers } = await supabase.from("users").select("id, full_name").in("id", allMentionIds);
    for (const u of mentionUsers ?? []) {
      mentionMap.set(u.id, u.full_name);
    }
  }

  const messages = (data ?? []).map((m) => ({
    id: m.id,
    contactId: m.contact_id,
    authorUserId: m.author_user_id,
    authorName: authorMap.get(m.author_user_id) ?? "Unknown",
    body: m.body,
    mentionedUserIds: m.mentioned_user_ids ?? [],
    mentionedNames: Object.fromEntries(
      (m.mentioned_user_ids ?? []).map((uid: string) => [uid, mentionMap.get(uid) ?? "Unknown"])
    ),
    createdAt: m.created_at,
    updatedAt: m.updated_at,
  }));

  return NextResponse.json({ messages });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ contactId: string }> }) {
  const { contactId: rawId } = await params;
  const supabase = createServerClient();

  const authUser = await requireAuth(request);
  if (authUser instanceof Response) return authUser;

  const localId = await resolveContactId(rawId);
  if (!localId) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  const body = (await request.json()) as { body?: string; mentionedUserIds?: string[]; authorUserId?: string };
  if (!body.body?.trim()) {
    return NextResponse.json({ error: "Message body is required" }, { status: 400 });
  }

  const authorId = authUser.id;

  const mentionedUserIds = body.mentionedUserIds ?? [];

  // Insert message
  const { data: msg, error: msgError } = await supabase
    .from("contact_activity_messages")
    .insert({
      contact_id: localId,
      author_user_id: authorId,
      body: body.body.trim(),
      mentioned_user_ids: mentionedUserIds.length > 0 ? mentionedUserIds : null,
    })
    .select("id")
    .single();

  if (msgError) {
    return NextResponse.json({ error: msgError.message }, { status: 500 });
  }

  // Create notifications for each mentioned user
  if (mentionedUserIds.length > 0) {
    const notifications = mentionedUserIds
      .filter((uid) => uid !== authorId) // Don't notify yourself
      .map((uid) => ({
        recipient_user_id: uid,
        source_type: "activity_mention" as const,
        source_id: msg.id,
        contact_id: localId,
      }));

    if (notifications.length > 0) {
      await supabase.from("notifications").insert(notifications);
    }
  }

  return NextResponse.json({ id: msg.id, success: true });
}
