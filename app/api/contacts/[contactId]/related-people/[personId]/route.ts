export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";import { createServerClient } from "@/lib/supabase/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string; personId: string }> }
) {
  const { personId } = await params;
  const body = await request.json() as Record<string, unknown>;
  const supabase = createServerClient();

  const allowed = ["first_name", "last_name", "email", "phone", "role", "relationship_notes", "is_primary_decision_maker"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key];
  }
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "No fields" }, { status: 400 });

  const { error } = await supabase.from("contact_related_people").update(updates).eq("id", personId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string; personId: string }> }
) {
  const { personId } = await params;
  const supabase = createServerClient();

  const { error } = await supabase
    .from("contact_related_people")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", personId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
