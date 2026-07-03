/**
 * Data dictionary loader — serves field-level semantics to Scout's describe_data tool.
 *
 * Source of truth: docs/data-dictionary/<table>.json, one file per table.
 * Each entry says what a column MEANS, when to use it, common misuses, and
 * which column to prefer instead — the disambiguation layer that raw schema
 * (docs/scout-schema-condensed.txt) cannot provide.
 *
 * Review workflow: entries start as status "draft" (AI-extracted from the
 * MasterSuite source). The business owner confirms or corrects each drafted
 * meaning; confirmed entries flip to status "confirmed". `question` holds the
 * open question for the owner on unconfirmed entries.
 *
 * Validate with: npx tsx scripts/validate-data-dictionary.ts
 */

import { readFileSync, readdirSync } from "fs";
import { resolve, join } from "path";

export interface DictionaryColumn {
  meaning: string;
  units: string | null;
  use_when: string | null;
  do_not_use_for: string | null;
  prefer_instead: string | null;
  source_ref: string | null;
  confidence: "high" | "medium" | "low";
  status: "draft" | "confirmed";
  question: string | null;
}

export interface TableDictionary {
  table: string;
  scout_entity: string | null;
  description: string;
  source_system: string;
  last_verified: string;
  columns: Record<string, DictionaryColumn>;
}

const DICTIONARY_DIR = "docs/data-dictionary";

let _cache: Map<string, TableDictionary> | null = null;

/** Load all table dictionaries (cached for the process lifetime). */
export function loadDataDictionary(): Map<string, TableDictionary> {
  if (_cache) return _cache;

  const map = new Map<string, TableDictionary>();
  try {
    const dir = resolve(process.cwd(), DICTIONARY_DIR);
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".json")) continue;
      try {
        const parsed = JSON.parse(readFileSync(join(dir, file), "utf-8")) as TableDictionary;
        if (parsed?.table && parsed?.columns) map.set(parsed.table, parsed);
      } catch {
        // Skip unparseable files — the validator script reports these.
      }
    }
  } catch {
    // Directory missing — dictionary features simply stay off.
  }
  _cache = map;
  return map;
}

export function getTableDictionary(table: string): TableDictionary | null {
  return loadDataDictionary().get(table) ?? null;
}

/** Table names that have a dictionary — used to advertise coverage in list mode. */
export function dictionaryTableNames(): string[] {
  return [...loadDataDictionary().keys()].sort();
}

/**
 * Compact, LLM-facing view of a table's dictionary: drops nulls and
 * review-workflow fields (status/question/confidence/source_ref) so the tool
 * result stays lean.
 */
export function formatDictionaryForTool(dict: TableDictionary): {
  description: string;
  fieldMeanings: Record<string, Record<string, string>>;
} {
  const fieldMeanings: Record<string, Record<string, string>> = {};
  for (const [col, entry] of Object.entries(dict.columns)) {
    const compact: Record<string, string> = { meaning: entry.meaning };
    if (entry.units) compact.units = entry.units;
    if (entry.use_when) compact.use_when = entry.use_when;
    if (entry.do_not_use_for) compact.do_not_use_for = entry.do_not_use_for;
    if (entry.prefer_instead) compact.prefer_instead = entry.prefer_instead;
    fieldMeanings[col] = compact;
  }
  return { description: dict.description, fieldMeanings };
}

/** Test-only: reset the cache. */
export function clearDataDictionaryCache(): void {
  _cache = null;
}
