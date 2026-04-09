/**
 * GET /api/zorakle/prospect/:contactId
 *
 * Resolution order:
 * 1. Check contact_zorakle_data for this ghl_contact_id
 * 2. If not found, check zorakle_profiles via territory_owners → ms_slug
 * 3. If neither, return null
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const { contactId } = await params;
  const supabase = createServerClient();

  // Resolve ghl_contact_id
  let ghlContactId = contactId;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(contactId)) {
    const { data } = await supabase.from("contacts").select("ghl_contact_id").eq("id", contactId).single();
    if (data) ghlContactId = data.ghl_contact_id;
  }

  // 1. Check contact_zorakle_data
  const { data: prospectData } = await supabase
    .from("contact_zorakle_data")
    .select("*")
    .eq("ghl_contact_id", ghlContactId)
    .single();

  if (prospectData) {
    return NextResponse.json({ source: "contact_zorakle_data", profile: prospectData });
  }

  // 2. Check zorakle_profiles via territory_owners
  const { data: ownerRow } = await supabase
    .from("territory_owners")
    .select("ms_slug")
    .eq("ghl_contact_id", ghlContactId)
    .is("end_date", null)
    .limit(1)
    .maybeSingle();

  if (ownerRow?.ms_slug) {
    const { data: zorakle } = await supabase
      .from("zorakle_profiles")
      .select("*")
      .eq("ms_slug", ownerRow.ms_slug)
      .limit(1)
      .maybeSingle();

    if (zorakle) {
      return NextResponse.json({ source: "zorakle_profiles", profile: zorakle });
    }
  }

  // 3. No data
  return NextResponse.json({ source: null, profile: null });
}
