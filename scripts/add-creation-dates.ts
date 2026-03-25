/**
 * Follow-up script: Add creation dates from Client Tether to GHL contact notes.
 *
 * Run AFTER import-client-tether.ts to add original lead dates to all imported contacts.
 * Finds each contact in GHL by email/phone, then adds a note with the creation date.
 *
 * Usage:
 *   npx tsx scripts/add-creation-dates.ts              # full run
 *   npx tsx scripts/add-creation-dates.ts --dry-run     # preview only
 */

import { config } from "dotenv";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve } from "path";

config({ path: ".env.local" });

const GHL_BASE = "https://services.leadconnectorhq.com";
const API_KEY = process.env.GHL_API_KEY!;
const LOCATION_ID = process.env.GHL_LOCATION_ID!;

const CSV_PATH = resolve("CT Contact Master - Sheet1.csv");
const PROGRESS_PATH = resolve("data/.creation-date-progress.json");
const DRY_RUN = process.argv.includes("--dry-run");

const headers: Record<string, string> = {
  Authorization: `Bearer ${API_KEY}`,
  "Content-Type": "application/json",
  Version: "2021-07-28",
};

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ═══════════════════════════════════════════════
// CSV PARSER (same as import script)
// ═══════════════════════════════════════════════

interface CSVRow {
  client_id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  compName: string;
  creation_date: string;
  lead_source_name: string;
  sales_cycle_name: string;
}

function parseCSV(filePath: string): CSVRow[] {
  let raw = readFileSync(filePath, "utf-8");
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  raw = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    const next = raw[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') { currentField += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { currentField += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ",") { currentRow.push(currentField); currentField = ""; }
      else if (ch === "\n") { currentRow.push(currentField); currentField = ""; rows.push(currentRow); currentRow = []; }
      else { currentField += ch; }
    }
  }
  if (currentField || currentRow.length > 0) { currentRow.push(currentField); rows.push(currentRow); }

  const headerRow = rows[0];
  if (!headerRow) throw new Error("CSV is empty");
  const colIndex: Record<string, number> = {};
  headerRow.forEach((h, i) => { colIndex[h.trim()] = i; });

  const result: CSVRow[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r];
    if (!cols || cols.length < 5) continue;
    const get = (name: string) => (cols[colIndex[name]] ?? "").trim();
    result.push({
      client_id: get("client_id"),
      firstName: get("firstName"),
      lastName: get("lastName"),
      phone: get("phone"),
      email: get("email"),
      compName: get("compName"),
      creation_date: get("creation_date"),
      lead_source_name: get("~lead_source_name"),
      sales_cycle_name: get("~sales_cycle_name"),
    });
  }
  return result;
}

// ═══════════════════════════════════════════════
// GHL API
// ═══════════════════════════════════════════════

async function ghlGet<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${GHL_BASE}${endpoint}`, { headers });
  if (!res.ok) throw new Error(`GET ${endpoint} → ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

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
      await delay(delayMs);
      continue;
    }
    if (!res.ok) throw new Error(`POST ${endpoint} → ${res.status}: ${await res.text()}`);
    return res.json() as Promise<T>;
  }
  throw new Error(`POST ${endpoint} → rate limited after ${MAX_RETRIES} retries`);
}

// ═══════════════════════════════════════════════
// PROGRESS
// ═══════════════════════════════════════════════

function loadProgress(): Set<string> {
  if (existsSync(PROGRESS_PATH)) {
    const data = JSON.parse(readFileSync(PROGRESS_PATH, "utf-8")) as { done: string[] };
    console.log(`  Resuming — ${data.done.length} already processed.\n`);
    return new Set(data.done);
  }
  return new Set();
}

function saveProgress(done: Set<string>) {
  if (!existsSync(resolve("data"))) mkdirSync(resolve("data"), { recursive: true });
  writeFileSync(PROGRESS_PATH, JSON.stringify({ done: [...done] }));
}

// ═══════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════

async function main() {
  console.log("╔═══════════════════════════════════════════════╗");
  console.log("║   Add Creation Dates to GHL Contact Notes     ║");
  console.log("╚═══════════════════════════════════════════════╝");
  if (DRY_RUN) console.log("\n  DRY RUN MODE\n");

  const rows = parseCSV(CSV_PATH);
  console.log(`  Parsed ${rows.length} contacts\n`);

  const done = loadProgress();
  const SKIP_STAGES = new Set(["Bad Lead Info"]);

  let added = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const fullName = `${row.firstName || "?"} ${row.lastName || "?"}`.trim();

    if (done.has(row.client_id)) continue;
    if (SKIP_STAGES.has(row.sales_cycle_name)) { done.add(row.client_id); skipped++; continue; }
    if (!row.email && !row.phone) { done.add(row.client_id); skipped++; continue; }

    // Find contact in GHL by email or phone
    const query = row.email || row.phone;
    if (!query) { done.add(row.client_id); skipped++; continue; }

    if (DRY_RUN) {
      console.log(`  + ${fullName} — date: ${row.creation_date || "Unknown"}`);
      done.add(row.client_id);
      added++;
      continue;
    }

    try {
      // Search for contact
      const searchResult = await ghlGet<{ contacts: { id: string }[] }>(
        `/contacts/?locationId=${LOCATION_ID}&query=${encodeURIComponent(query)}&limit=1`
      );

      if (!searchResult.contacts?.length) {
        console.log(`  - SKIP ${fullName} — not found in GHL`);
        done.add(row.client_id);
        skipped++;
        await delay(200);
        continue;
      }

      const contactId = searchResult.contacts[0].id;

      // Build creation date note
      const noteParts = [
        `[Original Lead Info]`,
        `Lead date: ${row.creation_date || "Unknown"}`,
        `Source: ${row.lead_source_name || "Unknown"}`,
        `CT stage: ${row.sales_cycle_name || "Unknown"}`,
      ];
      if (row.compName) {
        noteParts.push(`Callback: ${row.compName}`);
      }

      await ghlPost(`/contacts/${contactId}/notes`, { body: noteParts.join("\n") });
      console.log(`  + ${fullName} — ${row.creation_date}`);
      added++;

      done.add(row.client_id);
      await delay(300);

      // Save progress every 25
      if (added % 25 === 0) {
        saveProgress(done);
        console.log(`  📊 Progress: ${done.size}/${rows.length}`);
      }

    } catch (err) {
      console.log(`  ! FAILED ${fullName}: ${err instanceof Error ? err.message : err}`);
      failed++;
    }
  }

  saveProgress(done);

  console.log(`\n═══ SUMMARY ═══`);
  console.log(`  + Notes added: ${added}`);
  console.log(`  - Skipped:     ${skipped}`);
  console.log(`  ! Failed:      ${failed}`);
  console.log(`  Total:         ${added + skipped + failed}\n`);
}

main().catch((err) => { console.error("Failed:", err); process.exit(1); });
