/**
 * Sync FRANCHISE_REQUEST form submissions from MasterSuite into Supabase.
 *
 * New prospects get a contact, journey, and journey_pipeline_state
 * in Sales → Engagement (first stage).
 *
 * Existing contacts without an active Sales pipeline journey get wired up.
 */
import { queryMS } from "./client";
import { getServiceSupabase } from "./supabase";

const PTO_PIPELINE_ID = "a0000000-0000-0000-0000-000000000001"; // Sales — Path to Ownership
const ENGAGEMENT_STAGE_ID = "b0000000-0000-0000-0000-000000000001"; // Engagement

interface FranchiseRequestRow {
  FormSubmissionId: number;
  Inserted: string;
  Updated: string | null;
  FormStatus: string;
  FirstName: string | null;
  LastName: string | null;
  PersonalCity: string | null;
  PersonalState: string | null;
  PersonalZip: string | null;
  Phone: string | null;
  Email: string | null;
  Comments: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  Gclid: string | null;
  Fbclid: string | null;
  IpAddress: string | null;
}

function generateFranchiseGhlId(formId: number): string {
  return `franchise_req_${formId}`;
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

export async function syncFranchiseRequests(
  since?: string
): Promise<{ created: number; wired: number; skipped: number; errors: string[] }> {
  const sb = getServiceSupabase();
  const errors: string[] = [];

  let whereClause = `
    WHERE FormType = 'FRANCHISE_REQUEST'
      AND FormStatus = 'COMPLETE'
      AND FirstName IS NOT NULL AND FirstName != ''
      AND LastName IS NOT NULL AND LastName != ''
  `;
  const params: string[] = [];
  if (since) {
    whereClause += " AND Inserted > ?";
    params.push(since);
  }

  const rows = await queryMS<FranchiseRequestRow>(
    `SELECT FormSubmissionId, Inserted, Updated, FormStatus,
            FirstName, LastName, PersonalCity, PersonalState, PersonalZip,
            Phone, Email, Comments,
            utmSource, utmMedium, utmCampaign, utmContent, utmTerm,
            Gclid, Fbclid, IpAddress
     FROM FormSubmissions
     ${whereClause}
     ORDER BY Inserted DESC`,
    params.length > 0 ? params : undefined
  );

  // Dedupe by email against existing Supabase contacts
  const emailRows = rows.filter((r) => r.Email && r.Email.trim().length > 5);
  const allEmails = [...new Set(emailRows.map((r) => r.Email!.toLowerCase().trim()))];
  const existingContactsByEmail = new Map<string, string>();
  for (let i = 0; i < allEmails.length; i += 200) {
    const batch = allEmails.slice(i, i + 200);
    const { data } = await sb.from("contacts").select("id, email").in("email", batch);
    for (const c of (data || []) as { id: string; email: string }[]) {
      if (c.email) existingContactsByEmail.set(c.email.toLowerCase().trim(), c.id);
    }
  }

  // Secondary dedupe by deterministic ghl_contact_id
  const franchiseGhlIds = rows.map((r) => generateFranchiseGhlId(r.FormSubmissionId));
  const existingByGhlId = new Set<string>();
  for (let i = 0; i < franchiseGhlIds.length; i += 200) {
    const batch = franchiseGhlIds.slice(i, i + 200);
    const { data } = await sb.from("contacts").select("ghl_contact_id").in("ghl_contact_id", batch);
    for (const c of (data || []) as { ghl_contact_id: string }[]) {
      existingByGhlId.add(c.ghl_contact_id);
    }
  }

  // Find which existing contacts already have an active Sales pipeline journey
  const existingContactIds = [...existingContactsByEmail.values()];
  const contactsWithSalesJPS = new Set<string>();
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

  // Split rows into: new contacts, existing needing wiring, already done
  const seenEmails = new Set<string>();
  const seenPhones = new Set<string>();
  const toCreate: FranchiseRequestRow[] = [];
  const toWire: { row: FranchiseRequestRow; contactId: string }[] = [];

  for (const r of rows) {
    const email = r.Email?.toLowerCase().trim() || "";
    const phone = r.Phone?.replace(/\D/g, "") || "";

    // Skip if already synced by deterministic ID
    if (existingByGhlId.has(generateFranchiseGhlId(r.FormSubmissionId))) continue;

    // Dedupe within this batch by email or phone
    if (email && seenEmails.has(email)) continue;
    if (!email && phone && seenPhones.has(phone)) continue;

    // Spam filters
    if (email && SPAM_EMAIL_PATTERNS.some((p) => p.test(email))) continue;
    if (r.FirstName && r.LastName && isSpamName(r.FirstName, r.LastName)) continue;

    if (email) seenEmails.add(email);
    if (phone) seenPhones.add(phone);

    const existingId = email ? existingContactsByEmail.get(email) : undefined;
    if (!existingId) {
      toCreate.push(r);
    } else if (!contactsWithSalesJPS.has(existingId)) {
      toWire.push({ row: r, contactId: existingId });
    }
  }

  let created = 0;
  let wired = 0;
  const skipped = rows.length - toCreate.length - toWire.length;

  // --- Create brand-new contacts + journey + JPS ---
  for (const r of toCreate) {
    const firstName = r.FirstName?.trim() || "";
    const lastName = r.LastName?.trim() || "";
    const name = `${firstName} ${lastName}`.trim();
    const email = r.Email?.toLowerCase().trim() || null;

    const utmSource = [r.utmSource, r.utmMedium, r.utmCampaign].filter(Boolean).join(" / ");

    const { data: newContact, error: cErr } = await sb
      .from("contacts")
      .insert({
        ghl_contact_id: generateFranchiseGhlId(r.FormSubmissionId),
        first_name: firstName,
        last_name: lastName,
        email,
        phone: r.Phone || null,
        city: r.PersonalCity || null,
        state: r.PersonalState || null,
        zip: r.PersonalZip || null,
        source: "franchise_request",
        opportunity_source: "Franchise Request Form",
        LeadSource: utmSource || "Direct",
        notes: r.Comments || null,
      })
      .select("id")
      .single();

    if (cErr) {
      errors.push(`${name} (${email}): ${cErr.message}`);
      continue;
    }

    const err = await createJourneyAndJPS(sb, newContact.id, name, r, errors);
    if (!err) created++;
  }

  // --- Wire existing contacts that have no Sales pipeline journey ---
  for (const { row, contactId } of toWire) {
    const name = `${row.FirstName?.trim() || ""} ${row.LastName?.trim() || ""}`.trim();
    const err = await createJourneyAndJPS(sb, contactId, name, row, errors);
    if (!err) wired++;
  }

  return { created, wired, skipped, errors };
}

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
  row: FranchiseRequestRow,
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
    pipeline_id: PTO_PIPELINE_ID,
    current_stage_id: ENGAGEMENT_STAGE_ID,
    is_active: true,
    entered_pipeline_at: toDateOrNull(row.Inserted) || new Date().toISOString(),
    entered_current_stage_at: new Date().toISOString(),
  });
  if (jpsErr) {
    errors.push(`Pipeline state for ${name}: ${jpsErr.message}`);
    return true;
  }

  return false;
}
