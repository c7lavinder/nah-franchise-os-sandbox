export const dynamic = "force-dynamic";

/**
 * PATCH  /api/zoning/districts/[districtId] — update rule fields and/or verify (admin)
 *        body: { verify?: true, ...ruleFields (snake_case column names) }
 *        Editing an ai_extracted row without verify keeps it ai_extracted.
 * DELETE /api/zoning/districts/[districtId] — remove a district (admin);
 *        verified rows must be un-verified first (edit deliberately, not casually)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

const EDITABLE_COLUMNS = [
  "name",
  "category",
  "min_lot_acres",
  "min_lot_width_ft",
  "min_road_frontage_ft",
  "front_setback_ft",
  "side_setback_ft",
  "rear_setback_ft",
  "max_height_ft",
  "max_lot_coverage_percent",
  "min_dwelling_sqft",
  "adu_allowed",
  "septic_allowed",
  "notes",
] as const;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ districtId: string }> }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  const { districtId } = await params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const col of EDITABLE_COLUMNS) {
    if (col in body) update[col] = body[col];
  }

  if (body.verify === true) {
    update.extraction_status = "verified";
    update.verified_by = user.fullName ?? user.id;
    update.verified_at = new Date().toISOString();
  } else if (body.unverify === true) {
    update.extraction_status = "ai_extracted";
    update.verified_by = null;
    update.verified_at = null;
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("zoning_districts")
    .update(update)
    .eq("id", districtId)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "District not found" }, { status: 404 });

  return NextResponse.json({ district: data });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ districtId: string }> }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  const { districtId } = await params;

  const supabase = createServerClient();
  const { data: existing } = await supabase
    .from("zoning_districts")
    .select("id, extraction_status")
    .eq("id", districtId)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: "District not found" }, { status: 404 });
  if (existing.extraction_status === "verified") {
    return NextResponse.json(
      { error: "District is verified — unverify it first (PATCH { unverify: true })" },
      { status: 409 }
    );
  }

  const { error } = await supabase.from("zoning_districts").delete().eq("id", districtId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
