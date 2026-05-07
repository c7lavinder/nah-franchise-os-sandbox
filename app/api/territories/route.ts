export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  {
    const _auth = await requireAuth(request);
    if (_auth instanceof Response) return _auth;
  }
  const status = request.nextUrl.searchParams.get("status");
  const supabase = createServerClient();

  let query = supabase.from("territories").select("ms_slug, territory_name, status, region");

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query.order("territory_name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ territories: data ?? [] });
}

/**
 * POST /api/territories — create a new territory and optionally assign an owner.
 * Body: { ms_slug, territory_name, region?, ghl_contact_id? }
 */
export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json();
  const { ms_slug, territory_name, region, ghl_contact_id } = body as {
    ms_slug: string;
    territory_name: string;
    region?: string;
    ghl_contact_id?: string;
  };

  if (!ms_slug || !territory_name) {
    return NextResponse.json({ error: "ms_slug and territory_name are required" }, { status: 400 });
  }

  const supabase = createServerClient();

  // Create territory
  const { error: tErr } = await supabase.from("territories").insert({
    ms_slug,
    territory_name,
    region: region ?? null,
    status: "active",
  });

  if (tErr) {
    if (tErr.code === "23505") {
      return NextResponse.json({ error: "Territory slug already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: tErr.message }, { status: 500 });
  }

  // Assign owner if provided
  if (ghl_contact_id) {
    const { error: oErr } = await supabase.from("territory_owners").insert({
      ms_slug,
      ghl_contact_id,
      role: "owner",
      start_date: new Date().toISOString().split("T")[0],
    });
    if (oErr) {
      console.error("Failed to assign territory owner:", oErr.message);
    }
  }

  return NextResponse.json({ ms_slug, territory_name, success: true });
}
