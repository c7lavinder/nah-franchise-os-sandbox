export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { syncLeadList } from "@/lib/mastersuite/sync-properties";
import { createServerClient } from "@/lib/supabase/server";
import { withCronLogging } from "@/lib/mastersuite/cron-helpers";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();
  const { data: lastLog } = await supabase
    .from("cron_job_log")
    .select("finished_at")
    .eq("job_name", "sync-ms-lead-list")
    .eq("status", "success")
    .order("finished_at", { ascending: false })
    .limit(1)
    .single();

  const since = lastLog?.finished_at ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  return withCronLogging(
    "sync-ms-lead-list",
    280_000,
    () => syncLeadList(since),
    (result) => ({
      status: result.errors.length === 0 ? "success" : "failed",
      result: {
        countsSynced: result.counts.synced,
        leadListPropertiesUpserted: result.properties.upserted,
        leadListPropertiesMovedOut: result.properties.markedMovedOut,
        errors: result.errors,
        since,
      },
      error: result.errors.length > 0 ? result.errors[0] : null,
    })
  );
}
