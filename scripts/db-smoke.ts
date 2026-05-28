#!/usr/bin/env tsx
/**
 * Read-only production DB smoke checks for FranDev.
 *
 * Purpose: prove the schema contracts used by the highest-risk product paths
 * still execute against Supabase before/after a release. This does not call
 * external systems and does not print secret values or row payloads.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DB_SMOKE_CONTRACTS } from "@/lib/db/smoke-contract";
import { createTypedServerClient } from "@/lib/supabase/server";
import { SYNC_JOBS, summarizeSyncHealth, type CronJobLogRow } from "@/lib/mastersuite/sync-health";

function loadEnvFiles() {
  for (const file of [".env.local", ".vercel/.env.production.local"]) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index <= 0) continue;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim().replace(/^[ '"]|[ '"]$/g, "");
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

type CheckResult = {
  name: string;
  ok: boolean;
  count?: number | null;
  warning?: string;
  error?: string;
};

function formatCount(count: number | null | undefined) {
  return count == null ? "queried" : `${count.toLocaleString()} rows`;
}

async function runCheck(name: string, fn: () => Promise<CheckResult>): Promise<CheckResult> {
  try {
    return await fn();
  } catch (err) {
    return { name, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function queryResult(name: string, result: { count: number | null; error: { message: string } | null }, minRows = 1): CheckResult {
  if (result.error) return { name, ok: false, error: result.error.message };
  const count = result.count ?? 0;
  if (count < minRows) return { name, ok: false, count, error: `Expected at least ${minRows} row(s)` };
  return { name, ok: true, count };
}

async function main() {
  loadEnvFiles();
  const supabase = createTypedServerClient();

  const checks = await Promise.all([
    runCheck(DB_SMOKE_CONTRACTS.contacts.name, async () => {
      const contract = DB_SMOKE_CONTRACTS.contacts;
      const result = await supabase
        .from(contract.table)
        .select(contract.selectedColumns, { count: "exact", head: false })
        .limit(1);
      return queryResult(contract.name, result, contract.minRows);
    }),
    runCheck(DB_SMOKE_CONTRACTS.journeys.name, async () => {
      const contract = DB_SMOKE_CONTRACTS.journeys;
      const result = await supabase
        .from(contract.table)
        .select(contract.selectedColumns, { count: "exact", head: false })
        .limit(1);
      return queryResult(contract.name, result, contract.minRows);
    }),
    runCheck(DB_SMOKE_CONTRACTS.callParticipants.name, async () => {
      const contract = DB_SMOKE_CONTRACTS.callParticipants;
      const result = await supabase
        .from(contract.table)
        .select(contract.selectedColumns, { count: "exact", head: false })
        .limit(1);
      return queryResult(contract.name, result, contract.minRows);
    }),
    runCheck(DB_SMOKE_CONTRACTS.knowledge.name, async () => {
      const contract = DB_SMOKE_CONTRACTS.knowledge;
      const result = await supabase
        .from(contract.table)
        .select(contract.selectedColumns, { count: "exact", head: false })
        .eq("is_active", true)
        .limit(1);
      return queryResult(contract.name, result, contract.minRows);
    }),
    runCheck("MasterSuite sync health log", async () => {
      const { data, error, count } = await supabase
        .from("cron_job_log")
        .select("job_name, status, error, started_at, finished_at", { count: "exact", head: false })
        .in("job_name", [...SYNC_JOBS])
        .order("started_at", { ascending: false })
        .limit(100);
      if (error) return { name: "MasterSuite sync health log", ok: false, error: error.message };
      const health = summarizeSyncHealth((data ?? []) as CronJobLogRow[]);
      const missingSuccess = health.syncJobs.filter((job) => job.jobName.startsWith("sync-ms-") && !job.lastSuccessAt);
      const warnings = [
        health.status === "healthy" ? null : `current status is ${health.status}`,
        missingSuccess.length > 0
          ? `missing successful sync history for: ${missingSuccess.map((job) => job.label).join(", ")}`
          : null,
      ].filter(Boolean);
      return {
        name: "MasterSuite sync health log",
        ok: (count ?? 0) > 0,
        count,
        error: (count ?? 0) > 0 ? undefined : "Expected at least 1 cron log row",
        warning: warnings.length > 0 ? warnings.join("; ") : undefined,
      };
    }),
  ]);

  let failed = false;
  for (const check of checks) {
    const prefix = check.ok ? "✓" : "✗";
    const suffix = check.error ? ` — ${check.error}` : check.warning ? ` — ${check.warning}` : "";
    console.log(`${prefix} ${check.name}: ${formatCount(check.count)}${suffix}`);
    if (!check.ok) failed = true;
  }

  if (failed) {
    console.error("\nDB smoke checks failed.");
    process.exit(1);
  }

  console.log("\nDB smoke checks passed.");
}

void main();
