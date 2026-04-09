export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { resolveContactId } from "@/lib/contacts/pipeline-state";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const { contactId: rawId } = await params;
  const supabase = createServerClient();
  const localId = await resolveContactId(rawId);
  if (!localId) return NextResponse.json({ people: [] });

  const { data, error } = await supabase
    .from("contact_related_people")
    .select("*")
    .eq("contact_id", localId)
    .is("deleted_at", null)
    .order("created_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ people: data ?? [] });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const { contactId: rawId } = await params;
  const supabase = createServerClient();
  const localId = await resolveContactId(rawId);
  if (!localId) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  const body = await request.json() as {
    first_name?: string; last_name?: string; email?: string; phone?: string;
    role?: string; relationship_notes?: string; is_primary_decision_maker?: boolean;
  };

  const { data, error } = await supabase
    .from("contact_related_people")
    .insert({
      contact_id: localId,
      first_name: body.first_name ?? null,
      last_name: body.last_name ?? null,
      email: body.email ?? null,
      phone: body.phone ?? null,
      role: body.role ?? "other",
      relationship_notes: body.relationship_notes ?? null,
      is_primary_decision_maker: body.is_primary_decision_maker ?? false,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id, success: true });
}
