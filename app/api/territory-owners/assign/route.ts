/**
 * POST /api/territory-owners/assign — assign a contact as territory owner
 *
 * Body: { ms_slug, ghl_contact_id, role?: "owner" | "co-owner" }
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

interface AssignBody {
  ms_slug: string;
  ghl_contact_id: string;
  role?: "owner" | "co-owner";
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as AssignBody;

  if (!body.ms_slug || !body.ghl_contact_id) {
    return NextResponse.json({ error: "ms_slug and ghl_contact_id required" }, { status: 400 });
  }

  const supabase = createServerClient();

  // Check no current owner already exists (unless co-owner)
  const { data: existing } = await supabase
    .from("territory_owners")
    .select("id, ghl_contact_id, role")
    .eq("ms_slug", body.ms_slug)
    .is("end_date", null);

  const hasOwner = (existing ?? []).some((r) => r.role === "owner");
  if (hasOwner && (body.role ?? "owner") === "owner") {
    return NextResponse.json(
      { error: "Territory already has an active owner. Transfer first." },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from("territory_owners")
    .insert({
      ms_slug: body.ms_slug,
      ghl_contact_id: body.ghl_contact_id,
      role: body.role ?? "owner",
      start_date: new Date().toISOString().split("T")[0],
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, ownership: data });
}
