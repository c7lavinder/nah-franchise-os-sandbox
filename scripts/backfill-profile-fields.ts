/**
 * Backfill Profile Fields from GHL Custom Fields → contact_profile_fields table
 *
 * For each contact in Supabase:
 * 1. Fetch GHL contact with custom fields
 * 2. Map GHL custom field values to our profile field names
 * 3. Write to contact_profile_fields with last_updated_by = 'api'
 *
 * Usage:
 *   npx tsx scripts/backfill-profile-fields.ts --dry-run    # preview only
 *   npx tsx scripts/backfill-profile-fields.ts --live        # execute
 *   npx tsx scripts/backfill-profile-fields.ts --limit 10    # limit contacts
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const GHL_BASE_URL = "https://services.leadconnectorhq.com";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

async function ghlGet<T>(endpoint: string): Promise<T> {
  const token = process.env.GHL_API_KEY;
  if (!token) throw new Error("Missing GHL_API_KEY");
  const res = await fetch(`${GHL_BASE_URL}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Version: "2021-07-28",
    },
  });
  if (res.status === 429) {
    const retryAfter = res.headers.get("retry-after");
    const delay = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
    console.log(`  Rate limited — waiting ${delay}ms`);
    await new Promise((r) => setTimeout(r, delay));
    return ghlGet(endpoint);
  }
  if (!res.ok) {
    throw new Error(`GHL ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = !args.includes("--live");
  const limitArg = args.find((a) => a.startsWith("--limit"));
  const limit = limitArg ? parseInt(args[args.indexOf(limitArg) + 1] ?? "0") : 0;

  console.log(`=== Profile Field Backfill (${isDryRun ? "DRY RUN" : "LIVE"}) ===\n`);

  // 1. Load GHL field ID → field_name mapping
  const { data: ghlFieldMappings } = await supabase
    .from("ghl_custom_fields")
    .select("ghl_field_id, field_name, field_key")
    .eq("entity_type", "contact");

  if (!ghlFieldMappings || ghlFieldMappings.length === 0) {
    console.error("No GHL custom field mappings found. Run setup first.");
    process.exit(1);
  }

  // Map from GHL human-readable field name → registry snake_case name
  // The GHL custom fields table stores names like "Capital Availability"
  // The registry uses "NonRetirementCapitalAvailable"
  const GHL_TO_REGISTRY: Record<string, string> = {
    "Territory Interest": "territory_interest",
    "Territory Status": "territory_status",
    "Capital Availability": "NonRetirementCapitalAvailable",
    "Investment Timeline": "investment_timeline",
    "Motivation Clarity": "WhatInterestsInOpportunity",
    "NDA Status": "nda_status",
    "Framing Call Logged": "framing_call_logged",
    "Trainual Access Sent": "trainual_access_sent",
    "Trainual Completion Percent": "trainual_completion_pct",
    "Business Ownership Experience": "BriefWorkHistory",
    "Scout Lead Score": "scout_lead_score",
    "Lead Source Detail": "LeadSource",
  };

  const ghlIdToRegistryName = new Map<string, string>();
  const ghlIdToGhlName = new Map<string, string>();
  for (const m of ghlFieldMappings) {
    ghlIdToGhlName.set(m.ghl_field_id, m.field_name);
    // Try exact mapping first, then snake_case conversion
    const registryName =
      GHL_TO_REGISTRY[m.field_name] ??
      m.field_name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/(^_|_$)/g, "");
    ghlIdToRegistryName.set(m.ghl_field_id, registryName);
  }
  console.log(`Loaded ${ghlIdToRegistryName.size} GHL field mappings\n`);

  // 2. Fetch contacts with GHL IDs
  let query = supabase
    .from("contacts")
    .select("id, ghl_contact_id")
    .not("ghl_contact_id", "is", null)
    .order("created_at", { ascending: true });

  if (limit > 0) {
    query = query.limit(limit);
  }

  const { data: contacts, error: contactErr } = await query;
  if (contactErr) {
    console.error("Failed to fetch contacts:", contactErr.message);
    process.exit(1);
  }

  console.log(`Processing ${contacts?.length ?? 0} contacts\n`);

  let totalContacts = 0;
  let totalFieldsWritten = 0;
  let totalFieldsSkipped = 0;
  let totalErrors = 0;
  const fieldCounts: Record<string, number> = {};

  for (const contact of contacts ?? []) {
    totalContacts++;
    try {
      // Fetch GHL contact
      const { contact: ghlContact } = await ghlGet<{
        contact: { customFields: { id: string; value: string }[] };
      }>(`/contacts/${contact.ghl_contact_id}`);

      const fieldsToWrite: Array<{
        contact_id: string;
        field_name: string;
        field_value: string;
        last_updated_by: string;
      }> = [];

      for (const cf of ghlContact.customFields ?? []) {
        const registryName = ghlIdToRegistryName.get(cf.id);
        if (!registryName || !cf.value) continue;

        fieldsToWrite.push({
          contact_id: contact.id,
          field_name: registryName,
          field_value: JSON.stringify(cf.value),
          last_updated_by: "api",
        });

        const ghlName = ghlIdToGhlName.get(cf.id) ?? registryName;
        fieldCounts[`${registryName} (${ghlName})`] = (fieldCounts[`${registryName} (${ghlName})`] ?? 0) + 1;
      }

      if (fieldsToWrite.length === 0) {
        totalFieldsSkipped++;
        continue;
      }

      if (isDryRun) {
        totalFieldsWritten += fieldsToWrite.length;
        if (totalContacts <= 3) {
          console.log(`  Contact ${contact.ghl_contact_id}: ${fieldsToWrite.length} fields`);
          for (const f of fieldsToWrite.slice(0, 5)) {
            console.log(`    ${f.field_name} = ${f.field_value}`);
          }
          if (fieldsToWrite.length > 5) console.log(`    ... and ${fieldsToWrite.length - 5} more`);
        }
      } else {
        const { error: writeErr } = await supabase
          .from("contact_profile_fields")
          .upsert(fieldsToWrite, { onConflict: "contact_id,field_name" });

        if (writeErr) {
          console.error(`  Error writing contact ${contact.id}: ${writeErr.message}`);
          totalErrors++;
        } else {
          totalFieldsWritten += fieldsToWrite.length;
        }
      }

      // Rate limit: ~2 GHL calls per second
      if (totalContacts % 50 === 0) {
        console.log(`  Processed ${totalContacts}/${contacts?.length ?? 0}...`);
      }
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      totalErrors++;
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("429")) {
        // Already handled by ghlGet retry
      } else {
        console.error(`  Error on contact ${contact.ghl_contact_id}: ${msg}`);
      }
    }
  }

  console.log(`\n=== Results ===`);
  console.log(`Contacts processed: ${totalContacts}`);
  console.log(`Fields ${isDryRun ? "would be" : ""} written: ${totalFieldsWritten}`);
  console.log(`Contacts with no mapped fields: ${totalFieldsSkipped}`);
  console.log(`Errors: ${totalErrors}`);

  if (Object.keys(fieldCounts).length > 0) {
    console.log(`\nField distribution:`);
    const sorted = Object.entries(fieldCounts).sort((a, b) => b[1] - a[1]);
    for (const [name, count] of sorted) {
      console.log(`  ${name}: ${count} contacts`);
    }
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
