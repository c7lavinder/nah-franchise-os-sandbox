/**
 * Sprint 2 Phase 2.3: Backfill GHL contacts into the local contacts table.
 *
 * Pulls contacts from the configured GHL_LOCATION_ID (~3,000 contacts).
 * Categorizes by tag:
 *   - "nurture" tag → Follow-up Pipeline → Nurture stage
 *   - "closed-lost" tag (no nurture) → skipped (trash per §1.19)
 *   - All others → Sales Pipeline → Engagement stage
 *
 * Usage:
 *   npx tsx scripts/backfill-ghl-contacts.ts --dry-run --limit 10   (preview)
 *   npx tsx scripts/backfill-ghl-contacts.ts --live --limit 10       (live, 10)
 *   npx tsx scripts/backfill-ghl-contacts.ts --live                  (live, all)
 *
 * Flags:
 *   --dry-run    Preview only, no DB writes (default)
 *   --live       Actually write to DB
 *   --limit N    Process at most N contacts
 */

import { createClient } from "@supabase/supabase-js";

const GHL_BASE_URL = "https://services.leadconnectorhq.com";

// Pipeline + stage UUIDs from seed data
const SALES_PIPELINE_ID = "a0000000-0000-0000-0000-000000000001";
const ENGAGEMENT_STAGE_ID = "b0000000-0000-0000-0000-000000000001";
const FOLLOWUP_PIPELINE_ID = "a0000000-0000-0000-0000-000000000002";
const NURTURE_STAGE_ID = "c0000000-0000-0000-0000-000000000002";

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
  console.error("Missing required env vars");
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
}

type Category = "sales" | "nurture" | "skip";

/** Categorize a contact by tags per §1.19 */
function categorize(tags: string[]): Category {
  const tagSet = new Set(tags.map((t) => t.toLowerCase()));
  if (tagSet.has("nurture")) return "nurture";
  if (tagSet.has("closed-lost")) return "skip";
  return "sales";
}

interface PageCursor {
  startAfterId: string;
  startAfter: number;
}

/** Fetch one page of contacts with rate-limit retry */
async function fetchPage(cursor?: PageCursor): Promise<{ contacts: GHLContactRaw[]; nextCursor?: PageCursor }> {
  let url = `${GHL_BASE_URL}/contacts/?locationId=${ghlLocationId}&limit=100`;
  if (cursor) url += `&startAfterId=${cursor.startAfterId}&startAfter=${cursor.startAfter}`;

  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${ghlApiKey}`, "Content-Type": "application/json", Version: "2021-07-28" },
    });

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("retry-after") ?? "10", 10);
      console.warn(`  Rate limited — waiting ${retryAfter}s (attempt ${attempt + 1}/5)...`);
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      continue;
    }

    if (!res.ok) throw new Error(`GHL API error: ${res.status}`);

    const data = await res.json() as {
      contacts: GHLContactRaw[];
      meta?: { startAfterId?: string; startAfter?: number; total?: number; nextPage?: number | null };
    };
    const contacts = data.contacts ?? [];

    const nextCursor = data.meta?.startAfterId && data.meta?.startAfter != null
      ? { startAfterId: data.meta.startAfterId, startAfter: data.meta.startAfter }
      : undefined;

    return { contacts, nextCursor };
  }

  throw new Error("GHL API rate limit exceeded after 5 retries");
}

/** Fetch all contacts with pagination, deduplicated by ID */
async function fetchAllContacts(): Promise<GHLContactRaw[]> {
  const seen = new Map<string, GHLContactRaw>();
  let cursor: PageCursor | undefined;
  let page = 0;

  while (true) {
    page++;
    const result = await fetchPage(cursor);

    let newThisPage = 0;
    for (const c of result.contacts) {
      if (!seen.has(c.id)) {
        seen.set(c.id, c);
        newThisPage++;
      }
    }

    if (page % 5 === 0) console.log(`  Page ${page}: ${seen.size} unique contacts`);

    if (result.contacts.length < 100 || !result.nextCursor || seen.size >= limit) break;
    cursor = result.nextCursor;
    await new Promise((r) => setTimeout(r, 250));
  }

  console.log(`  Final: ${seen.size} unique contacts across ${page} pages`);
  const all = Array.from(seen.values());
  return limit < Infinity ? all.slice(0, limit) : all;
}

async function main() {
  console.log(`\n=== GHL Contact Backfill ===`);
  console.log(`Mode: ${isDryRun ? "DRY RUN (no DB writes)" : "LIVE"}`);
  console.log(`Limit: ${limit === Infinity ? "ALL" : limit}`);
  console.log(`Location: ${ghlLocationId}\n`);

  // Fetch contacts
  console.log("Fetching contacts from GHL...");
  const ghlContacts = await fetchAllContacts();
  console.log(`Total fetched: ${ghlContacts.length}\n`);

  if (ghlContacts.length === 0) return;

  // Categorize
  const categoryCounts = { sales: 0, nurture: 0, skip: 0 };
  const categorized = ghlContacts.map((c) => {
    const cat = categorize(c.tags ?? []);
    categoryCounts[cat]++;
    return { contact: c, category: cat };
  });

  console.log(`Categories: sales=${categoryCounts.sales} nurture=${categoryCounts.nurture} skip=${categoryCounts.skip}\n`);

  // Load existing contacts from Supabase
  const { data: existingContacts } = await supabase.from("contacts").select("ghl_contact_id, id");
  const existingMap = new Map<string, string>();
  for (const c of existingContacts ?? []) existingMap.set(c.ghl_contact_id, c.id);

  // Load existing active pipeline states
  const { data: salesStates } = await supabase
    .from("contact_pipeline_state")
    .select("contact_id")
    .eq("pipeline_id", SALES_PIPELINE_ID)
    .eq("is_active", true);
  const { data: followupStates } = await supabase
    .from("contact_pipeline_state")
    .select("contact_id")
    .eq("pipeline_id", FOLLOWUP_PIPELINE_ID)
    .eq("is_active", true);

  const salesContactIds = new Set((salesStates ?? []).map((s) => s.contact_id));
  const followupContactIds = new Set((followupStates ?? []).map((s) => s.contact_id));

  // Look up outreach sub-task
  const { data: outreachTask } = await supabase
    .from("pipeline_sub_tasks")
    .select("id")
    .eq("slug", "outreach")
    .eq("stage_id", ENGAGEMENT_STAGE_ID)
    .single();

  // Process
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let salesStateCreated = 0;
  let nurtureStateCreated = 0;
  let failed = 0;

  for (const { contact: ghl, category } of categorized) {
    if (category === "skip") { skipped++; continue; }

    const existing = existingMap.get(ghl.id);

    if (!isDryRun) {
      try {
        // Upsert contact
        const { data: row, error } = await supabase
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

        if (!existing) inserted++;
        else updated++;

        // Create pipeline state based on category
        const now = new Date().toISOString();
        if (category === "sales" && !salesContactIds.has(row.id)) {
          await supabase.from("contact_pipeline_state").insert({
            contact_id: row.id,
            pipeline_id: SALES_PIPELINE_ID,
            current_stage_id: ENGAGEMENT_STAGE_ID,
            current_sub_task_id: outreachTask?.id ?? null,
            current_sub_task_started_at: now,
            entered_pipeline_at: now,
            entered_current_stage_at: now,
            is_active: true,
          });
          salesStateCreated++;
        } else if (category === "nurture" && !followupContactIds.has(row.id)) {
          await supabase.from("contact_pipeline_state").insert({
            contact_id: row.id,
            pipeline_id: FOLLOWUP_PIPELINE_ID,
            current_stage_id: NURTURE_STAGE_ID,
            current_sub_task_id: null,
            current_sub_task_started_at: null,
            entered_pipeline_at: now,
            entered_current_stage_at: now,
            is_active: true,
          });
          nurtureStateCreated++;
        }
      } catch (err) {
        failed++;
        console.error(`  FAILED: ${ghl.id} — ${err instanceof Error ? err.message : err}`);
      }
    } else {
      if (!existing) inserted++;
      else updated++;
    }
  }

  console.log("=== Summary ===");
  console.log(`Total GHL contacts:     ${ghlContacts.length}`);
  console.log(`Categorized as sales:   ${categoryCounts.sales}`);
  console.log(`Categorized as nurture: ${categoryCounts.nurture}`);
  console.log(`Skipped (closed-lost):  ${categoryCounts.skip}`);
  console.log(`---`);
  console.log(`New inserts:            ${inserted}`);
  console.log(`Updates:                ${updated}`);
  console.log(`Skipped:                ${skipped}`);
  if (!isDryRun) {
    console.log(`Sales states created:   ${salesStateCreated}`);
    console.log(`Nurture states created: ${nurtureStateCreated}`);
    console.log(`Failed:                 ${failed}`);
  }
  console.log(`Mode: ${isDryRun ? "DRY RUN — no DB writes" : "LIVE"}`);
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
