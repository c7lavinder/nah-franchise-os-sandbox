/**
 * POST /api/journeys/:journeyId/members
 *
 * Add an existing contact to a journey with a specified role. Idempotent
 * against the uniq_active_journey_contact partial unique index — retrying
 * with the same contact returns the existing membership instead of
 * erroring. Used by the Profile tab's "Add contact to journey" button.
 *
 * Body: { contact_id: string, role: string }
 * Allowed roles mirror the journey_contacts CHECK constraint.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const ALLOWED_ROLES = new Set([
  "primary", "co_primary", "spouse", "family", "attorney",
  "accountant", "financial_advisor", "business_partner", "other",
]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ journeyId: string }> }
) {
  const { journeyId } = await params;
  const body = await request.json().catch(() => ({})) as { contact_id?: string; role?: string };
  const contactId = body.contact_id?.trim();
  const role = body.role?.trim();

  if (!contactId || !role) {
    return NextResponse.json({ error: "contact_id and role are required" }, { status: 400 });
  }
  if (!ALLOWED_ROLES.has(role)) {
    return NextResponse.json({ error: `role must be one of: ${[...ALLOWED_ROLES].join(", ")}` }, { status: 400 });
  }

  const supabase = createServerClient();

  // Guard: journey exists and is active.
  const { data: journey } = await supabase
    .from("journeys").select("id, status").eq("id", journeyId).maybeSingle();
  if (!journey) return NextResponse.json({ error: "Journey not found" }, { status: 404 });
  if (journey.status !== "active") {
    return NextResponse.json({ error: "Journey is closed or archived" }, { status: 409 });
  }

  // Guard: contact exists.
  const { data: contact } = await supabase
    .from("contacts").select("id, first_name, last_name").eq("id", contactId).maybeSingle();
  if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  // If an active membership already exists, return it instead of erroring.
  const { data: existing } = await supabase
    .from("journey_contacts")
    .select("id, role")
    .eq("journey_id", journeyId).eq("contact_id", contactId).is("left_at", null)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ member: existing, already_existed: true });
  }

  const { data: inserted, error } = await supabase
    .from("journey_contacts")
    .insert({ journey_id: journeyId, contact_id: contactId, role })
    .select("id, role")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ member: inserted, already_existed: false });
}
