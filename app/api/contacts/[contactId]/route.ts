export const dynamic = "force-dynamic";

/**
 * GET /api/contacts/[contactId]
 *
 * Returns full contact details including notes, tasks, and message history.
 * Used by the ContactDetail slide-out panel.
 */

import { NextRequest, NextResponse } from "next/server";
import * as ghl from "@/lib/ghl";
import { createServerClient } from "@/lib/supabase/server";
import { resolveContactId } from "@/lib/contacts/pipeline-state";

export async function GET(
  _request: NextRequest,
  { params }: { params: { contactId: string } }
) {
  const { contactId } = params;

  if (!contactId) {
    return NextResponse.json({ error: "contactId is required" }, { status: 400 });
  }

  try {
    // Fetch all data in parallel
    const [contact, notes, tasks, messages] = await Promise.all([
      ghl.getContact(contactId).catch(() => null),
      ghl.getNotes(contactId).catch(() => []),
      ghl.getTasks(contactId).catch(() => []),
      ghl.getContactHistory(contactId).catch(() => []),
    ]);

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    return NextResponse.json({
      contact,
      notes,
      tasks,
      messages,
    });
  } catch (err) {
    console.error("Contact detail fetch failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch contact details" },
      { status: 502 }
    );
  }
}

/**
 * PATCH /api/contacts/[contactId]
 * Updates contact fields in Supabase (territory, deal details, basic info).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const { contactId: rawId } = await params;
  const supabase = createServerClient();
  const localId = await resolveContactId(rawId);
  if (!localId) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  const body = await request.json() as Record<string, unknown>;
  const allowed = [
    "first_name", "last_name", "email", "phone",
    "city", "state",
    "territory", "territory_slug", "legal_entity", "website",
    "franchise_fee", "royalty_pct", "term_months",
    "opportunity_source", "sub_source",
  ];

  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key];
  }
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "No fields" }, { status: 400 });

  const { error } = await supabase.from("contacts").update(updates).eq("id", localId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Sync GHL-relevant fields back to GHL
  const ghlFields: Record<string, string> = {};
  if (updates.first_name) ghlFields.firstName = updates.first_name as string;
  if (updates.last_name) ghlFields.lastName = updates.last_name as string;
  if (updates.email) ghlFields.email = updates.email as string;
  if (updates.phone) ghlFields.phone = updates.phone as string;
  if (updates.city) ghlFields.city = updates.city as string;
  if (updates.state) ghlFields.state = updates.state as string;

  if (Object.keys(ghlFields).length > 0) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("ghl_contact_id")
      .eq("id", localId)
      .single();

    if (contact?.ghl_contact_id) {
      try {
        await ghl.updateContact(contact.ghl_contact_id, ghlFields);
      } catch (err) {
        console.error("[contacts/PATCH] GHL sync failed:", err instanceof Error ? err.message : err);
      }
    }
  }

  return NextResponse.json({ success: true });
}
