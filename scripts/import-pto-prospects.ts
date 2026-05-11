/**
 * Import MasterSuite PathToOwnershipEntries as contacts + journeys in Nurture stage.
 *
 * For each PTO entry not already in Supabase:
 * 1. Create contact with full PTO info
 * 2. Create journey
 * 3. Create journey_contacts (primary role)
 * 4. Create journey_pipeline_state in Follow-up → Nurture
 *
 * Run: npx tsx scripts/import-pto-prospects.ts [--dry-run]
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { queryMS } from "../lib/mastersuite/client";
import { getServiceSupabase } from "../lib/mastersuite/supabase";

const DRY_RUN = process.argv.includes("--dry-run");
const FOLLOW_UP_PIPELINE_ID = "a0000000-0000-0000-0000-000000000002";
const NURTURE_STAGE_ID = "c0000000-0000-0000-0000-000000000002";

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
  DefinitionOfSuccess: string | null;
  PreferredWeeklyHours: number | null;
  NonRetirementCapitalAvailable: number | null;
  NonRetirementCapitalAvailableSource: string | null;
  RetirementFundsRollingOver: number | null;
  LeadSource: string | null;
  ReferredBy: string | null;
}

function generatePtoGhlId(ptoId: number): string {
  // Generate a unique placeholder GHL ID for PTO prospects: pto_<ptoId>_<random>
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let rand = "";
  for (let i = 0; i < 8; i++) rand += chars[Math.floor(Math.random() * chars.length)];
  return `pto_${ptoId}_${rand}`;
}

function toDateOrNull(val: string | null | undefined): string | null {
  if (!val) return null;
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  // Filter out placeholder dates
  if (d.getFullYear() < 2000) return null;
  return d.toISOString();
}

async function main() {
  const sb = getServiceSupabase();

  if (DRY_RUN) console.log("\n*** DRY RUN MODE ***\n");

  // 1. Get PTO entries (filtered)
  const ptoRows = await queryMS<PTORow>(`
    SELECT * FROM PathToOwnershipEntries
    WHERE FirstName NOT LIKE '%test%' AND LastName NOT LIKE '%test%'
      AND EmailAddress IS NOT NULL AND EmailAddress != ''
      AND EmailAddress NOT LIKE '%newagainhouses.com'
      AND EmailAddress NOT LIKE '%@test%'
      AND LENGTH(EmailAddress) > 5
      AND EmailAddress LIKE '%@%.%'
    ORDER BY Inserted DESC
  `);
  console.log(`PTO entries (filtered): ${ptoRows.length}`);

  // 2. Get existing contact emails
  const existingEmails = new Set<string>();
  const batchSize = 200;
  const allEmails = [...new Set(ptoRows.map((r) => r.EmailAddress.toLowerCase().trim()))];

  for (let i = 0; i < allEmails.length; i += batchSize) {
    const batch = allEmails.slice(i, i + batchSize);
    const { data } = await sb.from("contacts").select("email").in("email", batch);
    for (const c of (data || []) as { email: string }[]) {
      if (c.email) existingEmails.add(c.email.toLowerCase().trim());
    }
  }

  // 3. Filter out spam/bot entries and deduplicate
  const spamPatterns = [/do-not-respond/i, /serviseantilogin/i, /mailbox\.in\.ua/i, /^test@/i];

  function isSpamName(first: string, last: string): boolean {
    const name = `${first} ${last}`;
    // Placeholder names
    if (/^(Alice|John|MyName|Hello)\s+(Alice|John|MyName|Hello)$/i.test(name)) return true;
    // Names with only consonants or very random patterns
    if (/^[bcdfghjklmnpqrstvwxyz]{5,}$/i.test(first)) return true;
    if (/^[bcdfghjklmnpqrstvwxyz]{5,}$/i.test(last)) return true;
    // Mixed-case gibberish: uppercase letter appears after lowercase (e.g. "rgoexqfO", "VTMJAwuS")
    for (const part of [first, last]) {
      if (part.length < 6) continue;
      const upperCount = (part.match(/[A-Z]/g) || []).length;
      const lowerCount = (part.match(/[a-z]/g) || []).length;
      // Real names: mostly one case with maybe 1 capital. Bot names: random mix.
      if (upperCount >= 3 && lowerCount >= 3) return true;
      // Single word with > 8 chars and unusual casing pattern
      if (part.length > 8 && /[a-z][A-Z]/.test(part) && upperCount >= 2) return true;
    }
    return false;
  }

  const seenEmails = new Set<string>();
  const toImport = ptoRows.filter((r) => {
    const email = r.EmailAddress.toLowerCase().trim();
    if (existingEmails.has(email) || seenEmails.has(email)) return false;
    // Spam email patterns
    if (spamPatterns.some((p) => p.test(email))) return false;
    // Spam names
    if (isSpamName(r.FirstName, r.LastName)) return false;
    // Names that are clearly garbage (> 15 chars of mixed case with no spaces)
    if (r.FirstName.length > 12 && !/\s/.test(r.FirstName) && /[A-Z].*[a-z].*[A-Z]/.test(r.FirstName)) return false;
    if (r.LastName.length > 12 && !/\s/.test(r.LastName) && /[A-Z].*[a-z].*[A-Z]/.test(r.LastName)) return false;
    // Free iPhone spam
    if (/iphone|claim free/i.test(r.FirstName + r.LastName)) return false;
    seenEmails.add(email);
    return true;
  });

  console.log(`Already in Supabase: ${existingEmails.size}`);
  console.log(`To import: ${toImport.length}\n`);

  let created = 0;
  let errors = 0;

  for (const pto of toImport) {
    const name = `${pto.FirstName} ${pto.LastName}`.trim();
    const email = pto.EmailAddress.toLowerCase().trim();

    // Create contact
    const contactRecord = {
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
    };

    if (DRY_RUN) {
      console.log(`[DRY] Would create: ${name} (${email})`);
      created++;
      continue;
    }

    // Insert contact
    const { data: newContact, error: cErr } = await sb.from("contacts").insert(contactRecord).select("id").single();

    if (cErr) {
      console.error(`ERROR creating contact ${name} (${email}): ${cErr.message}`);
      errors++;
      continue;
    }

    const contactId = newContact.id;

    // Create journey
    const { data: newJourney, error: jErr } = await sb
      .from("journeys")
      .insert({
        name,
        status: "active",
        primary_contact_id: contactId,
      })
      .select("id")
      .single();

    if (jErr) {
      console.error(`ERROR creating journey for ${name}: ${jErr.message}`);
      errors++;
      continue;
    }

    const journeyId = newJourney.id;

    // Create journey_contacts
    const { error: jcErr } = await sb.from("journey_contacts").insert({
      journey_id: journeyId,
      contact_id: contactId,
      role: "primary",
      is_primary_decision_maker: true,
    });

    if (jcErr) {
      console.error(`ERROR creating journey_contacts for ${name}: ${jcErr.message}`);
    }

    // Create journey_pipeline_state in Nurture
    const { error: jpsErr } = await sb.from("journey_pipeline_state").insert({
      journey_id: journeyId,
      TerritorySlug: null,
      pipeline_id: FOLLOW_UP_PIPELINE_ID,
      current_stage_id: NURTURE_STAGE_ID,
      is_active: true,
      entered_pipeline_at: toDateOrNull(pto.Inserted) || new Date().toISOString(),
      entered_current_stage_at: new Date().toISOString(),
    });

    if (jpsErr) {
      console.error(`ERROR creating JPS for ${name}: ${jpsErr.message}`);
    }

    created++;
    if (created % 50 === 0) console.log(`  ...${created}/${toImport.length} created`);
  }

  console.log(`\n=== DONE ===`);
  console.log(`Created: ${created}`);
  console.log(`Errors: ${errors}`);
  if (DRY_RUN) console.log("Run again without --dry-run to apply.");

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
