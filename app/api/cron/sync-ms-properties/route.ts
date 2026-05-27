export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { syncProperties } from "@/lib/mastersuite/sync-properties";
import { createServerClient } from "@/lib/supabase/server";
import { withCronLogging } from "@/lib/mastersuite/cron-helpers";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();

  // Determine incremental sync window from last successful run
  const { data: lastLog } = await supabase
    .from("cron_job_log")
    .select("finished_at")
    .eq("job_name", "sync-ms-properties")
    .eq("status", "completed")
    .order("finished_at", { ascending: false })
    .limit(1)
    .single();

  const since = lastLog?.finished_at ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  return withCronLogging(
    "sync-ms-properties",
    280_000, // 280s timeout (under 300s maxDuration)
    () => syncProperties(since),
    (result) => ({
      status: result.errors.length === 0 ? "completed" : "completed_with_errors",
      result: { synced: result.synced, errorCount: result.errors.length, errors: result.errors.slice(0, 10), since },
      error: result.errors.length > 0 ? result.errors[0] : null,
    })
  );
}
