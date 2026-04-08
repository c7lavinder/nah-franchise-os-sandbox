/**
 * Sprint 8 — Tag converted franchisees from Client Tether CSV.
 *
 * Usage:
 *   npx tsx scripts/tag-converted-franchisees.ts --dry-run
 *   npx tsx scripts/tag-converted-franchisees.ts --dry-run --limit 10
 *   npx tsx scripts/tag-converted-franchisees.ts --live   (requires human approval)
 */

import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

// ─── Config ───

const CSV_PATH = path.join(__dirname, "..", "FT Updated 4.7 - Sheet1.csv");
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY. Run: source .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const args = process.argv.slice(2);
const isDryRun = !args.includes("--live");
const limitArg = args.find((a) => a.startsWith("--limit"));
const limitIdx = args.indexOf("--limit");
const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : Infinity;

// ─── CSV parsing ───

interface CsvRow {
  client_id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  closed_deal: string;
  completed_deal: string;
  creation_date: string;
}

function parseCsv(filePath: string): CsvRow[] {
  const raw = fs.readFileSync(filePath, "utf-8");
  const lines = raw.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === "," && !inQuotes) { values.push(current.trim()); current = ""; continue; }
      current += ch;
    }
    values.push(current.trim());

    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ""; });
    return row as unknown as CsvRow;
  });
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10); // last 10 digits
}

// ─── Main ───

async function main() {
  console.log(`\n=== Sprint 8: Converted Franchisee Tagging ===`);
  console.log(`Mode: ${isDryRun ? "DRY-RUN (no writes)" : "LIVE"}`);
  if (limit < Infinity) console.log(`Limit: ${limit}`);
  console.log();

  // 1. Parse CSV
  const allRows = parseCsv(CSV_PATH);
  const converted = allRows
    .filter((r) => r.closed_deal === "1" || r.completed_deal === "1")
    .slice(0, limit);

  console.log(`Total CSV rows: ${allRows.length}`);
  console.log(`Converted (closed_deal=1 OR completed_deal=1): ${converted.length}`);
  console.log();

  if (converted.length === 0) {
    console.log("No converted contacts found in CSV. Done.");
    return;
  }

  // 2. Fetch all local contacts for matching
  const { data: contacts, error } = await supabase
    .from("contacts")
    .select("id, ghl_contact_id, first_name, last_name, email, phone, is_converted_franchisee");

  if (error || !contacts) {
    console.error("Failed to fetch contacts:", error?.message);
    return;
  }
  console.log(`Local contacts in Supabase: ${contacts.length}`);

  // Build lookup indexes
  const byEmail = new Map<string, typeof contacts[0]>();
  const byPhone = new Map<string, typeof contacts[0]>();
  const byName = new Map<string, typeof contacts[0][]>();

  for (const c of contacts) {
    if (c.email) byEmail.set(c.email.toLowerCase(), c);
    if (c.phone) byPhone.set(normalizePhone(c.phone), c);
    const nameKey = `${(c.first_name ?? "").toLowerCase()} ${(c.last_name ?? "").toLowerCase()}`.trim();
    if (nameKey) {
      if (!byName.has(nameKey)) byName.set(nameKey, []);
      byName.get(nameKey)!.push(c);
    }
  }

  // 3. Match each converted row
  interface MatchResult {
    csvRow: CsvRow;
    contact: typeof contacts[0] | null;
    matchMethod: string;
    alreadyTagged: boolean;
  }

  const results: MatchResult[] = [];

  for (const row of converted) {
    let contact: typeof contacts[0] | null = null;
    let matchMethod = "unmatched";

    // Try email
    if (row.email) {
      const found = byEmail.get(row.email.toLowerCase());
      if (found) { contact = found; matchMethod = "email"; }
    }

    // Try phone
    if (!contact && row.phone) {
      const found = byPhone.get(normalizePhone(row.phone));
      if (found) { contact = found; matchMethod = "phone"; }
    }

    // Try name (only if unique)
    if (!contact) {
      const nameKey = `${row.firstName.toLowerCase()} ${row.lastName.toLowerCase()}`.trim();
      const found = byName.get(nameKey);
      if (found?.length === 1) { contact = found[0]; matchMethod = "name (unique)"; }
      else if (found && found.length > 1) { matchMethod = `name (ambiguous: ${found.length} matches)`; }
      else { matchMethod = "no match"; }
    }

    results.push({
      csvRow: row,
      contact,
      matchMethod,
      alreadyTagged: contact?.is_converted_franchisee ?? false,
    });
  }

  // 4. Report
  const matched = results.filter((r) => r.contact);
  const unmatched = results.filter((r) => !r.contact);
  const newlyTagged = matched.filter((r) => !r.alreadyTagged);
  const alreadyTagged = matched.filter((r) => r.alreadyTagged);

  console.log(`\n─── Results ───`);
  console.log(`Matched to local contact: ${matched.length}`);
  console.log(`  - Would be newly tagged: ${newlyTagged.length}`);
  console.log(`  - Already tagged: ${alreadyTagged.length}`);
  console.log(`Unmatched: ${unmatched.length}`);

  if (unmatched.length > 0) {
    console.log(`\nUnmatched details:`);
    for (const r of unmatched.slice(0, 5)) {
      console.log(`  ${r.csvRow.firstName} ${r.csvRow.lastName} | email=${r.csvRow.email} | phone=${r.csvRow.phone} | reason: ${r.matchMethod}`);
    }
  }

  console.log(`\nSample matches (up to 10):`);
  for (const r of matched.slice(0, 10)) {
    console.log(`  CSV: ${r.csvRow.firstName} ${r.csvRow.lastName} (${r.csvRow.email})`);
    console.log(`    → Local: ${r.contact!.first_name} ${r.contact!.last_name} (${r.contact!.id.slice(0, 8)}...) via ${r.matchMethod}`);
    console.log(`    → ${r.alreadyTagged ? "Already tagged" : "WOULD TAG"}`);
  }

  // 5. Apply if live mode
  if (!isDryRun && newlyTagged.length > 0) {
    console.log(`\n─── LIVE MODE: Tagging ${newlyTagged.length} contacts ───`);
    let success = 0;
    let failed = 0;

    for (const r of newlyTagged) {
      const { error: updateErr } = await supabase
        .from("contacts")
        .update({
          is_converted_franchisee: true,
          converted_at: new Date().toISOString(),
        })
        .eq("id", r.contact!.id);

      if (updateErr) {
        console.error(`  FAILED: ${r.contact!.id} — ${updateErr.message}`);
        failed++;
      } else {
        success++;
      }
    }

    console.log(`\nTagged: ${success}, Failed: ${failed}`);
  } else if (!isDryRun) {
    console.log("\nNo new contacts to tag.");
  }

  console.log("\nDone.");
}

main().catch(console.error);
