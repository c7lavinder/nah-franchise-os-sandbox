export const dynamic = "force-dynamic";

/**
 * GET /api/contacts/[contactId]
 *
 * Returns full contact details including notes, tasks, and message history.
 * Used by the ContactDetail slide-out panel.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";import * as ghl from "@/lib/ghl";
import { createServerClient } from "@/lib/supabase/server";
import { resolveContactId } from "@/lib/contacts/pipeline-state";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const { contactId: rawId } = await params;

  if (!rawId) {
    return NextResponse.json({ error: "contactId is required" }, { status: 400 });
  }

  // Accept either a local UUID or a GHL contact ID. GHL-facing calls need
  // the ghl_contact_id, so resolve up-front when we were handed the local
  // UUID (e.g. from /journeys/[id] which passes journey.primary_contact_id).
  let ghlContactId = rawId;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(rawId)) {
    const supabase = createServerClient();
    const { data: row } = await supabase
      .from("contacts").select("ghl_contact_id").eq("id", rawId).maybeSingle();
    if (row?.ghl_contact_id) ghlContactId = row.ghl_contact_id;
  }

  try {
    // Fetch all data in parallel
    const [contact, notes, tasks, messages] = await Promise.all([
      ghl.getContact(ghlContactId).catch(() => null),
      ghl.getNotes(ghlContactId).catch(() => []),
      ghl.getTasks(ghlContactId).catch(() => []),
      ghl.getContactHistory(ghlContactId).catch(() => []),
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
  // Territory + territory_slug intentionally removed — territory is now sourced
  // from journey_pipeline_state.territory_ms_slug, not a contact column.
  // EOS carry-forward moved to the pipeline advance/auto-advance paths where
  // a jps row first gets a non-null territory_ms_slug.
  const allowed = [
    "first_name", "last_name", "email", "phone",
    "city", "state",
    "legal_entity", "website",
    "franchise_fee", "royalty_pct", "term_months",
    "opportunity_source", "sub_source",
  ];

  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key];
  }
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "No fields" }, { status: 400 });

  // If the caller is updating the primary email via this endpoint, route it
  // through contact_emails so the multi-email table stays authoritative.
  // The trigger on contact_emails keeps contacts.email in sync.
  if (typeof updates.email === "string" && updates.email.trim().length > 0) {
    const newEmail = (updates.email as string).trim();
    await supabase.from("contact_emails").update({ is_primary: false })
      .eq("contact_id", localId).eq("is_primary", true);
    await supabase.from("contact_emails").upsert({
      contact_id: localId, email: newEmail, is_primary: true, source: "manual",
    }, { onConflict: "contact_id,email" });
    delete updates.email;
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from("contacts").update(updates).eq("id", localId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

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
