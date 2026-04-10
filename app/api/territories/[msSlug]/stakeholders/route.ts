export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/** GET — list all stakeholders for a territory */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ msSlug: string }> }
) {
  const { msSlug } = await params;
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("territory_stakeholders")
    .select("*")
    .eq("ms_slug", msSlug)
    .eq("is_active", true)
    .order("role")
    .order("last_name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ stakeholders: data ?? [] });
}

/** POST — add a stakeholder */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ msSlug: string }> }
) {
  const { msSlug } = await params;
  const supabase = createServerClient();
  const body = await request.json();

  const { data, error } = await supabase
    .from("territory_stakeholders")
    .insert({
      ms_slug: msSlug,
      first_name: body.first_name || null,
      last_name: body.last_name || null,
      email: body.email || null,
      phone: body.phone || null,
      company: body.company || null,
      role: body.role || "other",
      notes: body.notes || null,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}

/** DELETE — remove a stakeholder */
export async function DELETE(request: NextRequest) {
  const supabase = createServerClient();
  const { id } = await request.json();

  const { error } = await supabase
    .from("territory_stakeholders")
    .update({ is_active: false })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
