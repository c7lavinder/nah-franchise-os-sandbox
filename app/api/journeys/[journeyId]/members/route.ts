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
import { requireAuth } from "@/lib/auth";import { createServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/journeys/slug";

const ALLOWED_ROLES = new Set([
  "primary", "co_primary", "spouse", "family", "attorney",
  "accountant", "financial_advisor", "business_partner", "other",
]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ journeyId: string }> }
) {
  const { journeyId: rawId } = await params;
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

  // Guard: journey exists and is active. Accept slug or UUID.
  const lookupColumn = isUuid(rawId) ? "id" : "slug";
  const { data: journey } = await supabase
    .from("journeys").select("id, status").eq(lookupColumn, rawId).maybeSingle();
  if (!journey) return NextResponse.json({ error: "Journey not found" }, { status: 404 });
  if (journey.status !== "active") {
    return NextResponse.json({ error: "Journey is closed or archived" }, { status: 409 });
  }
  const journeyId = journey.id;

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

  // If the new member joined as primary or co_primary, rebuild the journey
  // name from every active primary/co_primary. Matches the "Ryan Decker +
  // Shannon Smylie" convention used elsewhere in the product.
  if (role === "primary" || role === "co_primary") {
    const { data: corePrimaries } = await supabase
      .from("journey_contacts")
      .select("contact_id, role, contacts(first_name, last_name)")
      .eq("journey_id", journeyId)
      .is("left_at", null)
      .in("role", ["primary", "co_primary"]);
    const names: string[] = [];
    for (const m of corePrimaries ?? []) {
      const c = Array.isArray(m.contacts) ? m.contacts[0] : m.contacts;
      const full = `${c?.first_name ?? ""} ${c?.last_name ?? ""}`.trim();
      if (full && !names.includes(full)) names.push(full);
    }
    if (names.length > 0) {
      await supabase
        .from("journeys")
        .update({ name: names.join(" + ") })
        .eq("id", journeyId);
    }
  }

  return NextResponse.json({ member: inserted, already_existed: false });
}
