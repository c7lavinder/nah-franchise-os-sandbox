export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { pushFrandev } from "@/lib/mastersuite/push-frandev";
import { getMasterSuiteWritePool, isWriteConfigured, checkMSWriteConnection } from "@/lib/mastersuite/write-client";

/**
 * Nightly OUTBOUND push: FranDev (Supabase) -> MasterSuite dev `frandev_*`.
 *
 * MasterSuite dev refreshes from prod each night; schedule this AFTER that
 * refresh so the data survives the working day. Idempotent (upsert by PK).
 *
 * No-ops cleanly (HTTP 200, skipped) until the dev write credentials exist, so
 * the cron doesn't fail every night while we wait on Ben for dev DB access.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isWriteConfigured()) {
    return NextResponse.json({
      success: false,
      skipped: true,
      reason: "dev_db_not_configured",
      hint: "Set MASTERSUITE_DEV_DB_HOST/_PORT/_USER/_PASSWORD/_NAME once Ben grants dev write access.",
    });
  }

  try {
    await checkMSWriteConnection();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: `Dev DB unreachable: ${message}` }, { status: 503 });
  }

  const supabase = createServerClient();
  const { data: log } = await supabase
    .from("cron_job_log")
    .insert({ job_name: "push-frandev", status: "running" })
    .select("id")
    .single();

  try {
    const pool = getMasterSuiteWritePool();
    const summary = await pushFrandev({ schemaPool: pool, writePool: pool });
    const status = summary.tablesWithErrors === 0 ? "success" : "failed";
    const resultData = {
      tablesPlanned: summary.totalTables,
      tablesPushed: summary.pushedTables,
      rowsPushed: summary.totalPushedRows,
      tablesWithErrors: summary.tablesWithErrors,
    };
    if (log) {
      await supabase
        .from("cron_job_log")
        .update({
          finished_at: new Date().toISOString(),
          status,
          result: resultData,
          error:
            summary.tablesWithErrors > 0
              ? (summary.results.find((r) => r.error)?.error ?? "one or more tables failed")
              : null,
        })
        .eq("id", log.id);
    }
    return NextResponse.json({ success: status === "success", ...resultData });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (log) {
      await supabase
        .from("cron_job_log")
        .update({ finished_at: new Date().toISOString(), status: "failed", error: message })
        .eq("id", log.id);
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
