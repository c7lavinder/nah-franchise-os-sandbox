export const dynamic = "force-dynamic";

/**
 * PATCH /api/sub-task-logs/:logId — update content_text, content_file_url, content_link_url
 * DELETE /api/sub-task-logs/:logId — soft-delete
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ logId: string }> }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  const { logId } = await params;
  const body = await request.json();
  const supabase = createServerClient();

  const updates: Record<string, unknown> = {};
  if ("contentText" in body) updates.content_text = body.contentText ?? null;
  if ("contentFileUrl" in body) updates.content_file_url = body.contentFileUrl ?? null;
  if ("contentLinkUrl" in body) updates.content_link_url = body.contentLinkUrl ?? null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error } = await supabase.from("contact_sub_task_logs").update(updates).eq("id", logId).is("deleted_at", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ logId: string }> }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  const { logId } = await params;
  const supabase = createServerClient();

  const { error } = await supabase
    .from("contact_sub_task_logs")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", logId)
    .is("deleted_at", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
