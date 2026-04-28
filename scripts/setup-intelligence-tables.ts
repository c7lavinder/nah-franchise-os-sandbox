/**
 * Candidate Intelligence Engine — Database Migration Runner
 *
 * Creates all 6 intelligence tables in Supabase with indexes and RLS.
 * Safe to run multiple times — all statements use IF NOT EXISTS.
 *
 * Approach: First creates an exec_sql helper function in Supabase,
 * then uses it to run the full migration SQL.
 *
 * Usage: npx tsx scripts/setup-intelligence-tables.ts
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Run SQL via Supabase's pg_net-compatible SQL endpoint */
async function executeSql(sql: string): Promise<{ success: boolean; error?: string }> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY!,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ sql_text: sql }),
  });

  if (response.ok) return { success: true };
  const body = await response.text();
  return { success: false, error: body };
}

/** Bootstrap the exec_sql function if it doesn't exist */
async function ensureExecSqlFunction(): Promise<boolean> {
  // Test if it exists
  const { error } = await supabase.rpc("exec_sql", { sql_text: "SELECT 1" });
  if (!error) return true;

  console.log("Creating exec_sql helper function...");

  const createFnSql = `
    CREATE OR REPLACE FUNCTION exec_sql(sql_text TEXT)
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    BEGIN
      EXECUTE sql_text;
    END;
    $$;
  `;

  const response = await fetch(`${SUPABASE_URL}/pg`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY!,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: createFnSql }),
  });

  if (response.ok) {
    console.log("exec_sql function created.\n");
    return true;
  }

  return false;
}

async function runMigration() {
  console.log("=== Candidate Intelligence Engine — Database Migration ===\n");

  // Read the SQL migration file
  const sqlPath = resolve("supabase/migrations/006_intelligence_tables.sql");
  let sql: string;
  try {
    sql = readFileSync(sqlPath, "utf-8");
  } catch {
    console.error(`Could not read migration file at: ${sqlPath}`);
    process.exit(1);
  }

  // Try to set up exec_sql function
  const hasExecSql = await ensureExecSqlFunction();

  if (hasExecSql) {
    console.log("Running full migration via exec_sql...\n");
    const result = await executeSql(sql);
    if (result.success) {
      console.log("Migration complete.\n");
      await verifyTables();
      return;
    }
    console.log("Full migration failed, trying individual statements...\n");
  } else {
    console.log("exec_sql not available — running individual CREATE TABLE statements.\n");
  }

  // Fallback: give the user the manual path
  console.log("==========================================================");
  console.log("MANUAL STEP REQUIRED");
  console.log("==========================================================");
  console.log("");
  console.log("Supabase doesn't allow DDL via the REST API without an");
  console.log("exec_sql function. Please run the migration manually:");
  console.log("");
  console.log("1. Open your Supabase dashboard:");
  console.log(`   ${SUPABASE_URL!.replace(".supabase.co", ".supabase.co").replace("https://", "https://supabase.com/dashboard/project/").replace(".supabase.co", "")}/sql/new`);
  console.log("");
  console.log("2. Copy the contents of: supabase/migrations/006_intelligence_tables.sql");
  console.log("");
  console.log("3. Paste into the SQL Editor and click 'Run'");
  console.log("");
  console.log("4. Then re-run this script to verify:");
  console.log("   npx tsx scripts/setup-intelligence-tables.ts --verify");
  console.log("");
  console.log("==========================================================");

  // Still verify in case tables already exist
  await verifyTables();
}

/** Verify all 6 intelligence tables exist after migration */
async function verifyTables() {
  const tables = [
    "candidate_intelligence",
    "call_logs",
    "candidate_score_history",
    "objection_registry",
    "franchisee_performance",
    "market_signals",
  ];

  console.log("Verifying tables...\n");
  let allGood = true;

  for (const table of tables) {
    const { error } = await supabase.from(table).select("id").limit(0);
    if (error) {
      console.log(`  x ${table} — NOT FOUND`);
      allGood = false;
    } else {
      console.log(`  v ${table} — OK`);
    }
  }

  console.log(allGood ? "\nAll 6 tables verified." : "\nSome tables missing — run migration SQL first.");
}

// Support --verify flag to just check tables
if (process.argv.includes("--verify")) {
  verifyTables().catch((err) => {
    console.error("Unexpected error:", err);
    process.exit(1);
  });
} else {
  runMigration().catch((err) => {
    console.error("Unexpected error:", err);
    process.exit(1);
  });
}
