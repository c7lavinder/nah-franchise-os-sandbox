/**
 * Validate the data dictionary (docs/data-dictionary/*.json).
 *
 * Checks, per table file:
 *   1. Shape — required keys present, confidence/status enums valid.
 *   2. Drift — dictionary columns exist in the table's CREATE TABLE migration,
 *      and migration columns are covered by the dictionary (ms_synced_at exempt).
 *   3. Review state — counts by status/confidence, open questions listed.
 *
 * Run: npx tsx scripts/validate-data-dictionary.ts
 * Exits non-zero on shape errors or unknown columns (drift warnings for
 * missing coverage are reported but do not fail the run).
 */

import { readFileSync, readdirSync } from "fs";
import { join, resolve } from "path";

const DICT_DIR = resolve(process.cwd(), "docs/data-dictionary");
const MIGRATIONS_DIR = resolve(process.cwd(), "supabase/migrations");

const CONFIDENCE = new Set(["high", "medium", "low"]);
const STATUS = new Set(["draft", "confirmed"]);
const REQUIRED_COLUMN_KEYS = [
  "meaning",
  "units",
  "use_when",
  "do_not_use_for",
  "prefer_instead",
  "source_ref",
  "confidence",
  "status",
  "question",
];

/** Extract column names from a table's CREATE TABLE block across all migrations. */
function migrationColumns(table: string): Set<string> | null {
  const cols = new Set<string>();
  let found = false;
  for (const file of readdirSync(MIGRATIONS_DIR).sort()) {
    if (!file.endsWith(".sql")) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf-8");
    const re = new RegExp(`create table (?:if not exists )?"?${table}"?\\s*\\(([\\s\\S]*?)\\);`, "i");
    const match = sql.match(re);
    if (!match) continue;
    found = true;
    for (const line of match[1].split("\n")) {
      const col = line.trim().match(/^"([^"]+)"/) ?? line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s/);
      if (!col) continue;
      const name = col[1];
      if (/^(primary|foreign|constraint|unique|check|references)$/i.test(name)) continue;
      cols.add(name);
    }
    // Also apply ALTER TABLE ... ADD COLUMN from any migration
  }
  for (const file of readdirSync(MIGRATIONS_DIR).sort()) {
    if (!file.endsWith(".sql")) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf-8");
    const alterRe = new RegExp(
      `alter table (?:if exists )?"?${table}"?\\s+add column (?:if not exists )?"?([A-Za-z0-9_]+)"?`,
      "gi"
    );
    for (const m of sql.matchAll(alterRe)) {
      found = true;
      cols.add(m[1]);
    }
  }
  return found ? cols : null;
}

let errors = 0;
let warnings = 0;

const files = readdirSync(DICT_DIR).filter((f) => f.endsWith(".json"));
if (files.length === 0) {
  console.error(`No dictionary files found in ${DICT_DIR}`);
  process.exit(1);
}

for (const file of files.sort()) {
  const path = join(DICT_DIR, file);
  let dict: {
    table?: string;
    scout_entity?: string | null;
    description?: string;
    columns?: Record<string, Record<string, unknown>>;
  };
  try {
    dict = JSON.parse(readFileSync(path, "utf-8"));
  } catch (err) {
    console.error(`ERROR ${file}: invalid JSON — ${err instanceof Error ? err.message : err}`);
    errors++;
    continue;
  }

  const table = dict.table ?? "";
  const columns = dict.columns ?? {};
  const colNames = Object.keys(columns);
  console.log(`\n${file} — table ${table}, ${colNames.length} columns`);

  if (!table || !dict.description || colNames.length === 0) {
    console.error(`  ERROR: missing table/description/columns`);
    errors++;
    continue;
  }

  // 1. Shape
  const counts = { high: 0, medium: 0, low: 0, draft: 0, confirmed: 0, questions: 0 };
  for (const [name, entry] of Object.entries(columns)) {
    for (const key of REQUIRED_COLUMN_KEYS) {
      if (!(key in entry)) {
        console.error(`  ERROR: ${name} missing key "${key}"`);
        errors++;
      }
    }
    const confidence = String(entry.confidence);
    const status = String(entry.status);
    if (!CONFIDENCE.has(confidence)) {
      console.error(`  ERROR: ${name} invalid confidence "${confidence}"`);
      errors++;
    } else {
      counts[confidence as "high" | "medium" | "low"]++;
    }
    if (!STATUS.has(status)) {
      console.error(`  ERROR: ${name} invalid status "${status}"`);
      errors++;
    } else {
      counts[status as "draft" | "confirmed"]++;
    }
    if (typeof entry.meaning !== "string" || !(entry.meaning as string).trim()) {
      console.error(`  ERROR: ${name} has empty meaning`);
      errors++;
    }
    if (entry.question) counts.questions++;
  }

  // 2. Drift vs migrations
  const migCols = migrationColumns(table);
  if (!migCols) {
    console.warn(`  WARN: no CREATE TABLE found for ${table} in migrations — drift check skipped`);
    warnings++;
  } else {
    const unknown = colNames.filter((c) => !migCols.has(c));
    const uncovered = [...migCols].filter((c) => !(c in columns) && c !== "ms_synced_at");
    for (const c of unknown) {
      console.error(`  ERROR: dictionary column "${c}" does not exist in migrations for ${table}`);
      errors++;
    }
    if (uncovered.length > 0) {
      console.warn(`  WARN: ${uncovered.length} migration columns not in dictionary: ${uncovered.join(", ")}`);
      warnings++;
    }
  }

  // 3. Review state
  console.log(
    `  confidence: ${counts.high} high / ${counts.medium} medium / ${counts.low} low · ` +
      `status: ${counts.confirmed} confirmed / ${counts.draft} draft · open questions: ${counts.questions}`
  );
}

console.log(`\n${errors} error(s), ${warnings} warning(s) across ${files.length} file(s)`);
process.exit(errors > 0 ? 1 : 0);
