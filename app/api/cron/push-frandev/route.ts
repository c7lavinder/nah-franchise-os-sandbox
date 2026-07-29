export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { pushFrandev } from "@/lib/mastersuite/push-frandev";
import { applyNativeWrites } from "@/lib/mastersuite/apply-native-writes";
import {
  getMasterSuiteWritePool,
  isWriteConfigured,
  checkMSWriteConnection,
  getWriteTarget,
} from "@/lib/mastersuite/write-client";

/**
 * Nightly OUTBOUND push: FranDev (Supabase) -> MasterSuite `frandev_*`.
 *
 * Target is `MASTERSUITE_WRITE_TARGET` (dev | prod). Idempotent (upsert by PK,
 * never deletes). Once pointed at prod, the nightly prod->dev refresh carries
 * the data down to dev on its own — dev no longer needs its own push.
 *
 * No-ops cleanly (HTTP 200, skipped) when the target's credentials are absent,
 * so the cron never fails nightly while access is pending.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const target = getWriteTarget();

  if (!isWriteConfigured()) {
    return NextResponse.json({
      success: false,
      skipped: true,
      target,
      reason: target === "prod" ? "prod_db_not_configured" : "dev_db_not_configured",
      hint:
        target === "prod"
          ? "Set MASTERSUITE_PROD_DB_HOST/_PORT/_USER/_PASSWORD/_NAME (account needs INSERT/UPDATE/DELETE on mastersuite.frandev_%)."
          : "Set MASTERSUITE_DEV_DB_HOST/_PORT/_USER/_PASSWORD/_NAME.",
    });
  }

  try {
    await checkMSWriteConnection();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, target, error: `MasterSuite ${target} DB unreachable: ${message}` },
      { status: 503 }
    );
  }

  const supabase = createServerClient();
  const { data: log } = await supabase
    .from("cron_job_log")
    .insert({ job_name: "push-frandev", status: "running" })
    .select("id")
    .single();

  try {
    // Replay MasterSuite-native writes FIRST — the push below is a blind
    // upsert-by-PK from Supabase, so an unapplied journal row would be clobbered.
    const replay = await applyNativeWrites();
    if (replay.failed > 0) {
      console.error("[push-frandev] native-write replay failures:", replay.errors.join(" | "));
    }

    const pool = getMasterSuiteWritePool();
    const summary = await pushFrandev({ schemaPool: pool, writePool: pool });
    const status = summary.tablesWithErrors === 0 ? "success" : "failed";
    const resultData = {
      target,
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
    return NextResponse.json({ success: false, target, error: message }, { status: 500 });
  }
}
