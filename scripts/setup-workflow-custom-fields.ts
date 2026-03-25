/**
 * Create Workflow Custom Fields in GHL
 *
 * Creates the 5 workflow tracking custom fields on GHL contacts.
 * Per ghl-masterclass: field IDs are per-location, never hardcode them.
 * This script creates the fields and caches the ID mapping in Supabase.
 *
 * Safe to run multiple times — skips fields that already exist.
 *
 * Usage: npx tsx scripts/setup-workflow-custom-fields.ts
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const GHL_BASE = "https://services.leadconnectorhq.com";
const API_KEY = process.env.GHL_API_KEY;
const LOCATION_ID = process.env.GHL_LOCATION_ID;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!API_KEY || !LOCATION_ID || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing env vars: GHL_API_KEY, GHL_LOCATION_ID, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const headers = {
  Authorization: `Bearer ${API_KEY}`,
  "Content-Type": "application/json",
  Version: "2021-07-28",
};

/** Workflow tracking fields to create — per docs/workflows.md */
const WORKFLOW_FIELDS = [
  { name: "workflow_name", dataType: "TEXT", description: "Name of the active workflow this contact is enrolled in" },
  { name: "workflow_day", dataType: "NUMERICAL", description: "Current day number in the workflow (1-30, etc.)" },
  { name: "workflow_version", dataType: "TEXT", description: "Version ID of the workflow the contact is on" },
  { name: "last_workflow_touch", dataType: "DATE", description: "Timestamp of the last workflow step executed" },
  { name: "workflow_goal_achieved", dataType: "SINGLE_OPTIONS", description: "Whether the workflow's exit goal was met", options: ["true", "false"] },
];

async function setupFields() {
  console.log("=== Setting Up Workflow Custom Fields in GHL ===\n");

  // Step 1: Fetch existing custom fields
  console.log("Fetching existing fields...");
  const existingRes = await fetch(`${GHL_BASE}/locations/${LOCATION_ID}/customFields`, { headers });

  if (!existingRes.ok) {
    console.error(`Failed to fetch fields: ${existingRes.status} ${await existingRes.text()}`);
    process.exit(1);
  }

  const existingData = await existingRes.json() as { customFields: { id: string; name: string }[] };
  const existingMap = new Map<string, string>();
  for (const field of existingData.customFields ?? []) {
    existingMap.set(field.name.toLowerCase(), field.id);
  }

  console.log(`  Found ${existingMap.size} existing custom fields\n`);

  // Step 2: Create or skip each workflow field
  const fieldIdMap: Record<string, string> = {};
  let created = 0;
  let skipped = 0;

  for (const field of WORKFLOW_FIELDS) {
    const existing = existingMap.get(field.name.toLowerCase());
    if (existing) {
      console.log(`  ↻ SKIP: ${field.name} (already exists: ${existing})`);
      fieldIdMap[field.name.toLowerCase()] = existing;
      skipped++;
      continue;
    }

    const createBody: Record<string, unknown> = {
      name: field.name,
      dataType: field.dataType,
      model: "contact",
    };
    if ("options" in field && field.options) {
      createBody.options = field.options;
    }

    const createRes = await fetch(`${GHL_BASE}/locations/${LOCATION_ID}/customFields`, {
      method: "POST",
      headers,
      body: JSON.stringify(createBody),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      console.error(`  ✗ FAIL: ${field.name} — ${errText}`);
      continue;
    }

    const createData = await createRes.json() as { customField: { id: string; name: string } };
    const fieldId = createData.customField.id;
    fieldIdMap[field.name.toLowerCase()] = fieldId;
    console.log(`  ✓ CREATED: ${field.name} → ${fieldId}`);
    created++;

    // Small delay to respect rate limits (100/10s per ghl-masterclass)
    await new Promise((r) => setTimeout(r, 200));
  }

  // Step 3: Cache the field ID mapping in Supabase
  console.log("\nCaching field ID mapping in Supabase...");

  // Merge with any existing cached fields
  const { data: existingCache } = await supabase
    .from("app_settings")
    .select("setting_value")
    .eq("setting_key", "ghl_custom_field_map")
    .single();

  const mergedMap = {
    ...(existingCache?.setting_value as Record<string, string> ?? {}),
    ...fieldIdMap,
  };

  await supabase.from("app_settings").upsert(
    {
      setting_key: "ghl_custom_field_map",
      setting_value: mergedMap,
      description: "Cached GHL custom field name→ID mapping",
    },
    { onConflict: "setting_key" }
  );

  console.log(`  Cached ${Object.keys(mergedMap).length} total field mappings\n`);
  console.log(`Done: ${created} created, ${skipped} skipped\n`);

  // Print the mapping for reference
  console.log("Field ID Mapping:");
  for (const [name, id] of Object.entries(fieldIdMap)) {
    console.log(`  ${name} → ${id}`);
  }
}

setupFields().catch((err) => {
  console.error("Setup error:", err);
  process.exit(1);
});
