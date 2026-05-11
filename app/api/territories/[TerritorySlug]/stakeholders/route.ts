export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

/** GET — list all stakeholders for a territory.
 *  When a stakeholder has contact_id, returns live contact data instead of stale copies. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ TerritorySlug: string }> }) {
  const { TerritorySlug } = await params;
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("territory_stakeholders")
    .select(
      "id, TerritorySlug, role, company, notes, is_active, contact_id, first_name, last_name, email, phone, contacts(id, first_name, last_name, email, phone)"
    )
    .eq("TerritorySlug", TerritorySlug)
    .eq("is_active", true)
    .order("role")
    .order("last_name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Merge: use live contact data when linked, fall back to stakeholder's own fields
  const stakeholders = (data ?? []).map((row: any) => {
    const contact = Array.isArray(row.contacts) ? row.contacts[0] : row.contacts;
    return {
      id: row.id,
      contact_id: row.contact_id,
      role: row.role,
      company: row.company,
      notes: row.notes,
      first_name: contact?.first_name ?? row.first_name,
      last_name: contact?.last_name ?? row.last_name,
      email: contact?.email ?? row.email,
      phone: contact?.phone ?? row.phone,
    };
  });

  return NextResponse.json({ stakeholders });
}

/** POST — add a stakeholder. Accepts contact_id to link back to the contacts
 *  table, so the call classifier and contact pages can surface this person. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ TerritorySlug: string }> }) {
  const { TerritorySlug } = await params;
  const supabase = createServerClient();
  const body = (await request.json()) as {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    company?: string;
    role?: string;
    notes?: string;
    contact_id?: string | null;
  };

  const { data, error } = await supabase
    .from("territory_stakeholders")
    .insert({
      TerritorySlug: TerritorySlug,
      first_name: body.first_name || null,
      last_name: body.last_name || null,
      email: body.email || null,
      phone: body.phone || null,
      company: body.company || null,
      role: body.role || "other",
      notes: body.notes || null,
      contact_id: body.contact_id ?? null,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}

/** DELETE — remove a stakeholder */
export async function DELETE(request: NextRequest) {
  {
    const _auth = await requireAuth(request);
    if (_auth instanceof Response) return _auth;
  }
  const supabase = createServerClient();
  const { id } = await request.json();

  const { error } = await supabase.from("territory_stakeholders").update({ is_active: false }).eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
