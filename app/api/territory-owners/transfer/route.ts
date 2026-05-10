/**
 * POST /api/territory-owners/transfer — transfer territory ownership
 *
 * Body: { TerritorySlug, new_ghl_contact_id, transfer_notes? }
 *
 * Ends current owner's record (sets end_date) and creates a new one.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

interface TransferBody {
  TerritorySlug: string;
  new_ghl_contact_id: string;
  transfer_notes?: string;
}

export async function POST(request: NextRequest) {
  {
    const _auth = await requireAuth(request);
    if (_auth instanceof Response) return _auth;
  }
  const body = (await request.json()) as TransferBody;

  if (!body.TerritorySlug || !body.new_ghl_contact_id) {
    return NextResponse.json({ error: "TerritorySlug and new_ghl_contact_id required" }, { status: 400 });
  }

  const supabase = createServerClient();
  const today = new Date().toISOString().split("T")[0];

  // End all current ownership records for this territory
  const { error: endError } = await supabase
    .from("territory_owners")
    .update({
      end_date: today,
      transfer_notes: body.transfer_notes ?? "Transferred via admin",
    })
    .eq("TerritorySlug", body.TerritorySlug)
    .is("end_date", null);

  if (endError) {
    return NextResponse.json({ error: endError.message }, { status: 500 });
  }

  // Create new ownership record
  const { data, error } = await supabase
    .from("territory_owners")
    .insert({
      TerritorySlug: body.TerritorySlug,
      ghl_contact_id: body.new_ghl_contact_id,
      role: "owner",
      start_date: today,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, ownership: data });
}
