export const dynamic = "force-dynamic";

/**
 * PATCH  /api/contacts/:contactId/messages/:messageId — edit message (author only)
 * DELETE /api/contacts/:contactId/messages/:messageId — soft delete (author only)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string; messageId: string }> }
) {
  const { messageId } = await params;
  const supabase = createServerClient();

  const authUser = await requireAuth(request);
  if (authUser instanceof Response) return authUser;

  const body = (await request.json()) as { body?: string; userId?: string };
  const userId = authUser.id;
  if (!userId) {
    return NextResponse.json({ error: "User identification required" }, { status: 401 });
  }

  // Verify author
  const { data: existing } = await supabase
    .from("contact_activity_messages")
    .select("author_user_id")
    .eq("id", messageId)
    .is("deleted_at", null)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }
  if (existing.author_user_id !== userId) {
    return NextResponse.json({ error: "Only the author can edit this message" }, { status: 403 });
  }

  if (!body.body?.trim()) {
    return NextResponse.json({ error: "Message body is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("contact_activity_messages")
    .update({ body: body.body.trim(), updated_at: new Date().toISOString() })
    .eq("id", messageId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string; messageId: string }> }
) {
  const { messageId } = await params;
  const supabase = createServerClient();

  const authUser = await requireAuth(request);
  if (authUser instanceof Response) return authUser;

  const body = (await request.json().catch(() => ({}))) as { userId?: string };
  const userId = authUser.id;
  if (!userId) {
    return NextResponse.json({ error: "User identification required" }, { status: 401 });
  }

  // Verify author
  const { data: existing } = await supabase
    .from("contact_activity_messages")
    .select("author_user_id")
    .eq("id", messageId)
    .is("deleted_at", null)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }
  if (existing.author_user_id !== userId) {
    return NextResponse.json({ error: "Only the author can delete this message" }, { status: 403 });
  }

  const { error } = await supabase
    .from("contact_activity_messages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", messageId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
