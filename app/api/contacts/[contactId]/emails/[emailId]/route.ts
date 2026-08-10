export const dynamic = "force-dynamic";

/**
 * PATCH /api/contacts/[contactId]/emails/[emailId]
 *   Body: { makePrimary?: boolean; label?: string | null }
 *
 * DELETE /api/contacts/[contactId]/emails/[emailId]
 *   Removes one email. The trigger in the DB promotes the next oldest row
 *   to primary if the deleted row was primary, keeping contacts.email
 *   non-null as long as any email remains.
 *
 * Both mutations push the resulting email set back to GHL.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import * as ghl from "@/lib/ghl";
import { createServerClient } from "@/lib/supabase/server";
import { resolveContactId } from "@/lib/contacts/pipeline-state";

async function pushEmailsToGhl(contactId: string): Promise<void> {
  const supabase = createServerClient();
  const { data: contact } = await supabase.from("contacts").select("ghl_contact_id").eq("id", contactId).maybeSingle();
  if (!contact?.ghl_contact_id) return;

  const { data: rows } = await supabase
    .from("contact_emails")
    .select("email, is_primary")
    .eq("contact_id", contactId)
    .order("is_primary", { ascending: false });

  const primary = rows?.find((r) => r.is_primary)?.email ?? undefined;
  const additional = (rows ?? []).filter((r) => !r.is_primary).map((r) => r.email);

  try {
    await ghl.updateContact(contact.ghl_contact_id, {
      ...(primary ? { email: primary } : {}),
      additionalEmails: additional,
    });
  } catch (err) {
    console.error("[contact-emails] GHL sync failed:", err instanceof Error ? err.message : err);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string; emailId: string }> }
) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const { contactId: rawId, emailId } = await params;
  const localId = await resolveContactId(rawId);
  if (!localId) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  const body = (await request.json()) as { makePrimary?: boolean; label?: string | null };
  const supabase = createServerClient();

  if (body.makePrimary === true) {
    // Unset the current primary first so the partial unique index is happy.
    await supabase
      .from("contact_emails")
      .update({ is_primary: false })
      .eq("contact_id", localId)
      .eq("is_primary", true);
  }

  const updates: Record<string, unknown> = {};
  if (body.makePrimary !== undefined) updates.is_primary = body.makePrimary;
  if (body.label !== undefined) updates.label = body.label;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields" }, { status: 400 });
  }

  const { error } = await supabase.from("contact_emails").update(updates).eq("id", emailId).eq("contact_id", localId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await pushEmailsToGhl(localId);
  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string; emailId: string }> }
) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const { contactId: rawId, emailId } = await params;
  const localId = await resolveContactId(rawId);
  if (!localId) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  const supabase = createServerClient();
  const { error } = await supabase.from("contact_emails").delete().eq("id", emailId).eq("contact_id", localId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await pushEmailsToGhl(localId);
  return NextResponse.json({ success: true });
}
