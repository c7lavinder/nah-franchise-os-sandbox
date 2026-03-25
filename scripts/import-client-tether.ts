/**
 * Client Tether CSV Import Script
 *
 * Imports franchise lead contacts from Client Tether CSV into:
 * 1. GHL — contacts + opportunities + notes
 * 2. Supabase — whiteboard notes as knowledge_documents for Scout
 *
 * Usage:
 *   npx tsx scripts/import-client-tether.ts              # full import
 *   npx tsx scripts/import-client-tether.ts --dry-run     # preview only
 *   npx tsx scripts/import-client-tether.ts --clean       # reset progress, re-import
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync } from "fs";
import { resolve } from "path";

config({ path: ".env.local" });

// ═══════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════

const GHL_BASE = "https://services.leadconnectorhq.com";
const API_KEY = process.env.GHL_API_KEY!;
const LOCATION_ID = process.env.GHL_LOCATION_ID!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!;

const CSV_PATH = resolve("CT Contact Master - Sheet1.csv");
const PROGRESS_PATH = resolve("data/.import-progress.json");

const DRY_RUN = process.argv.includes("--dry-run");
const CLEAN = process.argv.includes("--clean");

const headers: Record<string, string> = {
  Authorization: `Bearer ${API_KEY}`,
  "Content-Type": "application/json",
  Version: "2021-07-28",
};

// ═══════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════

interface ClientTetherRow {
  client_id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  compName: string;
  creation_date: string;
  whiteboard: string;
  action_plans_name: string;
  lead_source_name: string;
  sales_cycle_name: string;
  smsok: string;
}

interface StageMapping {
  pipeline: "active" | "longterm";
  ghlStage: string;
  status: "open" | "won" | "lost";
  lossReason?: string;
}

interface SourceMapping {
  source: string;
  detail: string;
  tags: string[];
}

interface Progress {
  processedClientIds: string[];
  lastProcessedAt: string;
  stats: { created: number; updated: number; skipped: number; failed: number; notes: number };
}

// ═══════════════════════════════════════════════
// STAGE MAPPING
// ═══════════════════════════════════════════════

const STAGE_MAP: Record<string, StageMapping> = {
  "New Lead":                        { pipeline: "active", ghlStage: "New Lead", status: "open" },
  "Intro Call":                      { pipeline: "active", ghlStage: "Contacted", status: "open" },
  "Did not show up for call":        { pipeline: "active", ghlStage: "Contacted", status: "open" },
  "PTO Invite Accepted":             { pipeline: "active", ghlStage: "Qualified", status: "open" },
  "Matt Call":                       { pipeline: "active", ghlStage: "Matt Call (Discovery)", status: "open" },
  "Sam Call":                        { pipeline: "active", ghlStage: "Sam Call (Validation)", status: "open" },
  "FDD Sent":                        { pipeline: "active", ghlStage: "FDD Issued", status: "open" },
  "Matt Final Call":                 { pipeline: "active", ghlStage: "Award + Agreement", status: "open" },
  "Franchise Award Letter Sent":     { pipeline: "active", ghlStage: "Award + Agreement", status: "open" },
  "Training Scheduled":              { pipeline: "active", ghlStage: "Funds Received", status: "won" },

  "Future Interest":                 { pipeline: "longterm", ghlStage: "Nurture", status: "open" },
  "Never Responded":                 { pipeline: "longterm", ghlStage: "Nurture", status: "open" },

  "Lost - Funding":                  { pipeline: "active", ghlStage: "Contacted", status: "lost", lossReason: "Not qualified financially" },
  "Lost - Bad Fit":                  { pipeline: "active", ghlStage: "Contacted", status: "lost", lossReason: "Bad fit" },
  "Lost - CA":                       { pipeline: "active", ghlStage: "Contacted", status: "lost", lossReason: "No available territory" },
  "Lost - MD":                       { pipeline: "active", ghlStage: "Contacted", status: "lost", lossReason: "No available territory" },
  "Lost - MN":                       { pipeline: "active", ghlStage: "Contacted", status: "lost", lossReason: "No available territory" },
  "Lost - NY":                       { pipeline: "active", ghlStage: "Contacted", status: "lost", lossReason: "No available territory" },
  "Lost - WA":                       { pipeline: "active", ghlStage: "Contacted", status: "lost", lossReason: "No available territory" },
  "Lost - No Territory":             { pipeline: "active", ghlStage: "Contacted", status: "lost", lossReason: "No available territory" },
  "Lost - Never Completed PTO forms": { pipeline: "active", ghlStage: "Contacted", status: "lost", lossReason: "Completely unresponsive" },
  "Lost - Other Franchise":          { pipeline: "active", ghlStage: "Contacted", status: "lost", lossReason: "Chose a competitor franchise" },
  "Not Interested":                  { pipeline: "active", ghlStage: "Contacted", status: "lost", lossReason: "Changed mind" },
  "DO NOT CONTACT":                  { pipeline: "active", ghlStage: "Contacted", status: "lost", lossReason: "Other" },
};

// Stages to skip entirely
const SKIP_STAGES = new Set(["Bad Lead Info"]);

// Loss reason → tag
const LOSS_REASON_TAGS: Record<string, string> = {
  "Not qualified financially": "lost-funding",
  "Bad fit": "lost-bad-fit",
  "No available territory": "lost-no-territory",
  "Completely unresponsive": "lost-unresponsive",
  "Changed mind": "lost-not-interested",
  "Chose a competitor franchise": "lost-competitor",
  "Other": "do-not-contact",
};

// ═══════════════════════════════════════════════
// LEAD SOURCE MAPPING
// ═══════════════════════════════════════════════

const SOURCE_MAP: Record<string, SourceMapping> = {
  "Google Ads":                      { source: "Paid Ad", detail: "Google Ads", tags: ["paid-ad", "google-ads"] },
  "Facebook":                        { source: "Paid Ad", detail: "Facebook", tags: ["paid-ad", "facebook"] },
  "LinkedIn":                        { source: "Paid Ad", detail: "LinkedIn", tags: ["paid-ad", "linkedin"] },
  "YouTube":                         { source: "Paid Ad", detail: "YouTube", tags: ["paid-ad", "youtube"] },
  "FBR":                             { source: "Referral", detail: "Franchise Business Review", tags: ["referral", "fbr"] },
  "Referral":                        { source: "Referral", detail: "Referral (General)", tags: ["referral"] },
  "Referral - Corey":                { source: "Referral", detail: "Referral - Corey", tags: ["referral", "referral-corey"] },
  "Website Form":                    { source: "Organic", detail: "Website Form", tags: ["organic", "website-form"] },
  "2024 - Houston Franchise Show":   { source: "Event", detail: "Houston Franchise Show 2024", tags: ["franchise-show"] },
  "2024 - Miami Franchise Show":     { source: "Event", detail: "Miami Franchise Show 2024", tags: ["franchise-show"] },
  "National Franchise Show - Tampa": { source: "Event", detail: "National Franchise Show Tampa", tags: ["franchise-show"] },
  "Unknown":                         { source: "Unknown", detail: "Unknown", tags: ["unknown-source"] },
};

// ═══════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════

const stats = { created: 0, updated: 0, skipped: 0, failed: 0, notes: 0, supabaseNotes: 0 };

function log(status: "CREATED" | "UPDATED" | "SKIPPED" | "FAILED" | "NOTE", category: string, name: string, detail?: string) {
  const icon = status === "CREATED" ? "+" : status === "UPDATED" ? "~" : status === "SKIPPED" ? "-" : status === "NOTE" ? "N" : "!";
  console.log(`  ${icon} ${status} [${category}] ${name}${detail ? ` — ${detail}` : ""}`);
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Strip HTML tags, preserve line breaks, decode entities */
function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Normalize phone to digits only (GHL handles formatting) */
function normalizePhone(phone: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits ? `+${digits}` : "";
}

/** Check if whiteboard has meaningful content (not just empty HTML) */
function hasMeaningfulNotes(whiteboard: string): boolean {
  if (!whiteboard) return false;
  const stripped = stripHtml(whiteboard);
  return stripped.length > 0;
}

// ═══════════════════════════════════════════════
// CSV PARSER (RFC 4180 compliant)
// ═══════════════════════════════════════════════

function parseCSV(filePath: string): ClientTetherRow[] {
  let raw = readFileSync(filePath, "utf-8");
  // Strip BOM
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  // Normalize line endings
  raw = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    const next = raw[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentField += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        currentRow.push(currentField);
        currentField = "";
      } else if (ch === "\n") {
        currentRow.push(currentField);
        currentField = "";
        rows.push(currentRow);
        currentRow = [];
      } else {
        currentField += ch;
      }
    }
  }
  // Push last field/row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  // First row is headers
  const headerRow = rows[0];
  if (!headerRow) throw new Error("CSV is empty");

  // Map column indices
  const colIndex: Record<string, number> = {};
  headerRow.forEach((h, i) => { colIndex[h.trim()] = i; });

  const result: ClientTetherRow[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r];
    if (!cols || cols.length < 5) continue; // skip blank rows

    const get = (name: string) => (cols[colIndex[name]] ?? "").trim();

    result.push({
      client_id: get("client_id"),
      firstName: get("firstName"),
      lastName: get("lastName"),
      phone: get("phone"),
      email: get("email"),
      address: get("address"),
      city: get("city"),
      state: get("state"),
      zip: get("zip"),
      compName: get("compName"),
      creation_date: get("creation_date"),
      whiteboard: get("whiteboard"),
      action_plans_name: get("~action_plans_name"),
      lead_source_name: get("~lead_source_name"),
      sales_cycle_name: get("~sales_cycle_name"),
      smsok: get("smsok"),
    });
  }

  return result;
}

// ═══════════════════════════════════════════════
// GHL API HELPERS (standalone, not using app client)
// ═══════════════════════════════════════════════

async function ghlPost<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(`${GHL_BASE}${endpoint}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (res.status === 429 && attempt < MAX_RETRIES) {
      const retryAfter = res.headers.get("retry-after");
      const delayMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.min(1000 * Math.pow(2, attempt), 10000);
      console.warn(`  ⏳ Rate limited on ${endpoint} — waiting ${delayMs}ms`);
      await delay(delayMs);
      continue;
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`POST ${endpoint} → ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  }
  throw new Error(`POST ${endpoint} → rate limited after ${MAX_RETRIES} retries`);
}

async function ghlGet<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${GHL_BASE}${endpoint}`, { headers });
  if (!res.ok) throw new Error(`GET ${endpoint} → ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

// ═══════════════════════════════════════════════
// PROGRESS TRACKING
// ═══════════════════════════════════════════════

function loadProgress(): Progress {
  if (CLEAN && existsSync(PROGRESS_PATH)) {
    unlinkSync(PROGRESS_PATH);
    console.log("  Cleaned progress file — starting fresh.\n");
  }
  if (existsSync(PROGRESS_PATH)) {
    const data = JSON.parse(readFileSync(PROGRESS_PATH, "utf-8")) as Progress;
    console.log(`  Resuming from progress file — ${data.processedClientIds.length} already processed.\n`);
    return data;
  }
  return { processedClientIds: [], lastProcessedAt: "", stats: { created: 0, updated: 0, skipped: 0, failed: 0, notes: 0 } };
}

function saveProgress(progress: Progress) {
  if (!existsSync(resolve("data"))) {
    mkdirSync(resolve("data"), { recursive: true });
  }
  progress.lastProcessedAt = new Date().toISOString();
  progress.stats = { ...stats, notes: stats.notes };
  writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2));
}

// ═══════════════════════════════════════════════
// TAG DERIVATION
// ═══════════════════════════════════════════════

function deriveTags(row: ClientTetherRow, mapping: StageMapping | null): string[] {
  const tags: string[] = ["ct-import"];

  // Lead source tags
  const sourceMapping = SOURCE_MAP[row.lead_source_name] ?? SOURCE_MAP["Unknown"]!;
  tags.push(...sourceMapping.tags);

  // Status tags
  if (!mapping) {
    tags.push("unmapped-stage");
  } else if (mapping.status === "lost") {
    tags.push("closed-lost");
    if (mapping.lossReason) {
      const lossTag = LOSS_REASON_TAGS[mapping.lossReason];
      if (lossTag) tags.push(lossTag);
    }
  } else if (mapping.status === "won") {
    tags.push("closed-won");
  } else if (mapping.pipeline === "longterm") {
    tags.push("nurture");
  }

  // DNC
  if (row.sales_cycle_name === "DO NOT CONTACT") {
    tags.push("do-not-contact");
  }

  // Notes flag
  if (hasMeaningfulNotes(row.whiteboard)) {
    tags.push("has-notes");
  }

  // SMS opt-out
  if (row.smsok?.toUpperCase() === "FALSE") {
    tags.push("no-sms");
  }

  // Name flag
  if (!row.firstName || row.firstName.toLowerCase().includes("no name")) {
    tags.push("needs-name-update");
  }

  return tags;
}

// ═══════════════════════════════════════════════
// MAIN IMPORT
// ═══════════════════════════════════════════════

async function main() {
  console.log("╔═══════════════════════════════════════════════╗");
  console.log("║   Client Tether → GHL + Supabase Import      ║");
  console.log("╚═══════════════════════════════════════════════╝");
  if (DRY_RUN) console.log("\n  🔍 DRY RUN MODE — no API calls will be made\n");

  // Validate env
  if (!API_KEY || !LOCATION_ID) {
    console.error("ERROR: Missing GHL_API_KEY or GHL_LOCATION_ID in .env.local");
    process.exit(1);
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY in .env.local");
    process.exit(1);
  }

  // Parse CSV
  console.log("\n═══ PARSING CSV ═══");
  const rows = parseCSV(CSV_PATH);
  console.log(`  Parsed ${rows.length} contacts from CSV\n`);

  // Init Supabase
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Load pipeline stage lookups from Supabase
  console.log("═══ LOADING PIPELINE LOOKUPS ═══");
  const { data: stageRows, error: stageErr } = await supabase
    .from("ghl_pipeline_stages")
    .select("pipeline_id, stage_id, stage_name");

  if (stageErr || !stageRows?.length) {
    console.error("ERROR: No pipeline stages in Supabase. Run setup-ghl-account.ts first.");
    process.exit(1);
  }

  // Build lookup maps
  const stageNameToId: Record<string, string> = {};
  const stageNameToPipelineId: Record<string, string> = {};
  for (const row of stageRows) {
    stageNameToId[row.stage_name.toLowerCase()] = row.stage_id;
    stageNameToPipelineId[row.stage_name.toLowerCase()] = row.pipeline_id;
  }
  console.log(`  Loaded ${stageRows.length} stage mappings\n`);

  // Load "Lead Source Detail" custom field ID
  const { data: fieldRows } = await supabase
    .from("ghl_custom_fields")
    .select("ghl_field_id, field_name")
    .eq("entity_type", "contact")
    .ilike("field_name", "Lead Source Detail");

  const leadSourceDetailFieldId = fieldRows?.[0]?.ghl_field_id ?? null;
  if (leadSourceDetailFieldId) {
    console.log(`  Lead Source Detail field: ${leadSourceDetailFieldId}`);
  } else {
    console.log("  ⚠ Lead Source Detail custom field not found — will skip detail field");
  }

  // Load "Loss Reason" custom field ID
  const { data: lossFieldRows } = await supabase
    .from("ghl_custom_fields")
    .select("ghl_field_id, field_name")
    .eq("entity_type", "opportunity")
    .ilike("field_name", "Loss Reason");

  const lossReasonFieldId = lossFieldRows?.[0]?.ghl_field_id ?? null;
  if (lossReasonFieldId) {
    console.log(`  Loss Reason field: ${lossReasonFieldId}\n`);
  } else {
    console.log("  ⚠ Loss Reason custom field not found — will skip loss reason\n");
  }

  // Load progress
  const progress = loadProgress();
  const processedSet = new Set(progress.processedClientIds);

  // Process rows
  console.log("═══ IMPORTING CONTACTS ═══\n");
  const skippedRows: { name: string; reason: string }[] = [];
  const failedRows: { name: string; error: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const fullName = `${row.firstName || "?"} ${row.lastName || "?"}`.trim();

    // Skip already processed
    if (processedSet.has(row.client_id)) continue;

    // Skip bad lead info
    if (SKIP_STAGES.has(row.sales_cycle_name)) {
      log("SKIPPED", "Contact", fullName, `stage: ${row.sales_cycle_name}`);
      stats.skipped++;
      processedSet.add(row.client_id);
      progress.processedClientIds.push(row.client_id);
      continue;
    }

    // Skip if no email and no phone
    if (!row.email && !row.phone) {
      log("SKIPPED", "Contact", fullName, "no email or phone");
      stats.skipped++;
      skippedRows.push({ name: fullName, reason: "no email or phone" });
      processedSet.add(row.client_id);
      progress.processedClientIds.push(row.client_id);
      continue;
    }

    // Get stage mapping
    const mapping = STAGE_MAP[row.sales_cycle_name] ?? null;
    if (!mapping) {
      console.warn(`  ⚠ Unmapped stage "${row.sales_cycle_name}" for ${fullName} — defaulting to New Lead`);
    }

    // Clean data
    const firstName = (!row.firstName || row.firstName.toLowerCase().includes("no name"))
      ? "Unknown" : row.firstName.trim();
    const lastName = (!row.lastName || row.lastName.toLowerCase().includes("added by call") || row.lastName.toLowerCase().includes("text added"))
      ? "Contact" : row.lastName.trim();
    const phone = normalizePhone(row.phone);
    const email = row.email?.trim().toLowerCase() || undefined;

    // Source mapping
    const sourceMapping = SOURCE_MAP[row.lead_source_name] ?? SOURCE_MAP["Unknown"]!;

    // Tags
    const tags = deriveTags(row, mapping);

    // Custom fields
    const customFields: { id: string; value: string }[] = [];
    if (leadSourceDetailFieldId) {
      customFields.push({ id: leadSourceDetailFieldId, value: sourceMapping.detail });
    }

    if (DRY_RUN) {
      const effectiveMapping = mapping ?? { pipeline: "active" as const, ghlStage: "New Lead", status: "open" as const };
      log("CREATED", "Contact", fullName, `${email ?? phone} | ${sourceMapping.source} | ${effectiveMapping.ghlStage} (${effectiveMapping.status})${effectiveMapping.status === "lost" && mapping?.lossReason ? ` | ${mapping.lossReason}` : ""}`);
      if (hasMeaningfulNotes(row.whiteboard)) log("NOTE", "Note", fullName, `${stripHtml(row.whiteboard).length} chars`);
      stats.created++;
      if (hasMeaningfulNotes(row.whiteboard)) stats.notes++;
      processedSet.add(row.client_id);
      progress.processedClientIds.push(row.client_id);
      continue;
    }

    // ═══ LIVE IMPORT ═══
    try {
      // 1. Upsert contact
      const isDNC = row.sales_cycle_name === "DO NOT CONTACT";
      const upsertBody: Record<string, unknown> = {
        locationId: LOCATION_ID,
        firstName,
        lastName,
        source: sourceMapping.source,
        tags,
      };
      if (email) upsertBody.email = email;
      if (phone) upsertBody.phone = phone;
      if (row.address) upsertBody.address1 = row.address.trim();
      if (row.city) upsertBody.city = row.city.trim();
      if (row.state) upsertBody.state = row.state.trim();
      if (row.zip) upsertBody.postalCode = row.zip.trim();
      if (customFields.length > 0) upsertBody.customFields = customFields;
      if (isDNC) upsertBody.dnd = true;

      const contactResult = await ghlPost<{ contact: { id: string }; new: boolean }>(
        "/contacts/upsert",
        upsertBody
      );

      const contactId = contactResult.contact.id;
      const isNew = contactResult.new;

      if (isNew) {
        log("CREATED", "Contact", fullName, email ?? phone ?? "");
        stats.created++;
      } else {
        log("UPDATED", "Contact", fullName, email ?? phone ?? "");
        stats.updated++;
      }

      await delay(200);

      // 2. Create opportunity
      const effectiveMapping = mapping ?? { pipeline: "active" as const, ghlStage: "New Lead", status: "open" as const };
      const ghlStageName = effectiveMapping.ghlStage.toLowerCase();
      const stageId = stageNameToId[ghlStageName];
      const pipelineId = stageNameToPipelineId[ghlStageName];

      if (!stageId || !pipelineId) {
        console.warn(`  ⚠ Stage "${effectiveMapping.ghlStage}" not found in Supabase lookup — skipping opportunity`);
      } else {
        const oppBody: Record<string, unknown> = {
          locationId: LOCATION_ID,
          pipelineId,
          pipelineStageId: stageId,
          name: `${firstName} ${lastName}`,
          status: effectiveMapping.status,
          contactId,
        };

        // Set loss reason custom field
        if (effectiveMapping.status === "lost" && mapping?.lossReason && lossReasonFieldId) {
          oppBody.customFields = [{ id: lossReasonFieldId, value: mapping.lossReason }];
        }

        try {
          await ghlPost("/opportunities/", oppBody);
          log("CREATED", "Opportunity", fullName, `${effectiveMapping.ghlStage} (${effectiveMapping.status})`);
        } catch (oppErr) {
          const msg = oppErr instanceof Error ? oppErr.message : String(oppErr);
          // If opportunity already exists, that's OK
          if (msg.includes("already exists") || msg.includes("409") || msg.includes("duplicate")) {
            log("SKIPPED", "Opportunity", fullName, "already exists");
          } else {
            console.warn(`  ⚠ Opportunity failed for ${fullName}: ${msg}`);
          }
        }

        await delay(200);
      }

      // 3. Add note to GHL — always include creation date, add whiteboard if present
      {
        const hasNotes = hasMeaningfulNotes(row.whiteboard);
        const plainNotes = hasNotes ? stripHtml(row.whiteboard) : "";

        const noteParts: string[] = [
          `[Imported from Client Tether]`,
          `Original lead date: ${row.creation_date || "Unknown"}`,
          `Lead source: ${row.lead_source_name || "Unknown"}`,
          `CT stage: ${row.sales_cycle_name || "Unknown"}`,
        ];

        if (row.compName) {
          noteParts.push(`Callback notes: ${row.compName}`);
        }

        if (plainNotes) {
          noteParts.push("", "--- Chad's Notes ---", "", plainNotes);
        }

        const noteBody = noteParts.join("\n");

        try {
          await ghlPost(`/contacts/${contactId}/notes`, { body: noteBody });
          log("NOTE", "GHL Note", fullName, `${noteBody.length} chars`);
          stats.notes++;
        } catch (noteErr) {
          console.warn(`  ⚠ Note failed for ${fullName}: ${noteErr instanceof Error ? noteErr.message : noteErr}`);
        }

        await delay(200);

        // 4. Store in Supabase for Scout (only if meaningful whiteboard notes)
        if (hasNotes) {
          const structuredContent = [
            `Contact: ${firstName} ${lastName}`,
            email ? `Email: ${email}` : null,
            phone ? `Phone: ${phone}` : null,
            `Original Lead Date: ${row.creation_date || "Unknown"}`,
            `Stage at Import: ${row.sales_cycle_name}`,
            `Lead Source: ${row.lead_source_name} (${sourceMapping.source})`,
            `Import Date: ${new Date().toISOString().split("T")[0]}`,
            "",
            "---",
            "",
            plainNotes,
          ].filter(Boolean).join("\n");

          try {
            await supabase.from("knowledge_documents").insert({
              title: `Contact Notes: ${firstName} ${lastName}`,
              category: "contact-notes",
              content: structuredContent,
              is_active: true,
              priority: 10,
              token_count: Math.ceil(structuredContent.length / 4),
            });
            stats.supabaseNotes++;
          } catch (supErr) {
            console.warn(`  ⚠ Supabase note failed for ${fullName}: ${supErr instanceof Error ? supErr.message : supErr}`);
          }
        }
      }

      // Mark processed
      processedSet.add(row.client_id);
      progress.processedClientIds.push(row.client_id);

      // Save progress every 25 rows
      if (progress.processedClientIds.length % 25 === 0) {
        saveProgress(progress);
        console.log(`  📊 Progress: ${progress.processedClientIds.length}/${rows.length}`);
      }

      // Rate limit delay between contacts
      await delay(100);

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log("FAILED", "Contact", fullName, msg);
      stats.failed++;
      failedRows.push({ name: fullName, error: msg });
    }
  }

  // Final save
  if (!DRY_RUN) saveProgress(progress);

  // Summary
  console.log("\n═══ IMPORT SUMMARY ═══");
  console.log(`  + Created:        ${stats.created}`);
  console.log(`  ~ Updated:        ${stats.updated}`);
  console.log(`  - Skipped:        ${stats.skipped}`);
  console.log(`  ! Failed:         ${stats.failed}`);
  console.log(`  N GHL Notes:      ${stats.notes}`);
  console.log(`  S Supabase Notes: ${stats.supabaseNotes}`);
  console.log(`  Total processed:  ${stats.created + stats.updated + stats.skipped + stats.failed}`);
  console.log(`  Total in CSV:     ${rows.length}`);

  if (skippedRows.length > 0) {
    console.log("\n  Skipped contacts:");
    skippedRows.forEach((s) => console.log(`    - ${s.name}: ${s.reason}`));
  }

  if (failedRows.length > 0) {
    console.log("\n  Failed contacts:");
    failedRows.forEach((f) => console.log(`    ! ${f.name}: ${f.error}`));
  }

  if (DRY_RUN) {
    console.log("\n  🔍 This was a dry run. No changes were made.");
    console.log("  Run without --dry-run to execute the import.\n");
  } else {
    console.log("");
  }
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
