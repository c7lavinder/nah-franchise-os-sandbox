/**
 * Sprint 2 Phase 2.3: Backfill GHL contacts into the local contacts + pipeline state tables.
 *
 * Uses two data sources:
 *   1. CSV file ("FT Updated 4.7 - Sheet1.csv") — authoritative for stage placement
 *      - Active leads (19) → Sales Pipeline at correct stage per CSV
 *      - Nurture (1,216) → Follow-up Pipeline → Nurture stage
 *      - Skip/lost (162) → not imported
 *   2. GHL API contacts not in CSV (~1,600) → default to Follow-up → Nurture
 *
 * Usage:
 *   npx tsx scripts/backfill-ghl-contacts.ts --dry-run     (preview)
 *   npx tsx scripts/backfill-ghl-contacts.ts --live         (execute)
 *   npx tsx scripts/backfill-ghl-contacts.ts --live --limit 10
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { parse } from "path";

const GHL_BASE_URL = "https://services.leadconnectorhq.com";

// Pipeline + stage UUIDs from seed data
const SALES_PIPELINE_ID = "a0000000-0000-0000-0000-000000000001";
const FOLLOWUP_PIPELINE_ID = "a0000000-0000-0000-0000-000000000002";

// Stage UUIDs (deterministic from seeds)
const STAGE_IDS: Record<string, string> = {
  engagement: "b0000000-0000-0000-0000-000000000001",
  qualification: "b0000000-0000-0000-0000-000000000002",
  discovery: "b0000000-0000-0000-0000-000000000003",
  compliance: "b0000000-0000-0000-0000-000000000004",
  awarding: "b0000000-0000-0000-0000-000000000005",
  closed: "b0000000-0000-0000-0000-000000000006",
  nurture: "c0000000-0000-0000-0000-000000000002",
};

// CSV stage name → our pipeline stage slug
const CSV_STAGE_MAP: Record<string, string> = {
  "New Lead": "engagement",
  "Intro Call": "engagement",
  "PTO Log In Invite Sent": "engagement",
  "PTO Invite Accepted": "qualification",
  "Matt Call": "qualification",
  "Sam Call": "discovery",
  "Mark Call": "discovery",
  "FDD Review Call / Item 23 Received": "compliance",
  "Territory Call/FA Info Gathering Request Sent": "compliance",
  "Matt Final Call": "awarding",
  // Nurture/inactive
  "Never Responded": "nurture",
  "Did not show up for call": "nurture",
  "Future Interest": "nurture",
  "Lost - Funding": "nurture",
  "Lost - Never Completed PTO forms": "nurture",
  // Skip
  "Not Interested": "skip",
  "DO NOT CONTACT": "skip",
  "Bad Lead Info": "skip",
  "Lost - Bad Fit": "skip",
  "Lost - No Territory": "skip",
  "Lost - Other Franchise": "skip",
  "Lost - MD": "skip",
  "Lost - CA": "skip",
  "Lost - MN": "skip",
  "Lost - NY": "skip",
  "Lost - WA": "skip",
};

const SALES_STAGES = new Set(["engagement", "qualification", "discovery", "compliance", "awarding", "closed"]);

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

// ─── CSV Parsing ───

interface CSVRow {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  city: string;
  state: string;
  zip: string;
  stage: string; // mapped stage slug
  source: string;
}

function loadCSV(): Map<string, CSVRow> {
  const csvPath = "FT Updated 4.7 - Sheet1.csv";
  const raw = readFileSync(csvPath, "utf-8");
  const lines = raw.split("\n");
  const header = lines[0].split(",");

  // Find column indices
  const idx = (name: string) => header.indexOf(name);
  const emailIdx = idx("email");
  const fnIdx = idx("firstName");
  const lnIdx = idx("lastName");
  const phoneIdx = idx("phone");
  const cityIdx = idx("city");
  const stateIdx = idx("state");
  const zipIdx = idx("zip");
  const stageIdx = idx("~sales_cycle_name");
  const sourceIdx = idx("~lead_source_name");

  const map = new Map<string, CSVRow>();

  // Simple CSV parse — handle quoted fields with commas
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse respecting quotes
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === "," && !inQuotes) { fields.push(current.trim()); current = ""; continue; }
      current += ch;
    }
    fields.push(current.trim());

    const email = (fields[emailIdx] ?? "").toLowerCase().trim();
    const stageName = fields[stageIdx] ?? "";
    const cleanStage = stageName.length < 50 && !stageName.includes("<") ? stageName.trim() : "";
    const mapped = CSV_STAGE_MAP[cleanStage] ?? "nurture"; // Unknown CSV stages default to nurture

    if (!email) continue;

    map.set(email, {
      email,
      firstName: fields[fnIdx] ?? "",
      lastName: fields[lnIdx] ?? "",
      phone: fields[phoneIdx] ?? "",
      city: fields[cityIdx] ?? "",
      state: fields[stateIdx] ?? "",
      zip: fields[zipIdx] ?? "",
      stage: mapped,
      source: fields[sourceIdx] ?? "",
    });
  }

  return map;
}

// ─── GHL API ───

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
}

interface PageCursor { startAfterId: string; startAfter: number; }

async function fetchPage(cursor?: PageCursor): Promise<{ contacts: GHLContactRaw[]; nextCursor?: PageCursor }> {
  let url = `${GHL_BASE_URL}/contacts/?locationId=${ghlLocationId}&limit=100`;
  if (cursor) url += `&startAfterId=${cursor.startAfterId}&startAfter=${cursor.startAfter}`;

  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${ghlApiKey}`, "Content-Type": "application/json", Version: "2021-07-28" },
    });
    if (res.status === 429) {
      const wait = parseInt(res.headers.get("retry-after") ?? "10", 10);
      console.warn(`  Rate limited — waiting ${wait}s...`);
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    if (!res.ok) throw new Error(`GHL API error: ${res.status}`);
    const data = await res.json() as { contacts: GHLContactRaw[]; meta?: { startAfterId?: string; startAfter?: number } };
    const nextCursor = data.meta?.startAfterId && data.meta?.startAfter != null
      ? { startAfterId: data.meta.startAfterId, startAfter: data.meta.startAfter } : undefined;
    return { contacts: data.contacts ?? [], nextCursor };
  }
  throw new Error("Rate limit exceeded");
}

async function fetchAllContacts(): Promise<GHLContactRaw[]> {
  const seen = new Map<string, GHLContactRaw>();
  let cursor: PageCursor | undefined;
  let page = 0;

  while (true) {
    page++;
    const result = await fetchPage(cursor);
    for (const c of result.contacts) { if (!seen.has(c.id)) seen.set(c.id, c); }
    if (page % 5 === 0) console.log(`  Page ${page}: ${seen.size} unique contacts`);
    if (result.contacts.length < 100 || !result.nextCursor || seen.size >= limit) break;
    cursor = result.nextCursor;
    await new Promise((r) => setTimeout(r, 250));
  }
  console.log(`  Final: ${seen.size} unique contacts across ${page} pages`);
  return Array.from(seen.values());
}

// ─── Main ───

async function main() {
  console.log(`\n=== GHL Contact Backfill (CSV + API) ===`);
  console.log(`Mode: ${isDryRun ? "DRY RUN" : "LIVE"}`);
  console.log(`Limit: ${limit === Infinity ? "ALL" : limit}\n`);

  // Load CSV
  console.log("Loading CSV...");
  const csvMap = loadCSV();
  console.log(`CSV rows loaded: ${csvMap.size} (by email)\n`);

  // CSV stats
  const csvStats = { sales: 0, nurture: 0, skip: 0 };
  const csvStageDetail: Record<string, number> = {};
  for (const [, row] of csvMap) {
    if (row.stage === "skip") csvStats.skip++;
    else if (SALES_STAGES.has(row.stage)) { csvStats.sales++; csvStageDetail[row.stage] = (csvStageDetail[row.stage] ?? 0) + 1; }
    else csvStats.nurture++;
  }
  console.log(`CSV categories: ${csvStats.sales} active sales, ${csvStats.nurture} nurture, ${csvStats.skip} skip`);
  if (csvStats.sales > 0) {
    console.log(`  Sales stage breakdown: ${Object.entries(csvStageDetail).map(([k, v]) => `${k}=${v}`).join(", ")}`);
  }

  // Fetch GHL contacts
  console.log("\nFetching contacts from GHL API...");
  const ghlContacts = await fetchAllContacts();
  console.log(`\nGHL contacts: ${ghlContacts.length}`);

  // Look up first sub-task per stage for current_sub_task_id
  const stageFirstSubTask: Record<string, string | null> = {};
  for (const slug of Object.keys(STAGE_IDS)) {
    if (!SALES_STAGES.has(slug)) continue;
    const { data } = await supabase
      .from("pipeline_sub_tasks")
      .select("id")
      .eq("stage_id", STAGE_IDS[slug])
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();
    stageFirstSubTask[slug] = data?.id ?? null;
  }

  // Load existing data from Supabase
  const { data: existingContacts } = await supabase.from("contacts").select("ghl_contact_id, id");
  const existingMap = new Map<string, string>();
  for (const c of existingContacts ?? []) existingMap.set(c.ghl_contact_id, c.id);

  const { data: existingSalesStates } = await supabase
    .from("contact_pipeline_state").select("contact_id").eq("pipeline_id", SALES_PIPELINE_ID).eq("is_active", true);
  const { data: existingFollowupStates } = await supabase
    .from("contact_pipeline_state").select("contact_id").eq("pipeline_id", FOLLOWUP_PIPELINE_ID).eq("is_active", true);
  const salesStateSet = new Set((existingSalesStates ?? []).map((s) => s.contact_id));
  const followupStateSet = new Set((existingFollowupStates ?? []).map((s) => s.contact_id));

  // Process
  let contactsInserted = 0;
  let contactsUpdated = 0;
  let salesCreated = 0;
  let nurtureCreated = 0;
  let skippedCount = 0;
  let failed = 0;

  const toProcess = limit < Infinity ? ghlContacts.slice(0, limit) : ghlContacts;

  for (const ghl of toProcess) {
    const email = (ghl.email ?? "").toLowerCase().trim();
    const csvRow = email ? csvMap.get(email) : undefined;

    // Determine destination
    let stage: string;
    if (csvRow) {
      stage = csvRow.stage;
    } else {
      // Not in CSV → default to nurture
      stage = "nurture";
    }

    if (stage === "skip") { skippedCount++; continue; }

    const isExisting = existingMap.has(ghl.id);

    if (!isDryRun) {
      try {
        // Upsert contact
        const { data: row, error } = await supabase
          .from("contacts")
          .upsert({
            ghl_contact_id: ghl.id,
            first_name: ghl.firstName ?? csvRow?.firstName ?? null,
            last_name: ghl.lastName ?? csvRow?.lastName ?? null,
            email: ghl.email ?? null,
            phone: ghl.phone ?? csvRow?.phone ?? null,
            address: ghl.address1 ?? null,
            city: ghl.city ?? csvRow?.city ?? null,
            state: ghl.state ?? csvRow?.state ?? null,
            zip: ghl.postalCode ?? csvRow?.zip ?? null,
            opportunity_source: ghl.source ?? csvRow?.source ?? null,
            last_synced_at: new Date().toISOString(),
          }, { onConflict: "ghl_contact_id" })
          .select("id")
          .single();

        if (error) throw error;
        if (isExisting) contactsUpdated++; else contactsInserted++;

        const now = new Date().toISOString();

        // Create pipeline state
        if (SALES_STAGES.has(stage) && !salesStateSet.has(row.id)) {
          const stageId = STAGE_IDS[stage];
          const subTaskId = stageFirstSubTask[stage] ?? null;
          await supabase.from("contact_pipeline_state").insert({
            contact_id: row.id,
            pipeline_id: SALES_PIPELINE_ID,
            current_stage_id: stageId,
            current_sub_task_id: subTaskId,
            current_sub_task_started_at: now,
            entered_pipeline_at: now,
            entered_current_stage_at: now,
            is_active: true,
          });
          salesStateSet.add(row.id);
          salesCreated++;
        } else if (stage === "nurture" && !followupStateSet.has(row.id)) {
          await supabase.from("contact_pipeline_state").insert({
            contact_id: row.id,
            pipeline_id: FOLLOWUP_PIPELINE_ID,
            current_stage_id: STAGE_IDS.nurture,
            current_sub_task_id: null,
            current_sub_task_started_at: null,
            entered_pipeline_at: now,
            entered_current_stage_at: now,
            is_active: true,
          });
          followupStateSet.add(row.id);
          nurtureCreated++;
        }
      } catch (err) {
        failed++;
        if (failed <= 10) console.error(`  FAILED: ${ghl.id} — ${err instanceof Error ? err.message : err}`);
      }
    } else {
      if (isExisting) contactsUpdated++; else contactsInserted++;
      if (SALES_STAGES.has(stage)) salesCreated++;
      else if (stage === "nurture") nurtureCreated++;
    }
  }

  console.log("\n=== Summary ===");
  console.log(`GHL contacts processed: ${toProcess.length}`);
  console.log(`Contacts inserted:      ${contactsInserted}`);
  console.log(`Contacts updated:       ${contactsUpdated}`);
  console.log(`Skipped (lost/DNC):     ${skippedCount}`);
  console.log(`Sales states created:   ${salesCreated}`);
  console.log(`Nurture states created: ${nurtureCreated}`);
  if (!isDryRun) console.log(`Failed:                 ${failed}`);
  console.log(`Mode: ${isDryRun ? "DRY RUN" : "LIVE"}`);
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
