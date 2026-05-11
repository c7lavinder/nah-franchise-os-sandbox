/**
 * Sync new PathToOwnershipEntries from MasterSuite into Supabase.
 *
 * New prospects go into Path to Ownership → Engagement.
 * Existing contacts with no Sales pipeline journey get wired up too.
 */
import { queryMS } from "./client";
import { getServiceSupabase } from "./supabase";

const PTO_PIPELINE_ID = "a0000000-0000-0000-0000-000000000001"; // Path to Ownership
const ENGAGEMENT_STAGE_ID = "b0000000-0000-0000-0000-000000000001"; // Engagement

interface PTORow {
  Id: number;
  Inserted: string;
  PtoSubmissionDate: string | null;
  FirstName: string;
  LastName: string;
  PreferredName: string | null;
  PhoneNumber: string | null;
  EmailAddress: string;
  StreetAddress: string | null;
  City: string | null;
  State: string | null;
  Zip: string | null;
  CountiesInterestedIn: string | null;
  PartnerName: string | null;
  PartnerPhone: string | null;
  PartnerEmail: string | null;
  PartnerOccupation: string | null;
  BriefWorkHistory: string | null;
  WhatInterestsInOpportunity: string | null;
  PreferredWeeklyHours: number | null;
  NonRetirementCapitalAvailable: number | null;
  NonRetirementCapitalAvailableSource: string | null;
  RetirementFundsRollingOver: number | null;
  LeadSource: string | null;
  ReferredBy: string | null;
}

function generatePtoGhlId(ptoId: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let rand = "";
  for (let i = 0; i < 8; i++) rand += chars[Math.floor(Math.random() * chars.length)];
  return `pto_${ptoId}_${rand}`;
}

function toDateOrNull(val: string | null | undefined): string | null {
  if (!val) return null;
  const d = new Date(val);
  if (isNaN(d.getTime()) || d.getFullYear() < 2000) return null;
  return d.toISOString();
}

function isSpamName(first: string, last: string): boolean {
  const name = `${first} ${last}`;
  if (/^(Alice|John|MyName|Hello)\s+(Alice|John|MyName|Hello)$/i.test(name)) return true;
  if (/^[bcdfghjklmnpqrstvwxyz]{5,}$/i.test(first)) return true;
  if (/^[bcdfghjklmnpqrstvwxyz]{5,}$/i.test(last)) return true;
  for (const part of [first, last]) {
    if (part.length < 6) continue;
    const upperCount = (part.match(/[A-Z]/g) || []).length;
    const lowerCount = (part.match(/[a-z]/g) || []).length;
    if (upperCount >= 3 && lowerCount >= 3) return true;
    if (part.length > 8 && /[a-z][A-Z]/.test(part) && upperCount >= 2) return true;
  }
  if (/iphone|claim free/i.test(first + last)) return true;
  return false;
}

const SPAM_EMAIL_PATTERNS = [/do-not-respond/i, /serviseantilogin/i, /mailbox\.in\.ua/i, /^test@/i];

export async function syncPtoProspects(
  since?: string
): Promise<{ created: number; wired: number; skipped: number; errors: string[] }> {
  const sb = getServiceSupabase();
  const errors: string[] = [];

  // Build query — optionally filter by Inserted date for incremental sync
  let whereClause = `
    WHERE FirstName NOT LIKE '%test%' AND LastName NOT LIKE '%test%'
      AND EmailAddress IS NOT NULL AND EmailAddress != ''
      AND EmailAddress NOT LIKE '%newagainhouses.com'
      AND EmailAddress NOT LIKE '%@test%'
      AND LENGTH(EmailAddress) > 5
      AND EmailAddress LIKE '%@%.%'
  `;
  const params: string[] = [];
  if (since) {
    whereClause += " AND Inserted > ?";
    params.push(since);
  }

  const ptoRows = await queryMS<PTORow>(
    `SELECT * FROM PathToOwnershipEntries ${whereClause} ORDER BY Inserted DESC`,
    params.length > 0 ? params : undefined
  );

  // Get existing contacts by email (id + email so we can wire up orphans)
  const existingContactsByEmail = new Map<string, string>(); // email → contact id
  const allEmails = [...new Set(ptoRows.map((r) => r.EmailAddress.toLowerCase().trim()))];

  for (let i = 0; i < allEmails.length; i += 200) {
    const batch = allEmails.slice(i, i + 200);
    const { data } = await sb.from("contacts").select("id, email").in("email", batch);
    for (const c of (data || []) as { id: string; email: string }[]) {
      if (c.email) existingContactsByEmail.set(c.email.toLowerCase().trim(), c.id);
    }
  }

  // Find which existing contacts already have an active Sales pipeline journey
  const existingContactIds = [...existingContactsByEmail.values()];
  const contactsWithSalesJPS = new Set<string>(); // contact ids that already have Sales JPS
  for (let i = 0; i < existingContactIds.length; i += 200) {
    const batch = existingContactIds.slice(i, i + 200);
    const { data } = await sb
      .from("journeys")
      .select("primary_contact_id, journey_pipeline_state!inner(pipeline_id)")
      .in("primary_contact_id", batch)
      .eq("journey_pipeline_state.pipeline_id", PTO_PIPELINE_ID)
      .eq("journey_pipeline_state.is_active", true);
    for (const j of (data || []) as { primary_contact_id: string }[]) {
      contactsWithSalesJPS.add(j.primary_contact_id);
    }
  }

  // Split PTO rows into: new contacts, existing contacts needing wiring, and fully-done
  const seenEmails = new Set<string>();
  const toCreate: PTORow[] = [];
  const toWire: { pto: PTORow; contactId: string }[] = [];

  for (const r of ptoRows) {
    const email = r.EmailAddress.toLowerCase().trim();
    if (seenEmails.has(email)) continue;
    if (SPAM_EMAIL_PATTERNS.some((p) => p.test(email))) continue;
    if (isSpamName(r.FirstName, r.LastName)) continue;
    if (r.FirstName.length > 12 && !/\s/.test(r.FirstName) && /[A-Z].*[a-z].*[A-Z]/.test(r.FirstName)) continue;
    if (r.LastName.length > 12 && !/\s/.test(r.LastName) && /[A-Z].*[a-z].*[A-Z]/.test(r.LastName)) continue;
    seenEmails.add(email);

    const existingId = existingContactsByEmail.get(email);
    if (!existingId) {
      toCreate.push(r);
    } else if (!contactsWithSalesJPS.has(existingId)) {
      toWire.push({ pto: r, contactId: existingId });
    }
    // else: fully wired, skip
  }

  let created = 0;
  let wired = 0;
  const skipped = ptoRows.length - toCreate.length - toWire.length;

  // --- Create brand-new contacts + journey + JPS ---
  for (const pto of toCreate) {
    const name = `${pto.FirstName} ${pto.LastName}`.trim();
    const email = pto.EmailAddress.toLowerCase().trim();

    const { data: newContact, error: cErr } = await sb
      .from("contacts")
      .insert({
        ghl_contact_id: generatePtoGhlId(pto.Id),
        first_name: pto.FirstName,
        last_name: pto.LastName,
        email,
        phone: pto.PhoneNumber || null,
        address: pto.StreetAddress || null,
        city: pto.City || null,
        state: pto.State || null,
        zip: pto.Zip || null,
        source: "pto",
        CountiesInterestedIn: pto.CountiesInterestedIn || null,
        PartnerName: pto.PartnerName || null,
        PartnerPhone: pto.PartnerPhone || null,
        PartnerEmail: pto.PartnerEmail || null,
        PartnerOccupation: pto.PartnerOccupation || null,
        BriefWorkHistory: pto.BriefWorkHistory || null,
        WhatInterestsInOpportunity: pto.WhatInterestsInOpportunity || null,
        PreferredName: pto.PreferredName || null,
        PreferredWeeklyHours: pto.PreferredWeeklyHours || null,
        NonRetirementCapitalAvailable: pto.NonRetirementCapitalAvailable || null,
        NonRetirementCapitalAvailableSource: pto.NonRetirementCapitalAvailableSource || null,
        RetirementFundsRollingOver: pto.RetirementFundsRollingOver || null,
        LeadSource: pto.LeadSource || null,
        ReferredBy: pto.ReferredBy || null,
        PtoSubmissionDate: toDateOrNull(pto.PtoSubmissionDate as string),
      })
      .select("id")
      .single();

    if (cErr) {
      errors.push(`${name} (${email}): ${cErr.message}`);
      continue;
    }

    const err = await createJourneyAndJPS(sb, newContact.id, name, pto, errors);
    if (!err) created++;
  }

  // --- Wire existing contacts that have no Sales pipeline journey ---
  for (const { pto, contactId } of toWire) {
    const name = `${pto.FirstName} ${pto.LastName}`.trim();
    const err = await createJourneyAndJPS(sb, contactId, name, pto, errors);
    if (!err) wired++;
  }

  return { created, wired, skipped, errors };
}

/** Create journey + journey_contact + JPS for a contact. Returns true on error. */
async function createJourneyAndJPS(
  sb: ReturnType<typeof getServiceSupabase>,
  contactId: string,
  name: string,
  pto: PTORow,
  errors: string[]
): Promise<boolean> {
  const { data: newJourney, error: jErr } = await sb
    .from("journeys")
    .insert({ name, status: "active", primary_contact_id: contactId })
    .select("id")
    .single();

  if (jErr) {
    errors.push(`Journey for ${name}: ${jErr.message}`);
    return true;
  }

  const { error: jcErr } = await sb.from("journey_contacts").insert({
    journey_id: newJourney.id,
    contact_id: contactId,
    role: "primary",
    is_primary_decision_maker: true,
  });
  if (jcErr) {
    errors.push(`Journey contact for ${name}: ${jcErr.message}`);
    return true;
  }

  const { error: jpsErr } = await sb.from("journey_pipeline_state").insert({
    journey_id: newJourney.id,
    TerritorySlug: null,
    pipeline_id: PTO_PIPELINE_ID,
    current_stage_id: ENGAGEMENT_STAGE_ID,
    is_active: true,
    entered_pipeline_at: toDateOrNull(pto.Inserted) || new Date().toISOString(),
    entered_current_stage_at: new Date().toISOString(),
  });
  if (jpsErr) {
    errors.push(`Pipeline state for ${name}: ${jpsErr.message}`);
    return true;
  }

  return false;
}
