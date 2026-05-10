export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { resolveContactId } from "@/lib/contacts/pipeline-state";

/** POST — create a new contact todo */
export async function POST(request: NextRequest, { params }: { params: Promise<{ contactId: string }> }) {
  {
    const _auth = await requireAuth(request);
    if (_auth instanceof Response) return _auth;
  }
  const { contactId: rawId } = await params;
  const supabase = createServerClient();
  const localId = await resolveContactId(rawId);
  if (!localId) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  const body = (await request.json()) as {
    Todo?: string;
    owner_user_id?: string;
    source?: string;
  };
  if (!body.Todo?.trim()) {
    return NextResponse.json({ error: "Todo is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("eos_contact_todos")
    .insert({
      contact_id: localId,
      Todo: body.Todo.trim(),
      owner_user_id: body.owner_user_id ?? null,
      source: body.source ?? "manual",
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ todo: data });
}
