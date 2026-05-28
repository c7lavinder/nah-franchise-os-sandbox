#!/usr/bin/env tsx
/**
 * DB drift report for FranDev.
 *
 * Compares production Supabase tables/columns (via information_schema) against
 * the checked-in generated types file. This is intentionally read-only and does
 * not print secrets.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

function loadEnvFile(file: string) {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    value = value.replace(/^['"]|['"]$/g, "");
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".vercel/.env.production.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY. Run `vercel pull --yes --environment=production` first.");
  process.exit(1);
}

type ColumnRow = {
  table_name: string;
  column_name: string;
};

function parseGeneratedTypeColumns(): Map<string, Set<string>> {
  const file = resolve(process.cwd(), "types/supabase.ts");
  const text = readFileSync(file, "utf8");
  const tables = new Map<string, Set<string>>();

  const tableRegex = /^      ([A-Za-z0-9_]+): \{\n        Row: \{\n([\s\S]*?)^        \};/gm;
  let match: RegExpExecArray | null;
  while ((match = tableRegex.exec(text))) {
    const table = match[1];
    const rowBlock = match[2];
    const cols = new Set<string>();
    for (const line of rowBlock.split("\n")) {
      const col = line.match(/^          ([A-Za-z0-9_]+): /)?.[1];
      if (col) cols.add(col);
    }
    tables.set(table, cols);
  }

  return tables;
}

async function main() {
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
    realtime: { transport: WebSocket },
  });

  const { data, error } = await supabase.rpc("exec_sql" as never, {
    sql: `
      select table_name, column_name
      from information_schema.columns
      where table_schema = 'public'
      order by table_name, ordinal_position
    `,
  } as never);

  if (error) {
    console.log("Could not query information_schema via exec_sql RPC.");
    console.log("Fallback: regenerate types with `npx supabase gen types typescript --project-id <ref> > types/supabase.ts` after linking/project-ref setup.");
    console.log(`Reason: ${error.message}`);
    if (process.env.DB_DRIFT_STRICT === "true") process.exit(1);
    console.log("\nSkipping drift comparison for now. Set DB_DRIFT_STRICT=true to make this failure blocking.");
    return;
  }

  const remote = new Map<string, Set<string>>();
  for (const row of (data ?? []) as unknown as ColumnRow[]) {
    if (!remote.has(row.table_name)) remote.set(row.table_name, new Set());
    remote.get(row.table_name)!.add(row.column_name);
  }

  const generated = parseGeneratedTypeColumns();
  const missingTables = [...remote.keys()].filter((table) => !generated.has(table));
  const staleTables = [...generated.keys()].filter((table) => !remote.has(table));

  const columnDiffs: string[] = [];
  for (const [table, remoteCols] of remote) {
    const typedCols = generated.get(table);
    if (!typedCols) continue;
    const missingInTypes = [...remoteCols].filter((col) => !typedCols.has(col));
    const staleInTypes = [...typedCols].filter((col) => !remoteCols.has(col));
    if (missingInTypes.length || staleInTypes.length) {
      columnDiffs.push(
        `${table}: missing_in_types=${missingInTypes.join(",") || "-"}; stale_in_types=${staleInTypes.join(",") || "-"}`
      );
    }
  }

  console.log(`Remote public tables: ${remote.size}`);
  console.log(`Generated type tables: ${generated.size}`);
  console.log(`Tables missing in types: ${missingTables.length}`);
  for (const table of missingTables.slice(0, 30)) console.log(`  + ${table}`);
  console.log(`Tables stale in types: ${staleTables.length}`);
  for (const table of staleTables.slice(0, 30)) console.log(`  - ${table}`);
  console.log(`Tables with column drift: ${columnDiffs.length}`);
  for (const diff of columnDiffs.slice(0, 60)) console.log(`  * ${diff}`);

  if (missingTables.length || staleTables.length || columnDiffs.length) process.exitCode = 2;
}

void main();
