export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

/** PUT — update a contact todo (done / owner) */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string; todoId: string }> }
) {
  {
    const _auth = await requireAuth(request);
    if (_auth instanceof Response) return _auth;
  }
  const { todoId } = await params;
  const supabase = createServerClient();
  const body = (await request.json()) as {
    is_done?: boolean;
    owner_user_id?: string | null;
    Todo?: string;
  };

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.is_done !== undefined) updates.is_done = body.is_done;
  if (body.owner_user_id !== undefined) updates.owner_user_id = body.owner_user_id;
  if (body.Todo !== undefined) updates.Todo = body.Todo;

  const { error } = await supabase.from("eos_contact_todos").update(updates).eq("id", todoId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

/** DELETE — remove a contact todo */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string; todoId: string }> }
) {
  {
    const _auth = await requireAuth(request);
    if (_auth instanceof Response) return _auth;
  }
  const { todoId } = await params;
  const supabase = createServerClient();

  const { error } = await supabase.from("eos_contact_todos").delete().eq("id", todoId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
