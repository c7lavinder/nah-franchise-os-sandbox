/**
 * Bootstrap Intelligence Profiles — CLI Script
 *
 * Creates candidate_intelligence profiles for all active pipeline leads.
 * Reads GHL contact data, maps custom fields, calculates initial scores.
 *
 * Usage:
 *   npx tsx scripts/bootstrap-intelligence.ts
 *   npx tsx scripts/bootstrap-intelligence.ts --contact=CONTACT_ID
 *
 * Requires .env.local with:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_KEY
 *   GHL_API_KEY (or OAuth token stored in Supabase)
 *   GHL_LOCATION_ID
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY in .env.local");
  process.exit(1);
}

if (!GHL_LOCATION_ID) {
  console.error("Missing GHL_LOCATION_ID in .env.local");
  process.exit(1);
}

// We can't use @/ path aliases in tsx scripts, so we directly import
// from relative paths would break. Instead, call the API endpoint.

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

async function bootstrapSingle(contactId: string) {
  console.log(`\nBootstrapping single contact: ${contactId}\n`);

  const response = await fetch(`${BASE_URL}/api/intelligence/bootstrap?contactId=${contactId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`API error (${response.status}): ${body}`);
    process.exit(1);
  }

  const data = await response.json();
  const r = data.result;

  if (r.skipped) {
    console.log(`  SKIPPED — profile already exists for ${contactId}`);
  } else if (r.error) {
    console.log(`  ERROR — ${r.error}`);
  } else {
    console.log(`  CREATED — ${r.contactName}`);
    console.log(`    Score: ${r.score}`);
    console.log(`    Flags: ${r.flagCount}`);
    console.log(`    Fields populated: ${r.fieldsPopulated}`);
  }
}

async function bootstrapAll() {
  console.log("\n=== Intelligence Profile Bootstrap ===\n");
  console.log(`API: ${BASE_URL}/api/intelligence/bootstrap`);
  console.log("Fetching all active pipeline leads...\n");

  const response = await fetch(`${BASE_URL}/api/intelligence/bootstrap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`API error (${response.status}): ${body}`);
    process.exit(1);
  }

  const data = await response.json();

  console.log("=== Results ===\n");
  console.log(`  Created: ${data.created}`);
  console.log(`  Skipped: ${data.skipped} (already had profiles)`);
  console.log(`  Errors:  ${data.errorCount}`);

  if (data.details && data.details.length > 0) {
    console.log("\n--- Details ---\n");
    for (const d of data.details) {
      const status = d.skipped
        ? "SKIP"
        : d.error
          ? "ERR "
          : "OK  ";
      const score = d.created ? ` score=${d.score}` : "";
      const flags = d.created ? ` flags=${d.flagCount}` : "";
      const fields = d.created ? ` fields=${d.fieldsPopulated}` : "";
      const name = d.contactName || d.contactId;
      console.log(`  [${status}] ${name}${score}${flags}${fields}`);
      if (d.error) {
        console.log(`         ${d.error}`);
      }
    }
  }

  if (data.errors && data.errors.length > 0) {
    console.log("\n--- Errors ---\n");
    for (const e of data.errors) {
      console.log(`  - ${e}`);
    }
  }

  console.log("\nDone.");
}

// Parse CLI args
const contactArg = process.argv.find((a) => a.startsWith("--contact="));

if (contactArg) {
  const contactId = contactArg.split("=")[1];
  bootstrapSingle(contactId).catch((err) => {
    console.error("Unexpected error:", err);
    process.exit(1);
  });
} else {
  bootstrapAll().catch((err) => {
    console.error("Unexpected error:", err);
    process.exit(1);
  });
}
