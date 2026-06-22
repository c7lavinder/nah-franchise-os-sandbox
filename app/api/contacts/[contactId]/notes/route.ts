export const dynamic = "force-dynamic";

/**
 * POST /api/contacts/[contactId]/notes
 *
 * Adds a note to a contact in GHL. The [contactId] may be a real GHL contact id
 * or a local UUID.
 *
 * Prospects imported without a GHL contact carry a synthetic placeholder id
 * (e.g. "pto_102756"). GHL rejects notes for those ("Contact not found"), so we
 * first create the prospect in GHL (NAH OS → GHL), persist the real id, then add
 * the note.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import * as ghl from "@/lib/ghl";
import { upsertContact } from "@/lib/ghl/client";
import { createServerClient } from "@/lib/supabase/server";
import { contactIdFilter } from "@/lib/scout/contact-utils";

/** Synthetic ids assigned to prospects that were imported without a GHL contact. */
function isPlaceholderGhlId(id: string | null | undefined): boolean {
  return !id || id.startsWith("pto_") || id.startsWith("ms_");
}

export async function POST(request: NextRequest, { params }: { params: { contactId: string } }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  try {
    const { contactId } = params;
    const body = await request.json();

    if (!body.body?.trim()) {
      return NextResponse.json({ error: "Note body is required" }, { status: 400 });
    }
    const noteBody = body.body.trim();

    const supabase = createServerClient();
    const { data: contact } = await supabase
      .from("contacts")
      .select("id, ghl_contact_id, first_name, last_name, email, phone, city, state, opportunity_source")
      .or(contactIdFilter(contactId))
      .limit(1)
      .maybeSingle();

    // Effective GHL id: the contact's stored id, or the route param if it already looks real.
    let ghlContactId = contact?.ghl_contact_id ?? (isPlaceholderGhlId(contactId) ? null : contactId);

    // Prospect not yet in GHL — create them first so the note has somewhere to land.
    if (isPlaceholderGhlId(ghlContactId)) {
      if (!contact) {
        return NextResponse.json({ error: "Contact not found" }, { status: 404 });
      }
      if (!contact.email?.trim() && !contact.phone?.trim()) {
        return NextResponse.json(
          {
            error:
              "Add an email or phone to this contact first — it's required to create them in GHL before notes can sync.",
          },
          { status: 400 }
        );
      }

      const upserted = await upsertContact({
        firstName: (contact.first_name ?? "").trim() || "Unknown",
        lastName: (contact.last_name ?? "").trim() || "Prospect",
        ...(contact.email?.trim() ? { email: contact.email.trim() } : {}),
        ...(contact.phone?.trim() ? { phone: contact.phone.trim() } : {}),
        ...(contact.city?.trim() ? { city: contact.city.trim() } : {}),
        ...(contact.state?.trim() ? { state: contact.state.trim() } : {}),
        ...(contact.opportunity_source?.trim() ? { source: contact.opportunity_source.trim() } : {}),
      });
      ghlContactId = upserted.contact.id;

      // Replace the placeholder id locally so future pushes use the real GHL contact.
      const { error: updateError } = await supabase
        .from("contacts")
        .update({ ghl_contact_id: ghlContactId })
        .eq("id", contact.id);
      if (updateError) {
        console.error("Failed to persist real GHL id after upsert:", updateError.message);
      }
    }

    if (!ghlContactId) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const note = await ghl.addNote(ghlContactId, noteBody);
    return NextResponse.json({ note });
  } catch (err) {
    console.error("Add note failed:", err);
    return NextResponse.json({ error: "Failed to add note" }, { status: 500 });
  }
}
