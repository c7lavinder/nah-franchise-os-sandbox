/**
 * Sprint 2 Phase 2.1: Fetch NAH pipeline custom field IDs from GHL
 *
 * Looks for the 4 NAH pipeline stage ID fields on the contact record.
 * Prints the field IDs for use in the pipelines table.
 *
 * Usage: npx tsx scripts/fetch-ghl-custom-fields.ts
 */

const GHL_BASE_URL = "https://services.leadconnectorhq.com";

const NAH_FIELD_KEYS = [
  "contact.nah_sales_stage_id",
  "contact.nah_onboarding_stage_id",
  "contact.nah_coaching_stage_id",
  "contact.nah_followup_stage_id",
];

async function main() {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;

  if (!apiKey || !locationId) {
    console.error("Missing GHL_API_KEY or GHL_LOCATION_ID");
    process.exit(1);
  }

  console.log("Fetching custom fields from GHL...");

  const response = await fetch(`${GHL_BASE_URL}/locations/${locationId}/customFields`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Version: "2021-07-28",
    },
  });

  if (!response.ok) {
    console.error(`GHL API error: ${response.status} ${response.statusText}`);
    const body = await response.text();
    console.error(body);
    process.exit(1);
  }

  const data = await response.json() as { customFields: Array<{ id: string; name: string; fieldKey: string }> };
  const allFields = data.customFields ?? [];

  console.log(`Found ${allFields.length} total custom fields`);
  console.log("");

  // Look for NAH pipeline fields
  const nahFields = allFields.filter((f) =>
    NAH_FIELD_KEYS.includes(f.fieldKey) ||
    f.name.toLowerCase().includes("nah_") ||
    f.name.toLowerCase().includes("nah ") ||
    f.fieldKey.includes("nah_")
  );

  if (nahFields.length > 0) {
    console.log("=== NAH Pipeline Fields Found ===");
    for (const f of nahFields) {
      console.log(`  ${f.fieldKey} → ID: ${f.id} (name: "${f.name}")`);
    }
  } else {
    console.log("No NAH pipeline fields found. Listing all fields with 'stage' or 'pipeline' in name:");
    const related = allFields.filter((f) =>
      f.name.toLowerCase().includes("stage") ||
      f.name.toLowerCase().includes("pipeline") ||
      f.fieldKey.toLowerCase().includes("stage") ||
      f.fieldKey.toLowerCase().includes("pipeline")
    );
    if (related.length > 0) {
      for (const f of related) {
        console.log(`  ${f.fieldKey} → ID: ${f.id} (name: "${f.name}")`);
      }
    } else {
      console.log("  (none found)");
    }

    console.log("");
    console.log("All field names for reference:");
    for (const f of allFields) {
      console.log(`  ${f.fieldKey} → "${f.name}"`);
    }
  }
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
