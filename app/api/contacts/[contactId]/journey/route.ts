/**
 * GET /api/contacts/:contactId/journey — active journey memberships.
 *
 * Returns the journeys this contact is currently part of (left_at IS NULL)
 * with the role + whether they're the journey's primary contact. Most
 * contacts will have exactly one; partnerships surface two.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { resolveContactId } from "@/lib/contacts/pipeline-state";

interface JourneyMembership {
  journey_id: string;
  journey_slug: string | null;
  journey_name: string;
  role: string;
  is_journey_primary: boolean;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const { contactId } = await params;

  const localContactId = await resolveContactId(contactId);
  if (!localContactId) {
    return NextResponse.json({ journeys: [] });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("journey_contacts")
    .select("role, journeys!inner(id, slug, name, primary_contact_id, status)")
    .eq("contact_id", localContactId)
    .is("left_at", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const journeys: JourneyMembership[] = (data ?? [])
    .flatMap((row) => {
      const j = row.journeys as unknown as {
        id: string; slug: string | null; name: string; primary_contact_id: string; status: string;
      } | null;
      if (!j || j.status !== "active") return [];
      return [{
        journey_id: j.id,
        journey_slug: j.slug,
        journey_name: j.name,
        role: row.role as string,
        is_journey_primary: j.primary_contact_id === localContactId,
      }];
    });

  return NextResponse.json({ journeys });
}
