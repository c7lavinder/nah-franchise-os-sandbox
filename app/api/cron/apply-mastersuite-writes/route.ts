export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { applyNativeWrites } from "@/lib/mastersuite/apply-native-writes";
import { isWriteConfigured, checkMSWriteConnection } from "@/lib/mastersuite/write-client";

/**
 * INBOUND replay: MasterSuite-native FranDev writes (Scout approval cards,
 * journaled in frandev_native_write) -> Supabase + GHL side effects.
 *
 * Runs every 15 minutes so a stage advance or task approved inside MasterSuite
 * reaches the app and GHL promptly; the nightly push also replays first, so
 * nothing native gets clobbered even if this cron misses a beat.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isWriteConfigured()) {
    return NextResponse.json({ success: true, skipped: true, reason: "dev_db_not_configured" });
  }

  try {
    await checkMSWriteConnection();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: `MasterSuite DB unreachable: ${message}` }, { status: 503 });
  }

  const supabase = createServerClient();
  const { data: log } = await supabase
    .from("cron_job_log")
    .insert({ job_name: "apply-mastersuite-writes", status: "running" })
    .select("id")
    .single();

  try {
    const summary = await applyNativeWrites();
    const status = summary.failed === 0 ? "success" : "failed";
    if (log) {
      await supabase
        .from("cron_job_log")
        .update({
          finished_at: new Date().toISOString(),
          status,
          result: { pending: summary.pending, applied: summary.applied, failed: summary.failed },
          error: summary.errors.length > 0 ? summary.errors.join(" | ").slice(0, 2000) : null,
        })
        .eq("id", log.id);
    }
    return NextResponse.json({ success: status === "success", ...summary });
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
