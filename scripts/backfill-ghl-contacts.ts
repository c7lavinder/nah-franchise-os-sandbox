/**
 * Sprint 2 Phase 2.3: Backfill GHL contacts into the local contacts table.
 *
 * Paginates through all GHL contacts, upserts each into the contacts table,
 * and optionally creates Sales Pipeline state rows for new contacts.
 *
 * Usage:
 *   npx tsx scripts/backfill-ghl-contacts.ts --dry-run --limit 10   (preview only)
 *   npx tsx scripts/backfill-ghl-contacts.ts --limit 10              (live, 10 contacts)
 *   npx tsx scripts/backfill-ghl-contacts.ts                         (live, all contacts)
 *
 * Flags:
 *   --dry-run    Preview what would happen without writing to DB (default: true)
 *   --live       Actually write to DB
 *   --limit N    Process at most N contacts (default: all)
 */

import { createClient } from "@supabase/supabase-js";

const GHL_BASE_URL = "https://services.leadconnectorhq.com";
const SALES_PIPELINE_ID = "a0000000-0000-0000-0000-000000000001";
const ENGAGEMENT_STAGE_ID = "b0000000-0000-0000-0000-000000000001";

// Parse args
const args = process.argv.slice(2);
const isDryRun = !args.includes("--live");
const limitArg = args.find((_, i) => args[i - 1] === "--limit");
const limit = limitArg ? parseInt(limitArg, 10) : Infinity;

// Env
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const ghlApiKey = process.env.GHL_API_KEY;
const ghlLocationId = process.env.GHL_LOCATION_ID;

if (!supabaseUrl || !supabaseKey || !ghlApiKey || !ghlLocationId) {
  console.error("Missing required env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY, GHL_API_KEY, GHL_LOCATION_ID");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface GHLContactRaw {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  source?: string;
  tags?: string[];
  dateAdded?: string;
  customFields?: Array<{ id: string; value: string }>;
}

/** Fetch one page of contacts from GHL */
async function fetchContactsPage(startAfterId?: string): Promise<{ contacts: GHLContactRaw[]; nextPageUrl?: string }> {
  let url = `${GHL_BASE_URL}/contacts/?locationId=${ghlLocationId}&limit=100`;
  if (startAfterId) {
    url += `&startAfterId=${startAfterId}`;
  }

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${ghlApiKey}`,
      "Content-Type": "application/json",
      Version: "2021-07-28",
    },
  });

  if (!res.ok) {
    throw new Error(`GHL API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json() as { contacts: GHLContactRaw[]; meta?: { nextPageUrl?: string; startAfterId?: string } };
  return {
    contacts: data.contacts ?? [],
    nextPageUrl: data.meta?.startAfterId,
  };
}

/** Fetch ALL contacts from GHL with pagination */
async function fetchAllContacts(): Promise<GHLContactRaw[]> {
  const all: GHLContactRaw[] = [];
  let cursor: string | undefined;
  let page = 0;

  while (true) {
    page++;
    const result = await fetchContactsPage(cursor);
    all.push(...result.contacts);
    console.log(`  Page ${page}: fetched ${result.contacts.length} contacts (total so far: ${all.length})`);

    if (result.contacts.length < 100 || !result.nextPageUrl || all.length >= limit) {
      break;
    }
    cursor = result.nextPageUrl;

    // Rate limit courtesy: small delay between pages
    await new Promise((r) => setTimeout(r, 200));
  }

  return limit < Infinity ? all.slice(0, limit) : all;
}

async function main() {
  console.log(`\n=== GHL Contact Backfill ===`);
  console.log(`Mode: ${isDryRun ? "DRY RUN (no DB writes)" : "LIVE"}`);
  console.log(`Limit: ${limit === Infinity ? "ALL" : limit}`);
  console.log("");

  // Fetch contacts from GHL
  console.log("Fetching contacts from GHL...");
  const ghlContacts = await fetchAllContacts();
  console.log(`\nTotal GHL contacts fetched: ${ghlContacts.length}\n`);

  if (ghlContacts.length === 0) {
    console.log("No contacts found. Exiting.");
    return;
  }

  // Load existing contacts from Supabase for comparison
  const { data: existingContacts } = await supabase
    .from("contacts")
    .select("ghl_contact_id, id, first_name, last_name, email");

  const existingMap = new Map<string, { id: string; first_name: string; last_name: string; email: string }>();
  for (const c of existingContacts ?? []) {
    existingMap.set(c.ghl_contact_id, c);
  }

  // Load existing active pipeline states
  const { data: existingStates } = await supabase
    .from("contact_pipeline_state")
    .select("contact_id")
    .eq("pipeline_id", SALES_PIPELINE_ID)
    .eq("is_active", true);

  const stateContactIds = new Set((existingStates ?? []).map((s) => s.contact_id));

  // Look up outreach sub-task
  const { data: outreachTask } = await supabase
    .from("pipeline_sub_tasks")
    .select("id")
    .eq("slug", "outreach")
    .eq("stage_id", ENGAGEMENT_STAGE_ID)
    .single();

  // Process each contact
  let newCount = 0;
  let updateCount = 0;
  let unchangedCount = 0;
  let stateCreatedCount = 0;
  let failedCount = 0;

  for (const ghl of ghlContacts) {
    const existing = existingMap.get(ghl.id);

    if (!existing) {
      newCount++;
      if (!isDryRun) {
        try {
          const { data: inserted, error } = await supabase
            .from("contacts")
            .upsert({
              ghl_contact_id: ghl.id,
              first_name: ghl.firstName ?? null,
              last_name: ghl.lastName ?? null,
              email: ghl.email ?? null,
              phone: ghl.phone ?? null,
              address: ghl.address1 ?? null,
              city: ghl.city ?? null,
              state: ghl.state ?? null,
              zip: ghl.postalCode ?? null,
              opportunity_source: ghl.source ?? null,
              last_synced_at: new Date().toISOString(),
            }, { onConflict: "ghl_contact_id" })
            .select("id")
            .single();

          if (error) throw error;

          // Auto-create pipeline state if not exists
          if (inserted && !stateContactIds.has(inserted.id)) {
            const now = new Date().toISOString();
            await supabase.from("contact_pipeline_state").insert({
              contact_id: inserted.id,
              pipeline_id: SALES_PIPELINE_ID,
              current_stage_id: ENGAGEMENT_STAGE_ID,
              current_sub_task_id: outreachTask?.id ?? null,
              current_sub_task_started_at: now,
              entered_pipeline_at: now,
              entered_current_stage_at: now,
              is_active: true,
            });
            stateCreatedCount++;
          }
        } catch (err) {
          failedCount++;
          console.error(`  FAILED: GHL ID ${ghl.id} — ${err instanceof Error ? err.message : err}`);
        }
      }
    } else {
      // Check if data changed
      const nameChanged = (ghl.firstName ?? "") !== (existing.first_name ?? "") ||
                          (ghl.lastName ?? "") !== (existing.last_name ?? "");
      const emailChanged = (ghl.email ?? "") !== (existing.email ?? "");

      if (nameChanged || emailChanged) {
        updateCount++;
        if (!isDryRun) {
          try {
            await supabase
              .from("contacts")
              .update({
                first_name: ghl.firstName ?? null,
                last_name: ghl.lastName ?? null,
                email: ghl.email ?? null,
                phone: ghl.phone ?? null,
                address: ghl.address1 ?? null,
                city: ghl.city ?? null,
                state: ghl.state ?? null,
                zip: ghl.postalCode ?? null,
                opportunity_source: ghl.source ?? null,
                last_synced_at: new Date().toISOString(),
              })
              .eq("ghl_contact_id", ghl.id);
          } catch (err) {
            failedCount++;
            console.error(`  FAILED update: GHL ID ${ghl.id} — ${err instanceof Error ? err.message : err}`);
          }
        }
      } else {
        unchangedCount++;
      }
    }
  }

  // Summary
  console.log("=== Summary ===");
  console.log(`Total GHL contacts: ${ghlContacts.length}`);
  console.log(`New (would insert):  ${newCount}`);
  console.log(`Updates (changed):   ${updateCount}`);
  console.log(`Unchanged (skip):    ${unchangedCount}`);
  if (!isDryRun) {
    console.log(`Pipeline states created: ${stateCreatedCount}`);
    console.log(`Failed:              ${failedCount}`);
  }
  console.log(`Mode: ${isDryRun ? "DRY RUN — no DB writes made" : "LIVE — changes written to DB"}`);
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
