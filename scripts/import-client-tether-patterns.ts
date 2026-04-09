/**
 * Import Client Tether CSV — Pattern Extraction
 *
 * Analyzes the CT_Contact_Master CSV for conversion patterns.
 * Does NOT import raw contacts — only extracts aggregate patterns.
 *
 * Usage: npx tsx scripts/import-client-tether-patterns.ts <path-to-csv>
 *
 * Stores:
 * 1. KB doc: "Historical conversion patterns" in ideal_candidate category
 * 2. app_settings: historical_conversion_patterns as structured JSON
 */

import "dotenv/config";
import * as fs from "fs";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

interface CSVRow {
  [key: string]: string;
}

function parseCSV(content: string): CSVRow[] {
  const lines = content.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows: CSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: CSVRow = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? "";
    }
    rows.push(row);
  }

  return rows;
}

function analyzePatterns(rows: CSVRow[]): Record<string, unknown> {
  const patterns: Record<string, unknown> = {
    total_records: rows.length,
    analyzed_at: new Date().toISOString(),
  };

  // Lead source distribution
  const sources: Record<string, number> = {};
  for (const row of rows) {
    const source = row["Source"] || row["source"] || row["Lead Source"] || "Unknown";
    sources[source] = (sources[source] ?? 0) + 1;
  }
  patterns.lead_source_distribution = Object.entries(sources)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([source, count]) => ({ source, count, pct: Math.round((count / rows.length) * 100) }));

  // Geographic distribution
  const states: Record<string, number> = {};
  const cities: Record<string, number> = {};
  for (const row of rows) {
    const state = row["State"] || row["state"] || "";
    const city = row["City"] || row["city"] || "";
    if (state) states[state] = (states[state] ?? 0) + 1;
    if (city) cities[city] = (cities[city] ?? 0) + 1;
  }
  patterns.top_states = Object.entries(states).sort((a, b) => b[1] - a[1]).slice(0, 10);
  patterns.top_cities = Object.entries(cities).sort((a, b) => b[1] - a[1]).slice(0, 10);

  // Date patterns
  const months: Record<string, number> = {};
  for (const row of rows) {
    const date = row["Date Added"] || row["Created"] || row["date_added"] || "";
    if (date) {
      const month = date.slice(0, 7); // YYYY-MM
      if (month.match(/^\d{4}-\d{2}$/)) {
        months[month] = (months[month] ?? 0) + 1;
      }
    }
  }
  patterns.monthly_volume = Object.entries(months).sort((a, b) => a[0].localeCompare(b[0]));

  // Status/stage distribution
  const statuses: Record<string, number> = {};
  for (const row of rows) {
    const status = row["Status"] || row["status"] || row["Stage"] || row["stage"] || "";
    if (status) statuses[status] = (statuses[status] ?? 0) + 1;
  }
  patterns.status_distribution = Object.entries(statuses)
    .sort((a, b) => b[1] - a[1])
    .map(([status, count]) => ({ status, count, pct: Math.round((count / rows.length) * 100) }));

  // Tag distribution (if exists)
  const tags: Record<string, number> = {};
  for (const row of rows) {
    const tagStr = row["Tags"] || row["tags"] || "";
    for (const tag of tagStr.split(/[,;]/).map((t) => t.trim()).filter(Boolean)) {
      tags[tag] = (tags[tag] ?? 0) + 1;
    }
  }
  if (Object.keys(tags).length > 0) {
    patterns.top_tags = Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 15);
  }

  return patterns;
}

async function main() {
  const csvPath = process.argv[2];

  if (!csvPath) {
    console.error("Usage: npx tsx scripts/import-client-tether-patterns.ts <path-to-csv>");
    console.error("\nProvide the path to CT_Contact_Master__Sheet1_1.csv");
    process.exit(1);
  }

  if (!fs.existsSync(csvPath)) {
    console.error(`File not found: ${csvPath}`);
    process.exit(1);
  }

  console.log("=== Client Tether CSV Pattern Extraction ===\n");

  const content = fs.readFileSync(csvPath, "utf8");
  const rows = parseCSV(content);
  console.log(`Parsed ${rows.length} records\n`);

  if (rows.length === 0) {
    console.error("No data rows found in CSV");
    process.exit(1);
  }

  // Show column headers
  console.log("Columns found:", Object.keys(rows[0]).join(", "));

  const patterns = analyzePatterns(rows);

  console.log("\n--- Patterns ---");
  console.log(JSON.stringify(patterns, null, 2));

  // Store patterns in app_settings
  console.log("\nSaving patterns to app_settings...");
  const { error: settingsErr } = await supabase
    .from("app_settings")
    .upsert({
      setting_key: "historical_conversion_patterns",
      setting_value: JSON.stringify(patterns),
      description: "Patterns extracted from Client Tether CSV (1,389 records)",
    }, { onConflict: "setting_key" });

  if (settingsErr) {
    console.error("  Failed:", settingsErr.message);
  } else {
    console.log("  ✅ Saved to app_settings");
  }

  // Create KB doc
  console.log("\nCreating KB document...");
  const kbContent = `## Historical Conversion Patterns

Extracted from Client Tether CSV (${rows.length} records).

### Lead Source Distribution
${(patterns.lead_source_distribution as Array<{ source: string; count: number; pct: number }>)
    .map((s) => `- ${s.source}: ${s.count} (${s.pct}%)`)
    .join("\n")}

### Geographic Concentration
Top states: ${(patterns.top_states as Array<[string, number]>).map(([s, c]) => `${s} (${c})`).join(", ")}

### Status Distribution
${(patterns.status_distribution as Array<{ status: string; count: number; pct: number }>)
    .map((s) => `- ${s.status}: ${s.count} (${s.pct}%)`)
    .join("\n")}
`;

  const { error: kbErr } = await supabase.from("knowledge_documents").insert({
    title: "Historical Conversion Patterns",
    category: "ideal_candidate",
    content: kbContent,
    is_active: true,
    priority: 8,
    token_count: Math.ceil(kbContent.length / 4),
    seeded_from: "client_tether_csv",
  });

  if (kbErr) {
    console.error("  KB doc error:", kbErr.message);
  } else {
    console.log("  ✅ KB doc created");
  }

  console.log("\n=== Done ===");
}

main().catch(console.error);
