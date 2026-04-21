/**
 * Journey helpers used by the small set of routes that create new contact
 * pipeline entries (contacts/create, ghl/auto-create-pipeline-state).
 *
 * Phase 4 final: the dual-write sync (syncJourneyForContact) and the
 * resolveJpsIdForCps translation helper are gone — every writer now
 * targets journey_pipeline_state directly. This file is now just the
 * "make sure this contact has a journey" primitive.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { slugifyBase } from "@/lib/journeys/slug";

type SB = SupabaseClient;

/** Generate a unique slug for a new journey. Falls through to "journey-<n>"
 *  suffixing if the base collides. Capped at 100 tries to avoid a runaway
 *  loop; extreme collisions return the base with a short random suffix. */
async function generateUniqueSlug(supabase: SB, base: string): Promise<string> {
  const cleaned = slugifyBase(base) || "journey";
  const { data: existing } = await supabase
    .from("journeys").select("slug").like("slug", `${cleaned}%`);
  const taken = new Set((existing ?? []).map((r: { slug: string | null }) => r.slug).filter(Boolean));
  if (!taken.has(cleaned)) return cleaned;
  for (let i = 2; i < 100; i++) {
    const candidate = `${cleaned}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${cleaned}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Find or create a journey for the contact. Returns journey id. */
export async function ensureJourneyForContact(supabase: SB, contactId: string): Promise<string | null> {
  const { data: existing } = await supabase
    .from("journeys")
    .select("id")
    .eq("primary_contact_id", contactId)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: contact } = await supabase
    .from("contacts")
    .select("first_name, last_name, email")
    .eq("id", contactId)
    .maybeSingle();
  const name = `${contact?.first_name ?? ""} ${contact?.last_name ?? ""}`.trim()
    || contact?.email
    || "Unnamed";
  const slug = await generateUniqueSlug(supabase, name);

  const { data: journey, error } = await supabase
    .from("journeys")
    .insert({ primary_contact_id: contactId, name, slug, status: "active" })
    .select("id")
    .single();
  if (error || !journey) {
    console.error("[journeys.sync] failed to create journey for contact", contactId, error?.message);
    return null;
  }

  const { error: memberErr } = await supabase
    .from("journey_contacts")
    .insert({ journey_id: journey.id, contact_id: contactId, role: "primary" });
  if (memberErr && !memberErr.message.includes("uniq_active_journey_contact")) {
    console.warn("[journeys.sync] primary membership insert warn:", memberErr.message);
  }

  return journey.id;
}

/** Lookup helper: returns the active journey id for a contact (as primary). */
export async function resolveJourneyIdForContact(supabase: SB, contactId: string | null): Promise<string | null> {
  if (!contactId) return null;
  const { data } = await supabase
    .from("journeys")
    .select("id")
    .eq("primary_contact_id", contactId)
    .maybeSingle();
  return data?.id ?? null;
}
