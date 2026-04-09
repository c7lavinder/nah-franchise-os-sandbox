/**
 * GET /api/contacts/:contactId/territories — all territories owned by a contact
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const { contactId } = await params;
  const supabase = createServerClient();

  // Resolve to ghl_contact_id
  let ghlContactId = contactId;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(contactId)) {
    const { data } = await supabase
      .from("contacts")
      .select("ghl_contact_id")
      .eq("id", contactId)
      .single();
    if (data) ghlContactId = data.ghl_contact_id;
  }

  const { data, error } = await supabase
    .from("territory_owners")
    .select("*, territories (ms_slug, territory_name, status)")
    .eq("ghl_contact_id", ghlContactId)
    .order("start_date", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const current = (data ?? []).filter((r) => r.end_date === null);
  const former = (data ?? []).filter((r) => r.end_date !== null);

  return NextResponse.json({ current, former, all: data ?? [] });
}
