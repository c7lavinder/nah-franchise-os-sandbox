/**
 * GET /api/contacts/:contactId/territories — every territory this contact is
 * tied to, from two sources:
 *
 *   1. territory_owners (ownership)
 *   2. territory_stakeholders (ecosystem membership — employee, contractor,
 *      agent, etc.) — merged into `current` so the call-mapping UI can let
 *      users attach stakeholder territories to their calls.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";import { createServerClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const { contactId } = await params;
  const supabase = createServerClient();

  // Resolve to both the local uuid (for stakeholders lookup) and the
  // ghl_contact_id (for territory_owners lookup).
  let localId: string | null = null;
  let ghlContactId = contactId;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(contactId)) {
    localId = contactId;
    const { data } = await supabase
      .from("contacts")
      .select("ghl_contact_id")
      .eq("id", contactId)
      .single();
    if (data) ghlContactId = data.ghl_contact_id;
  } else {
    const { data } = await supabase
      .from("contacts")
      .select("id")
      .eq("ghl_contact_id", contactId)
      .maybeSingle();
    localId = data?.id ?? null;
  }

  const { data: ownerRows, error } = await supabase
    .from("territory_owners")
    .select("*, territories (ms_slug, territory_name, status)")
    .eq("ghl_contact_id", ghlContactId)
    .order("start_date", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const current = (ownerRows ?? []).filter((r) => r.end_date === null);
  const former = (ownerRows ?? []).filter((r) => r.end_date !== null);
  const ownedSlugs = new Set(current.map((r) => r.ms_slug));

  // Pull stakeholder-linked territories. De-dupe against owned.
  let stakeholderCurrent: Array<Record<string, unknown>> = [];
  if (localId) {
    const { data: stakeRows } = await supabase
      .from("territory_stakeholders")
      .select("ms_slug, role, territories (ms_slug, territory_name, status)")
      .eq("contact_id", localId)
      .eq("is_active", true);
    stakeholderCurrent = (stakeRows ?? [])
      .filter((r) => !ownedSlugs.has(r.ms_slug))
      .map((r) => ({
        ms_slug: r.ms_slug,
        ghl_contact_id: ghlContactId,
        role: r.role,
        start_date: null,
        end_date: null,
        territories: r.territories,
        source: "stakeholder",
      }));
  }

  const mergedCurrent = [...current, ...stakeholderCurrent];

  return NextResponse.json({
    current: mergedCurrent,
    former,
    all: [...(ownerRows ?? []), ...stakeholderCurrent],
  });
}
