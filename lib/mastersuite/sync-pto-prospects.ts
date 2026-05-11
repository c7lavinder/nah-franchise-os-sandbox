/**
 * Sync new PathToOwnershipEntries from MasterSuite into Supabase.
 *
 * New prospects go into Path to Ownership → Engagement.
 * Existing contacts (matched by email) are skipped.
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
): Promise<{ created: number; skipped: number; errors: string[] }> {
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

  // Get existing contact emails
  const existingEmails = new Set<string>();
  const allEmails = [...new Set(ptoRows.map((r) => r.EmailAddress.toLowerCase().trim()))];

  for (let i = 0; i < allEmails.length; i += 200) {
    const batch = allEmails.slice(i, i + 200);
    const { data } = await sb.from("contacts").select("email").in("email", batch);
    for (const c of (data || []) as { email: string }[]) {
      if (c.email) existingEmails.add(c.email.toLowerCase().trim());
    }
  }

  // Filter and deduplicate
  const seenEmails = new Set<string>();
  const toImport = ptoRows.filter((r) => {
    const email = r.EmailAddress.toLowerCase().trim();
    if (existingEmails.has(email) || seenEmails.has(email)) return false;
    if (SPAM_EMAIL_PATTERNS.some((p) => p.test(email))) return false;
    if (isSpamName(r.FirstName, r.LastName)) return false;
    if (r.FirstName.length > 12 && !/\s/.test(r.FirstName) && /[A-Z].*[a-z].*[A-Z]/.test(r.FirstName)) return false;
    if (r.LastName.length > 12 && !/\s/.test(r.LastName) && /[A-Z].*[a-z].*[A-Z]/.test(r.LastName)) return false;
    seenEmails.add(email);
    return true;
  });

  let created = 0;
  const skipped = ptoRows.length - toImport.length;

  for (const pto of toImport) {
    const name = `${pto.FirstName} ${pto.LastName}`.trim();
    const email = pto.EmailAddress.toLowerCase().trim();

    // Create contact
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

    const contactId = newContact.id;

    // Create journey
    const { data: newJourney, error: jErr } = await sb
      .from("journeys")
      .insert({ name, status: "active", primary_contact_id: contactId })
      .select("id")
      .single();

    if (jErr) {
      errors.push(`Journey for ${name}: ${jErr.message}`);
      continue;
    }

    // Journey contact
    await sb.from("journey_contacts").insert({
      journey_id: newJourney.id,
      contact_id: contactId,
      role: "primary",
      is_primary_decision_maker: true,
    });

    // Journey pipeline state → Path to Ownership → Engagement
    await sb.from("journey_pipeline_state").insert({
      journey_id: newJourney.id,
      TerritorySlug: null,
      pipeline_id: PTO_PIPELINE_ID,
      current_stage_id: ENGAGEMENT_STAGE_ID,
      is_active: true,
      entered_pipeline_at: toDateOrNull(pto.Inserted) || new Date().toISOString(),
      entered_current_stage_at: new Date().toISOString(),
    });

    created++;
  }

  return { created, skipped, errors };
}
