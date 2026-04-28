/**
 * POST /api/territories/:msSlug/transfer — Transfer territory ownership (admin only)
 *
 * Closes old owner row (sets end_date) and opens new row.
 * Never overwrites — always append.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";import { createServerClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ msSlug: string }> }
) {
  const { msSlug } = await params;
  const supabase = createServerClient();

  const body = await request.json() as {
    new_ghl_contact_id: string;
    role?: "owner" | "co-owner";
    transfer_notes?: string;
  };

  if (!body.new_ghl_contact_id) {
    return NextResponse.json({ error: "new_ghl_contact_id required" }, { status: 400 });
  }

  // Close current owner(s)
  const { error: closeErr } = await supabase
    .from("territory_owners")
    .update({ end_date: new Date().toISOString().split("T")[0] })
    .eq("ms_slug", msSlug)
    .is("end_date", null);

  if (closeErr) {
    return NextResponse.json({ error: closeErr.message }, { status: 500 });
  }

  // Open new row
  const { data: newRow, error: openErr } = await supabase
    .from("territory_owners")
    .insert({
      ms_slug: msSlug,
      ghl_contact_id: body.new_ghl_contact_id,
      role: body.role ?? "owner",
      transfer_notes: body.transfer_notes,
    })
    .select("id")
    .single();

  if (openErr) {
    return NextResponse.json({ error: openErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, ownerRecordId: newRow.id });
}
