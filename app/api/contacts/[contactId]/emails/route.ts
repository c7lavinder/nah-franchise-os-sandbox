export const dynamic = "force-dynamic";

/**
 * Contact email-list endpoints.
 *
 * GET    /api/contacts/[contactId]/emails           — list all emails
 * POST   /api/contacts/[contactId]/emails           — add a new email
 * PATCH  /api/contacts/[contactId]/emails/:emailId  — flip primary / edit label
 * DELETE /api/contacts/[contactId]/emails/:emailId  — remove an email
 *
 * GHL stays in sync: after every mutation we push the full email set back
 * via updateContact({ email, additionalEmails }).
 */

import { NextRequest, NextResponse } from "next/server";
import * as ghl from "@/lib/ghl";
import { createServerClient } from "@/lib/supabase/server";
import { resolveContactId } from "@/lib/contacts/pipeline-state";

interface EmailRow {
  id: string;
  email: string;
  is_primary: boolean;
  label: string | null;
  source: string;
  created_at: string;
}

async function loadEmails(contactId: string): Promise<EmailRow[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("contact_emails")
    .select("id, email, is_primary, label, source, created_at")
    .eq("contact_id", contactId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as EmailRow[];
}

async function pushEmailsToGhl(contactId: string): Promise<void> {
  const supabase = createServerClient();
  const { data: contact } = await supabase
    .from("contacts").select("ghl_contact_id").eq("id", contactId).maybeSingle();
  if (!contact?.ghl_contact_id) return;

  const rows = await loadEmails(contactId);
  const primary = rows.find((r) => r.is_primary)?.email ?? undefined;
  const additional = rows.filter((r) => !r.is_primary).map((r) => r.email);

  try {
    await ghl.updateContact(contact.ghl_contact_id, {
      ...(primary ? { email: primary } : {}),
      additionalEmails: additional,
    });
  } catch (err) {
    console.error("[contact-emails] GHL sync failed:", err instanceof Error ? err.message : err);
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> },
) {
  const { contactId: rawId } = await params;
  const localId = await resolveContactId(rawId);
  if (!localId) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  const emails = await loadEmails(localId);
  return NextResponse.json({ emails });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> },
) {
  const { contactId: rawId } = await params;
  const localId = await resolveContactId(rawId);
  if (!localId) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  const body = (await request.json()) as { email?: string; label?: string; makePrimary?: boolean };
  const email = (body.email ?? "").trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const supabase = createServerClient();

  if (body.makePrimary) {
    // Unset any existing primary first — the unique partial index forbids two.
    await supabase
      .from("contact_emails").update({ is_primary: false })
      .eq("contact_id", localId).eq("is_primary", true);
  }

  // Idempotent insert — if this email is already on the contact, return the
  // existing row id instead of 409ing. Lets call-mapping flows auto-add
  // participant emails without the client having to check first.
  const { data: existing } = await supabase
    .from("contact_emails")
    .select("id")
    .eq("contact_id", localId)
    .eq("email", email)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ id: existing.id, alreadyExisted: true });
  }

  const { data, error } = await supabase
    .from("contact_emails")
    .insert({
      contact_id: localId,
      email,
      is_primary: body.makePrimary ?? false,
      label: body.label ?? null,
      source: body.label === "auto" ? "manual" : "manual",
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await pushEmailsToGhl(localId);
  return NextResponse.json({ id: data.id });
}
