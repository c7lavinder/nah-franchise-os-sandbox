export const dynamic = "force-dynamic";

/**
 * GET /api/contacts/:contactId/journey-members
 * Returns all members of the contact's primary journey (name, email, phone, role).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { resolveContactId } from "@/lib/contacts/pipeline-state";

export async function GET(request: NextRequest, { params }: { params: Promise<{ contactId: string }> }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const { contactId: rawId } = await params;
  const supabase = createServerClient();
  const localId = await resolveContactId(rawId);
  if (!localId) return NextResponse.json({ members: [] });

  // Find the journey where this contact is primary
  const { data: journey } = await supabase
    .from("journeys")
    .select("id")
    .eq("primary_contact_id", localId)
    .maybeSingle();

  if (!journey) return NextResponse.json({ members: [] });

  const { data: jcRows } = await supabase
    .from("journey_contacts")
    .select("contact_id, role, contacts (id, first_name, last_name, email, phone)")
    .eq("journey_id", journey.id)
    .is("left_at", null);

  const members = (jcRows ?? []).map((r) => {
    const c = Array.isArray(r.contacts) ? r.contacts[0] : r.contacts;
    const contact = c as {
      id: string;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      phone: string | null;
    } | null;
    return {
      contactId: contact?.id ?? r.contact_id,
      name: `${contact?.first_name ?? ""} ${contact?.last_name ?? ""}`.trim() || "Unknown",
      email: contact?.email ?? null,
      phone: contact?.phone ?? null,
      role: r.role,
    };
  });

  return NextResponse.json({ members });
}
