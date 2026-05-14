/**
 * Backfill ghl_date_added on contacts from GHL API.
 *
 * Fetches each contact's dateAdded from GHL and writes it to contacts.ghl_date_added.
 * Only updates rows where ghl_date_added IS NULL and ghl_contact_id IS NOT NULL.
 *
 * Usage:
 *   npx tsx scripts/backfill-ghl-date-added.ts --dry-run   (preview)
 *   npx tsx scripts/backfill-ghl-date-added.ts --live       (execute)
 */

import { createClient } from "@supabase/supabase-js";

const GHL_BASE_URL = "https://services.leadconnectorhq.com";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GHL_API_KEY = process.env.GHL_API_KEY!;

const DRY_RUN = !process.argv.includes("--live");

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fetchGhlContact(ghlId: string): Promise<{ dateAdded?: string } | null> {
  const res = await fetch(`${GHL_BASE_URL}/contacts/${ghlId}`, {
    headers: {
      Authorization: `Bearer ${GHL_API_KEY}`,
      Version: "2021-07-28",
    },
  });
  if (!res.ok) {
    console.warn(`  GHL API error for ${ghlId}: ${res.status}`);
    return null;
  }
  const json = await res.json();
  return json.contact ?? null;
}

async function main() {
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`);

  // Fetch contacts missing ghl_date_added
  const { data: contacts, error } = await supabase
    .from("contacts")
    .select("id, ghl_contact_id")
    .not("ghl_contact_id", "is", null)
    .is("ghl_date_added", null)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to fetch contacts:", error.message);
    process.exit(1);
  }

  console.log(`Found ${contacts.length} contacts missing ghl_date_added\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const contact of contacts) {
    const ghlContact = await fetchGhlContact(contact.ghl_contact_id);
    if (!ghlContact?.dateAdded) {
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`  Would set ${contact.ghl_contact_id} → ${ghlContact.dateAdded}`);
    } else {
      const { error: updateError } = await supabase
        .from("contacts")
        .update({ ghl_date_added: ghlContact.dateAdded })
        .eq("id", contact.id);

      if (updateError) {
        console.warn(`  Update failed for ${contact.id}: ${updateError.message}`);
        errors++;
        continue;
      }
    }
    updated++;

    // Rate limit: ~2 requests/sec to stay under GHL limits
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`);
}

main();
