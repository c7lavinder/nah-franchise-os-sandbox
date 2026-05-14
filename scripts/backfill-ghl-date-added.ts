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

import ws from "ws";
import { createClient } from "@supabase/supabase-js";

const GHL_BASE_URL = "https://services.leadconnectorhq.com";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const GHL_API_KEY = process.env.GHL_API_KEY!;

const DRY_RUN = !process.argv.includes("--live");

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
  realtime: { transport: ws as never },
});

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

  // Fetch contacts missing ghl_date_added. Supabase caps queries at 1000 rows
  // by default, so paginate via .range() until we've pulled everything.
  type ContactRow = { id: string; ghl_contact_id: string };
  const contacts: ContactRow[] = [];
  const PAGE_SIZE = 1000;
  let page = 0;
  let error: { message: string } | null = null;
  while (true) {
    const { data, error: pageErr } = await supabase
      .from("contacts")
      .select("id, ghl_contact_id")
      .not("ghl_contact_id", "is", null)
      .is("ghl_date_added", null)
      .order("created_at", { ascending: true })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (pageErr) {
      error = pageErr;
      break;
    }
    if (!data || data.length === 0) break;
    contacts.push(...(data as ContactRow[]));
    if (data.length < PAGE_SIZE) break;
    page++;
  }

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
