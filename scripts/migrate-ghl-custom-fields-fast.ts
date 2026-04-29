/**
 * Fast migration: GHL custom fields → Supabase.
 *
 * Instead of fetching all 80k GHL contacts, reads our 2,744 GHL IDs
 * from Supabase and fetches only those contacts from GHL.
 *
 * Usage: npx tsx scripts/migrate-ghl-custom-fields-fast.ts
 */

import * as fs from "fs";

const GHL = "https://services.leadconnectorhq.com";

const FIELD_MAP: Record<string, string> = {
  muMlToHIHl31jAGBkf7I: "territory_interest",
  a1MnyvWx6ep0ffBW6BYN: "territory_status",
  vMOaDI5lf3kXdopK456I: "territory_email",
  r3D9pkMOmAfYQgfgOBHf: "counties_priority",
  RQjpIT2LXIMiC3pbCui5: "nda_status",
  bfnObe8LBN2NhlP2YIgg: "framing_call_logged",
  ptn3LorDS6ThhnsjQL6k: "business_ownership_experience",
  AbniyMfCcg0mVVJHgNnn: "capital_availability",
  CBAUgTKdryFXtmG8wL9u: "investment_timeline",
  QvCGhfBPZkonrr0s7yqs: "motivation_clarity",
  MBVMFsR5OU2WufPyGSTF: "number_of_franchisees",
  dai1A7rzaPP0TQon9fqZ: "trainual_access_sent",
  xV8hTtqWAASiTdbNzCDz: "trainual_completion_pct",
  utPxX4VuZLQpmuQHfguU: "lead_source_detail",
  BTdHDVV8BTzfn0YWIcX6: "incoming_lead_email",
  syH5TRCnHujwtIdEomgV: "scout_lead_score",
  TMli1VqAKEPQCp9z4Vcf: "franchise_start_date",
  jpKAeZes609V8M5OUSLa: "onboarding_completion_date",
  iGUZ6UJ9DndH2USgopKD: "property_submission_status",
  I6C5oa0CLxQUGEoxZxqn: "marketing_phone",
  WtiktvTryO9X8iNRELj5: "nexa_phone",
  y38SgeuDZmtwoVYSzCdC: "return_mail_address",
  G11HZFzji8mNdxak0FTK: "fb_url",
  srQewMbTAaO3dEw06MVW: "franchisee_2_name",
  WNNbbZVZRxnT3wt5JAui: "franchisee_2_email",
  hdMYUybphMbu22L7273T: "franchisee_2_phone",
  "8Z8z1lJSAPTApm8OMoLa": "real_estate_partner",
  "5IM6LnMVWvVx1MIXu6nX": "real_estate_agent_broker",
  "01LGI5SbBBWxovPdHIhf": "real_estate_agent_email",
  DK9nwHuzpSWG5ijCPw2y: "real_estate_phone",
  dxrVYtajJqkxYKsYrWrX: "ecosystem_partners",
  vmPLyhoutb2thRc4gefy: "lead_manager_name",
  J7DUEbwRYyHD1P0tOEfG: "lead_manager_email",
  uon6ICMSSWJV81rPdnzY: "happyfox_url",
  rSXtZJGXHIFjNh2Y8uQD: "clickx_package",
  eIlvBOAMqf0itOzN19aW: "openclaw_enriched",
  UZa6LpfTKfyGY5A4Lbn4: "territory_interest",
  dzO8ypzP8bje3Nvbk80l: "legal_entity",
};

const BOOLEAN_FIELDS = new Set(["framing_call_logged", "trainual_access_sent", "openclaw_enriched"]);
const NUMERIC_FIELDS = new Set(["trainual_completion_pct", "scout_lead_score", "number_of_franchisees"]);
const DATE_FIELDS = new Set(["franchise_start_date", "onboarding_completion_date"]);

function coerceValue(column: string, raw: string): unknown {
  if (!raw || raw.trim() === "") return null;
  if (BOOLEAN_FIELDS.has(column)) return ["yes", "true", "1"].includes(raw.toLowerCase());
  if (NUMERIC_FIELDS.has(column)) {
    const n = parseFloat(raw.replace(/[^0-9.-]/g, ""));
    return isNaN(n) ? null : n;
  }
  if (DATE_FIELDS.has(column)) {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  return raw.trim();
}

async function main() {
  const apiKey = process.env.GHL_API_KEY!;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

  // Step 1: Get our GHL contact IDs from Supabase
  console.log("Step 1: Reading GHL IDs from Supabase...");
  const sbRes = await fetch(
    `${supabaseUrl}/rest/v1/contacts?select=ghl_contact_id&ghl_contact_id=not.is.null&limit=10000`,
    {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
    }
  );
  const contacts = (await sbRes.json()) as { ghl_contact_id: string }[];
  console.log(`  ${contacts.length} contacts to process\n`);

  // Step 2: Fetch each from GHL and collect custom fields
  console.log("Step 2: Fetching custom fields from GHL...");
  const backup: any[] = [];
  let updated = 0;
  let skipped = 0;
  let fieldsPopulated = 0;
  let errors = 0;

  for (let i = 0; i < contacts.length; i++) {
    const ghlId = contacts[i].ghl_contact_id;

    try {
      const res = await fetch(`${GHL}/contacts/${ghlId}`, {
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Version: "2021-07-28" },
      });

      if (!res.ok) {
        skipped++;
        continue;
      }

      const data = await res.json();
      const c = data.contact ?? data;
      const customFields = (c.customFields as { id: string; value: string }[]) ?? [];

      backup.push({ id: ghlId, firstName: c.firstName, lastName: c.lastName, customFields });

      if (customFields.length === 0) {
        skipped++;
        continue;
      }

      // Map fields
      const updates: Record<string, unknown> = {};
      for (const field of customFields) {
        const column = FIELD_MAP[field.id];
        if (!column || !field.value) continue;
        const coerced = coerceValue(column, String(field.value));
        if (coerced !== null) {
          updates[column] = coerced;
          fieldsPopulated++;
        }
      }

      if (Object.keys(updates).length === 0) {
        skipped++;
        continue;
      }

      // Write to Supabase
      const patchRes = await fetch(`${supabaseUrl}/rest/v1/contacts?ghl_contact_id=eq.${ghlId}`, {
        method: "PATCH",
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(updates),
      });

      if (patchRes.ok) updated++;
      else errors++;
    } catch {
      errors++;
    }

    // Rate limit GHL
    if (i % 5 === 0) await new Promise((r) => setTimeout(r, 150));

    if ((i + 1) % 100 === 0) console.log(`  ${i + 1}/${contacts.length} — updated: ${updated}, skipped: ${skipped}`);
  }

  // Save backup
  fs.writeFileSync("scripts/ghl-custom-fields-backup.json", JSON.stringify(backup, null, 2));

  console.log(`\n=== Done ===`);
  console.log(`  Processed: ${contacts.length}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Fields populated: ${fieldsPopulated}`);
  console.log(`  Backup: scripts/ghl-custom-fields-backup.json`);
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
