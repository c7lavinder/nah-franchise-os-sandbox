/**
 * Migrate GHL custom field values → Supabase contacts table.
 *
 * 1. Fetches all contacts from GHL with custom fields
 * 2. Exports raw data to scripts/ghl-custom-fields-backup.json
 * 3. Maps GHL field IDs → Supabase column names
 * 4. Updates contacts table in Supabase
 * 5. Reports stats
 *
 * Usage: npx tsx scripts/migrate-ghl-custom-fields.ts
 */

import * as fs from "fs";

const GHL = "https://services.leadconnectorhq.com";

// GHL field ID → Supabase contacts column name
const FIELD_MAP: Record<string, string> = {
  // Franchise fit / qualification
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
  // Trainual
  dai1A7rzaPP0TQon9fqZ: "trainual_access_sent",
  xV8hTtqWAASiTdbNzCDz: "trainual_completion_pct",
  // Lead source
  utPxX4VuZLQpmuQHfguU: "lead_source_detail",
  BTdHDVV8BTzfn0YWIcX6: "incoming_lead_email",
  // Scoring
  syH5TRCnHujwtIdEomgV: "scout_lead_score",
  // Operational
  TMli1VqAKEPQCp9z4Vcf: "franchise_start_date",
  jpKAeZes609V8M5OUSLa: "onboarding_completion_date",
  iGUZ6UJ9DndH2USgopKD: "property_submission_status",
  // Contact extensions
  I6C5oa0CLxQUGEoxZxqn: "marketing_phone",
  WtiktvTryO9X8iNRELj5: "nexa_phone",
  y38SgeuDZmtwoVYSzCdC: "return_mail_address",
  G11HZFzji8mNdxak0FTK: "fb_url",
  // Partner/ecosystem
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
  // Integrations
  uon6ICMSSWJV81rPdnzY: "happyfox_url",
  rSXtZJGXHIFjNh2Y8uQD: "clickx_package",
  eIlvBOAMqf0itOzN19aW: "openclaw_enriched",
  // Territory
  UZa6LpfTKfyGY5A4Lbn4: "territory_interest", // territory abbrev — map to interest as fallback
  dzO8ypzP8bje3Nvbk80l: "legal_entity", // already exists on contacts
};

// Fields that need type coercion
const BOOLEAN_FIELDS = new Set(["framing_call_logged", "trainual_access_sent", "openclaw_enriched"]);
const NUMERIC_FIELDS = new Set(["trainual_completion_pct", "scout_lead_score", "number_of_franchisees"]);
const DATE_FIELDS = new Set(["franchise_start_date", "onboarding_completion_date"]);

function coerceValue(column: string, raw: string): unknown {
  if (!raw || raw.trim() === "") return null;
  if (BOOLEAN_FIELDS.has(column)) {
    return raw.toLowerCase() === "yes" || raw.toLowerCase() === "true" || raw === "1";
  }
  if (NUMERIC_FIELDS.has(column)) {
    const num = parseFloat(raw.replace(/[^0-9.-]/g, ""));
    return isNaN(num) ? null : num;
  }
  if (DATE_FIELDS.has(column)) {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  return raw.trim();
}

async function main() {
  const apiKey = process.env.GHL_API_KEY!;
  const locationId = process.env.GHL_LOCATION_ID!;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

  if (!apiKey || !locationId || !supabaseUrl || !supabaseKey) {
    console.error("Missing required env vars");
    process.exit(1);
  }

  // --- Step 1: Fetch ALL contacts from GHL with pagination ---
  console.log("=== Step 1: Fetching all contacts from GHL ===\n");

  let allContacts: any[] = [];
  let nextPageUrl: string | null = `${GHL}/contacts/?locationId=${locationId}&limit=100`;

  while (nextPageUrl) {
    const res = await fetch(nextPageUrl, {
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Version: "2021-07-28" },
    });

    if (!res.ok) {
      console.error("GHL fetch failed:", res.status, await res.text());
      break;
    }

    const data = await res.json();
    const contacts = data.contacts ?? [];
    allContacts.push(...contacts);
    console.log(`  Fetched ${allContacts.length} contacts so far...`);

    // GHL pagination: check for next page
    const meta = data.meta ?? {};
    if (meta.nextPageUrl || meta.nextPage) {
      nextPageUrl =
        meta.nextPageUrl ??
        `${GHL}/contacts/?locationId=${locationId}&limit=100&startAfterId=${contacts[contacts.length - 1]?.id}`;
      // Rate limit
      await new Promise((r) => setTimeout(r, 200));
    } else if (contacts.length === 100) {
      // No explicit next page but got a full page — try cursor
      nextPageUrl = `${GHL}/contacts/?locationId=${locationId}&limit=100&startAfterId=${contacts[contacts.length - 1]?.id}`;
      await new Promise((r) => setTimeout(r, 200));
    } else {
      nextPageUrl = null;
    }
  }

  console.log(`\nTotal contacts fetched: ${allContacts.length}`);

  // --- Step 2: Backup raw data ---
  console.log("\n=== Step 2: Saving backup ===\n");

  const backupData = allContacts.map((c) => ({
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    customFields: c.customFields ?? [],
  }));

  fs.writeFileSync("scripts/ghl-custom-fields-backup.json", JSON.stringify(backupData, null, 2));
  console.log(`  Saved backup: scripts/ghl-custom-fields-backup.json (${backupData.length} contacts)`);

  // --- Step 3: Map and update Supabase ---
  console.log("\n=== Step 3: Migrating to Supabase ===\n");

  let updated = 0;
  let skipped = 0;
  let fieldsPopulated = 0;

  for (const contact of allContacts) {
    const ghlId = contact.id;
    const customFields = (contact.customFields as { id: string; value: string }[]) ?? [];

    if (customFields.length === 0) {
      skipped++;
      continue;
    }

    // Build update payload
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

    // Update Supabase
    const res = await fetch(`${supabaseUrl}/rest/v1/contacts?ghl_contact_id=eq.${ghlId}`, {
      method: "PATCH",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(updates),
    });

    if (res.ok) {
      updated++;
    } else {
      const err = await res.text();
      if (updated < 3) console.log(`  Failed for ${ghlId}: ${err}`);
    }

    // Rate limit Supabase
    if (updated % 100 === 0 && updated > 0) {
      console.log(`  Updated ${updated} contacts...`);
    }
  }

  console.log(`\n=== Results ===`);
  console.log(`  Total GHL contacts: ${allContacts.length}`);
  console.log(`  Updated in Supabase: ${updated}`);
  console.log(`  Skipped (no custom fields): ${skipped}`);
  console.log(`  Total field values migrated: ${fieldsPopulated}`);
  console.log(`\nBackup saved to scripts/ghl-custom-fields-backup.json`);
  console.log("Run the GHL field deletion script after verifying data in Supabase.");
}

main().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
