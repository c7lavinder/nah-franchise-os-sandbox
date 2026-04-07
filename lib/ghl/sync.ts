/**
 * GHL Contact Sync — upserts GHL contact data into the local contacts table.
 *
 * Per §1.18 of MASTER_PLAN.md: fields brought over from GHL include
 * name, address, contact info, opportunity source, and notes.
 *
 * The contacts table uses ghl_contact_id as the unique sync key.
 */

import { createServerClient } from "@/lib/supabase/server";

/** Minimal GHL contact shape needed for sync */
export interface GHLContactForSync {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
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

  const contactData = {
    ghl_contact_id: ghlContact.id,
    first_name: ghlContact.firstName ?? null,
    last_name: ghlContact.lastName ?? null,
    email: ghlContact.email ?? null,
    phone: ghlContact.phone ?? null,
    address: ghlContact.address1 ?? null,
    city: ghlContact.city ?? null,
    state: ghlContact.state ?? null,
    zip: ghlContact.postalCode ?? null,
    opportunity_source: ghlContact.source ?? null,
    last_synced_at: new Date().toISOString(),
  };

  // Sprint 2: upsert by ghl_contact_id — insert new or update existing
  const { data, error } = await supabase
    .from("contacts")
    .upsert(contactData, { onConflict: "ghl_contact_id" })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Contact sync failed for GHL ID ${ghlContact.id}: ${error.message}`);
  }

  return data.id;
}
