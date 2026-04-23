/**
 * GHL Contact Sync — upserts GHL contact data into the local contacts table.
 *
 * Per §1.18 of MASTER_PLAN.md: fields brought over from GHL include
 * name, address, contact info, opportunity source, and notes.
 *
 * The contacts table uses ghl_contact_id as the unique sync key.
 *
 * Emails: GHL supports multiple emails per contact (primary `email` +
 * `additionalEmails[]`). We mirror both into our contact_emails table,
 * with the primary marked is_primary=true. The contact_emails trigger
 * keeps contacts.email in sync with whatever row is primary.
 */

import { createServerClient } from "@/lib/supabase/server";

/** Minimal GHL contact shape needed for sync */
export interface GHLContactForSync {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  /** Non-primary emails carried on the GHL contact. */
  additionalEmails?: string[] | null;
  phone?: string | null;
  address1?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  source?: string | null;
  tags?: string[];
  dateAdded?: string | null;
  customFields?: Array<{ id: string; value: string }>;
}

/**
 * Upserts a GHL contact into the local contacts table.
 * Returns the local contact UUID.
 */
export async function syncContactFromGhl(ghlContact: GHLContactForSync): Promise<string> {
  const supabase = createServerClient();

  const primaryEmail = normalize(ghlContact.email);
  const contactData = {
    ghl_contact_id: ghlContact.id,
    first_name: ghlContact.firstName ?? null,
    last_name: ghlContact.lastName ?? null,
    email: primaryEmail,
    phone: ghlContact.phone ?? null,
    address: ghlContact.address1 ?? null,
    city: ghlContact.city ?? null,
    state: ghlContact.state ?? null,
    zip: ghlContact.postalCode ?? null,
    opportunity_source: ghlContact.source ?? null,
    last_synced_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("contacts")
    .upsert(contactData, { onConflict: "ghl_contact_id" })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Contact sync failed for GHL ID ${ghlContact.id}: ${error.message}`);
  }

  const contactId = data.id;

  // Mirror the primary + additional emails into contact_emails.
  await syncEmailRows(contactId, primaryEmail, ghlContact.additionalEmails ?? []);

  return contactId;
}

function normalize(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim();
  return t.length === 0 ? null : t;
}

/**
 * Ensures contact_emails contains the primary + additional emails for this
 * contact, with exactly the primary marked is_primary=true. Existing rows
 * not present in the incoming set are left alone — we only add/flip, never
 * delete. Users can remove emails through the UI.
 */
async function syncEmailRows(
  contactId: string,
  primary: string | null,
  additional: string[],
): Promise<void> {
  const supabase = createServerClient();

  const cleanAdditional = additional
    .map((e) => normalize(e))
    .filter((e): e is string => e !== null && e.toLowerCase() !== primary?.toLowerCase());

  if (!primary && cleanAdditional.length === 0) return;

  const { data: existingRows } = await supabase
    .from("contact_emails")
    .select("id, email, is_primary")
    .eq("contact_id", contactId);

  const existingByLower = new Map<string, { id: string; is_primary: boolean }>();
  for (const r of existingRows ?? []) {
    existingByLower.set(r.email.toLowerCase(), { id: r.id, is_primary: r.is_primary });
  }

  // Flip primary: unset anyone currently marked primary that isn't our new primary.
  if (primary) {
    const keepId = existingByLower.get(primary.toLowerCase())?.id;
    const toUnset = (existingRows ?? [])
      .filter((r) => r.is_primary && r.id !== keepId)
      .map((r) => r.id);
    if (toUnset.length > 0) {
      await supabase.from("contact_emails").update({ is_primary: false }).in("id", toUnset);
    }
  }

  // Upsert the primary as is_primary=true.
  if (primary) {
    const existing = existingByLower.get(primary.toLowerCase());
    if (existing) {
      if (!existing.is_primary) {
        await supabase.from("contact_emails").update({ is_primary: true, source: "ghl" }).eq("id", existing.id);
      }
    } else {
      await supabase.from("contact_emails").insert({
        contact_id: contactId, email: primary, is_primary: true, source: "ghl",
      });
    }
  }

  // Insert missing secondaries as is_primary=false.
  const toInsert = cleanAdditional
    .filter((email) => !existingByLower.has(email.toLowerCase()))
    .map((email) => ({ contact_id: contactId, email, is_primary: false, source: "ghl" }));
  if (toInsert.length > 0) {
    await supabase.from("contact_emails").insert(toInsert);
  }
}
