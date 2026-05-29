/**
 * Unified prospect sync — pulls from BOTH MasterSuite sources in one pass:
 *   1. PathToOwnershipEntries (PTO form)
 *   2. NewAgainHouses_FormSubmissions WHERE FormType = 'FRANCHISE_REQUEST'
 *
 * Single email dedup across both sources prevents duplicates.
 * New prospects get: contact + journey + journey_pipeline_state in Sales → Engagement.
 * Existing contacts without an active Sales journey get wired up.
 */
import { queryMS } from "./client";
import { getServiceSupabase } from "./supabase";

const SALES_PIPELINE_ID = "a0000000-0000-0000-0000-000000000001";
const ENGAGEMENT_STAGE_ID = "b0000000-0000-0000-0000-000000000001";
const OUTREACH_SUB_TASK_ID = "8ea993c2-4de4-452e-8f22-7b64a543415d";

// ---------------------------------------------------------------------------
// Normalized prospect — common shape from both sources
// ---------------------------------------------------------------------------

interface Prospect {
  /** Deterministic ID to prevent re-processing: pto_{id} or franchise_req_{id} */
  ghlContactId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  source: "pto" | "franchise_request";
  insertedAt: string;
  /** Extra PTO fields (null for franchise requests) */
  ptoFields: {
    CountiesInterestedIn: string | null;
    PartnerName: string | null;
    PartnerPhone: string | null;
    PartnerEmail: string | null;
    PartnerOccupation: string | null;
    BriefWorkHistory: string | null;
    WhatInterestsInOpportunity: string | null;
    PreferredName: string | null;
    PreferredWeeklyHours: number | null;
    NonRetirementCapitalAvailable: number | null;
    NonRetirementCapitalAvailableSource: string | null;
    RetirementFundsRollingOver: number | null;
    LeadSource: string | null;
    ReferredBy: string | null;
    PtoSubmissionDate: string | null;
  } | null;
  /** Extra franchise request fields (null for PTO) */
  franchiseFields: {
    LeadSource: string | null;
    notes: string | null;
  } | null;
}

// ---------------------------------------------------------------------------
// Spam filters
// ---------------------------------------------------------------------------

const SPAM_EMAIL_PATTERNS = [/do-not-respond/i, /serviseantilogin/i, /mailbox\.in\.ua/i, /^test@/i];

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

function isSpam(p: Prospect): boolean {
  if (p.email && SPAM_EMAIL_PATTERNS.some((pat) => pat.test(p.email!))) return true;
  if (isSpamName(p.firstName, p.lastName)) return true;
  for (const part of [p.firstName, p.lastName]) {
    if (part.length > 12 && !/\s/.test(part) && /[A-Z].*[a-z].*[A-Z]/.test(part)) return true;
  }
  return false;
}

function toDateOrNull(val: string | null | undefined): string | null {
  if (!val) return null;
  const d = new Date(val);
  if (isNaN(d.getTime()) || d.getFullYear() < 2000) return null;
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Fetch from both MasterSuite tables → normalize into Prospect[]
// ---------------------------------------------------------------------------

async function fetchProspects(since?: string): Promise<Prospect[]> {
  // --- PTO entries ---
  let ptoWhere = `
    WHERE FirstName NOT LIKE '%test%' AND LastName NOT LIKE '%test%'
      AND EmailAddress IS NOT NULL AND EmailAddress != ''
      AND EmailAddress NOT LIKE '%newagainhouses.com'
      AND EmailAddress NOT LIKE '%@test%'
      AND LENGTH(EmailAddress) > 5
      AND EmailAddress LIKE '%@%.%'
  `;
  const ptoParams: string[] = [];
  if (since) {
    ptoWhere += " AND Inserted > ?";
    ptoParams.push(since);
  }

  const ptoRows = await queryMS<Record<string, unknown>>(
    `SELECT Id, Inserted, PtoSubmissionDate, FirstName, LastName, PreferredName,
            PhoneNumber, EmailAddress, StreetAddress, City, State, Zip,
            CountiesInterestedIn, PartnerName, PartnerPhone, PartnerEmail,
            PartnerOccupation, BriefWorkHistory, WhatInterestsInOpportunity,
            PreferredWeeklyHours, NonRetirementCapitalAvailable,
            NonRetirementCapitalAvailableSource, RetirementFundsRollingOver,
            LeadSource, ReferredBy
     FROM PathToOwnershipEntries ${ptoWhere} ORDER BY Inserted DESC`,
    ptoParams.length > 0 ? ptoParams : undefined
  );

  const ptoProspects: Prospect[] = ptoRows.map((r) => ({
    ghlContactId: `pto_${r.Id}`,
    firstName: String(r.FirstName ?? "").trim(),
    lastName: String(r.LastName ?? "").trim(),
    email: r.EmailAddress ? String(r.EmailAddress).toLowerCase().trim() : null,
    phone: r.PhoneNumber ? String(r.PhoneNumber) : null,
    address: r.StreetAddress ? String(r.StreetAddress) : null,
    city: r.City ? String(r.City) : null,
    state: r.State ? String(r.State) : null,
    zip: r.Zip ? String(r.Zip) : null,
    source: "pto" as const,
    insertedAt: String(r.Inserted),
    ptoFields: {
      CountiesInterestedIn: r.CountiesInterestedIn ? String(r.CountiesInterestedIn) : null,
      PartnerName: r.PartnerName ? String(r.PartnerName) : null,
      PartnerPhone: r.PartnerPhone ? String(r.PartnerPhone) : null,
      PartnerEmail: r.PartnerEmail ? String(r.PartnerEmail) : null,
      PartnerOccupation: r.PartnerOccupation ? String(r.PartnerOccupation) : null,
      BriefWorkHistory: r.BriefWorkHistory ? String(r.BriefWorkHistory) : null,
      WhatInterestsInOpportunity: r.WhatInterestsInOpportunity ? String(r.WhatInterestsInOpportunity) : null,
      PreferredName: r.PreferredName ? String(r.PreferredName) : null,
      PreferredWeeklyHours: r.PreferredWeeklyHours != null ? Number(r.PreferredWeeklyHours) : null,
      NonRetirementCapitalAvailable:
        r.NonRetirementCapitalAvailable != null ? Number(r.NonRetirementCapitalAvailable) : null,
      NonRetirementCapitalAvailableSource: r.NonRetirementCapitalAvailableSource
        ? String(r.NonRetirementCapitalAvailableSource)
        : null,
      RetirementFundsRollingOver: r.RetirementFundsRollingOver != null ? Number(r.RetirementFundsRollingOver) : null,
      LeadSource: r.LeadSource ? String(r.LeadSource) : null,
      ReferredBy: r.ReferredBy ? String(r.ReferredBy) : null,
      PtoSubmissionDate: r.PtoSubmissionDate ? String(r.PtoSubmissionDate) : null,
    },
    franchiseFields: null,
  }));

  // --- Franchise request forms ---
  let frWhere = `
    WHERE FormType = 'FRANCHISE_REQUEST'
      AND FormStatus = 'COMPLETE'
      AND FirstName IS NOT NULL AND FirstName != ''
      AND LastName IS NOT NULL AND LastName != ''
  `;
  const frParams: string[] = [];
  if (since) {
    frWhere += " AND Inserted > ?";
    frParams.push(since);
  }

  const frRows = await queryMS<Record<string, unknown>>(
    `SELECT FormSubmissionId, Inserted, FirstName, LastName,
            PersonalCity, PersonalState, PersonalZip, Phone, Email, Comments,
            utmSource, utmMedium, utmCampaign
     FROM NewAgainHouses_FormSubmissions ${frWhere} ORDER BY Inserted DESC`,
    frParams.length > 0 ? frParams : undefined
  );

  const frProspects: Prospect[] = frRows.map((r) => {
    const utmParts = [r.utmSource, r.utmMedium, r.utmCampaign].filter(Boolean).map(String);
    return {
      ghlContactId: `franchise_req_${r.FormSubmissionId}`,
      firstName: String(r.FirstName ?? "").trim(),
      lastName: String(r.LastName ?? "").trim(),
      email: r.Email ? String(r.Email).toLowerCase().trim() : null,
      phone: r.Phone ? String(r.Phone) : null,
      address: null,
      city: r.PersonalCity ? String(r.PersonalCity) : null,
      state: r.PersonalState ? String(r.PersonalState) : null,
      zip: r.PersonalZip ? String(r.PersonalZip) : null,
      source: "franchise_request" as const,
      insertedAt: String(r.Inserted),
      ptoFields: null,
      franchiseFields: {
        LeadSource: utmParts.length > 0 ? utmParts.join(" / ") : "Direct",
        notes: r.Comments ? String(r.Comments) : null,
      },
    };
  });

  // PTO first (richer data), then franchise requests
  return [...ptoProspects, ...frProspects];
}

// ---------------------------------------------------------------------------
// Main sync
// ---------------------------------------------------------------------------

export async function syncProspects(
  since?: string
): Promise<{ created: number; wired: number; skipped: number; errors: string[]; sourceCursor: string | null }> {
  const sb = getServiceSupabase();
  const errors: string[] = [];

  const allProspects = await fetchProspects(since);
  const sourceCursor = allProspects.reduce<string | null>((latest, prospect) => {
    const candidate = toDateOrNull(prospect.insertedAt);
    if (!candidate) return latest;
    if (!latest) return candidate;
    return new Date(candidate).getTime() > new Date(latest).getTime() ? candidate : latest;
  }, null);

  // Collect all emails and deterministic IDs for batch dedup
  const allEmails = [...new Set(allProspects.filter((p) => p.email && p.email.length > 5).map((p) => p.email!))];
  const allGhlIds = allProspects.map((p) => p.ghlContactId);

  // Batch lookup: existing contacts by email
  const existingByEmail = new Map<string, string>();
  for (let i = 0; i < allEmails.length; i += 200) {
    const batch = allEmails.slice(i, i + 200);
    const { data } = await sb.from("contacts").select("id, email").in("email", batch);
    for (const c of (data || []) as { id: string; email: string }[]) {
      if (c.email) existingByEmail.set(c.email.toLowerCase().trim(), c.id);
    }
  }

  // Batch lookup: existing contacts by deterministic ghl_contact_id
  const existingByGhlId = new Set<string>();
  for (let i = 0; i < allGhlIds.length; i += 200) {
    const batch = allGhlIds.slice(i, i + 200);
    const { data } = await sb.from("contacts").select("ghl_contact_id").in("ghl_contact_id", batch);
    for (const c of (data || []) as { ghl_contact_id: string }[]) {
      existingByGhlId.add(c.ghl_contact_id);
    }
  }

  // Batch lookup: which existing contacts already have active Sales pipeline journey
  const existingContactIds = [...existingByEmail.values()];
  const contactsWithSalesJPS = new Set<string>();
  for (let i = 0; i < existingContactIds.length; i += 200) {
    const batch = existingContactIds.slice(i, i + 200);
    const { data } = await sb
      .from("journeys")
      .select("primary_contact_id, journey_pipeline_state!inner(pipeline_id)")
      .in("primary_contact_id", batch)
      .eq("journey_pipeline_state.pipeline_id", SALES_PIPELINE_ID)
      .eq("journey_pipeline_state.is_active", true);
    for (const j of (data || []) as { primary_contact_id: string }[]) {
      contactsWithSalesJPS.add(j.primary_contact_id);
    }
  }

  // Single dedup pass across both sources
  const seenEmails = new Set<string>();
  const seenPhones = new Set<string>();
  const toCreate: Prospect[] = [];
  const toWire: { prospect: Prospect; contactId: string }[] = [];

  for (const p of allProspects) {
    // Already synced by deterministic ID
    if (existingByGhlId.has(p.ghlContactId)) continue;

    // Spam filter
    if (isSpam(p)) continue;

    // Dedupe within batch by email
    if (p.email && seenEmails.has(p.email)) continue;
    // Dedupe by phone if no email
    const phone = p.phone?.replace(/\D/g, "") || "";
    if (!p.email && phone && seenPhones.has(phone)) continue;

    if (p.email) seenEmails.add(p.email);
    if (phone) seenPhones.add(phone);

    const existingId = p.email ? existingByEmail.get(p.email) : undefined;
    if (!existingId) {
      toCreate.push(p);
    } else if (!contactsWithSalesJPS.has(existingId)) {
      toWire.push({ prospect: p, contactId: existingId });
    }
  }

  let created = 0;
  let wired = 0;
  const skipped = allProspects.length - toCreate.length - toWire.length;

  // --- Create new contacts + journey + JPS ---
  for (const p of toCreate) {
    const name = `${p.firstName} ${p.lastName}`.trim();

    const contactRow: Record<string, unknown> = {
      ghl_contact_id: p.ghlContactId,
      first_name: p.firstName,
      last_name: p.lastName,
      email: p.email,
      phone: p.phone || null,
      address: p.address || null,
      city: p.city || null,
      state: p.state || null,
      zip: p.zip || null,
      source: p.source,
      opportunity_source: p.source === "pto" ? "PTO Form" : "Franchise Request Form",
    };

    // Add PTO-specific fields
    if (p.ptoFields) {
      Object.assign(contactRow, {
        CountiesInterestedIn: p.ptoFields.CountiesInterestedIn,
        PartnerName: p.ptoFields.PartnerName,
        PartnerPhone: p.ptoFields.PartnerPhone,
        PartnerEmail: p.ptoFields.PartnerEmail,
        PartnerOccupation: p.ptoFields.PartnerOccupation,
        BriefWorkHistory: p.ptoFields.BriefWorkHistory,
        WhatInterestsInOpportunity: p.ptoFields.WhatInterestsInOpportunity,
        PreferredName: p.ptoFields.PreferredName,
        PreferredWeeklyHours: p.ptoFields.PreferredWeeklyHours,
        NonRetirementCapitalAvailable: p.ptoFields.NonRetirementCapitalAvailable,
        NonRetirementCapitalAvailableSource: p.ptoFields.NonRetirementCapitalAvailableSource,
        RetirementFundsRollingOver: p.ptoFields.RetirementFundsRollingOver,
        LeadSource: p.ptoFields.LeadSource,
        ReferredBy: p.ptoFields.ReferredBy,
        PtoSubmissionDate: toDateOrNull(p.ptoFields.PtoSubmissionDate),
      });
    }

    // Add franchise-specific fields
    if (p.franchiseFields) {
      Object.assign(contactRow, {
        LeadSource: p.franchiseFields.LeadSource,
        notes: p.franchiseFields.notes,
      });
    }

    const { data: newContact, error: cErr } = await sb.from("contacts").insert(contactRow).select("id").single();

    if (cErr) {
      errors.push(`${name} (${p.email}): ${cErr.message}`);
      continue;
    }

    const err = await createJourneyAndJPS(sb, newContact.id, name, p.insertedAt, errors);
    if (!err) created++;
  }

  // --- Wire existing contacts without Sales journey ---
  for (const { prospect, contactId } of toWire) {
    const name = `${prospect.firstName} ${prospect.lastName}`.trim();
    const err = await createJourneyAndJPS(sb, contactId, name, prospect.insertedAt, errors);
    if (!err) wired++;
  }

  return { created, wired, skipped, errors, sourceCursor };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function generateSlug(sb: ReturnType<typeof getServiceSupabase>, name: string): Promise<string> {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "journey";
  const { data: existing } = await sb.from("journeys").select("slug").like("slug", `${base}%`);
  const taken = new Set((existing ?? []).map((r: { slug: string | null }) => r.slug).filter(Boolean));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 100; i++) {
    if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
  }
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}

async function createJourneyAndJPS(
  sb: ReturnType<typeof getServiceSupabase>,
  contactId: string,
  name: string,
  insertedAt: string,
  errors: string[]
): Promise<boolean> {
  const slug = await generateSlug(sb, name);
  const { data: newJourney, error: jErr } = await sb
    .from("journeys")
    .insert({ name, slug, status: "active", primary_contact_id: contactId })
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
    pipeline_id: SALES_PIPELINE_ID,
    current_stage_id: ENGAGEMENT_STAGE_ID,
    current_sub_task_id: OUTREACH_SUB_TASK_ID,
    is_active: true,
    entered_pipeline_at: toDateOrNull(insertedAt) || new Date().toISOString(),
    entered_current_stage_at: new Date().toISOString(),
  });
  if (jpsErr) {
    errors.push(`Pipeline state for ${name}: ${jpsErr.message}`);
    return true;
  }

  return false;
}
