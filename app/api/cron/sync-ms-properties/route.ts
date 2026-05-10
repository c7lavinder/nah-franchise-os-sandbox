export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { syncProperties } from "@/lib/mastersuite/sync-properties";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get last sync time for incremental
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

  const { data: lastLog } = await supabase
    .from("cron_job_log")
    .select("finished_at")
    .eq("job_name", "sync-ms-properties")
    .eq("status", "completed")
    .order("finished_at", { ascending: false })
    .limit(1)
    .single();

  const since = lastLog?.finished_at ?? undefined;

  // Log start
  const { data: log } = await supabase
    .from("cron_job_log")
    .insert({ job_name: "sync-ms-properties", status: "running" })
    .select("id")
    .single();

  const result = await syncProperties(since);

  // Log finish
  if (log) {
    await supabase
      .from("cron_job_log")
      .update({
        finished_at: new Date().toISOString(),
        status: result.errors.length === 0 ? "completed" : "completed",
        result: {
          synced: result.synced,
          errors: result.errors.slice(0, 10),
          since,
        },
        error: result.errors.length > 0 ? result.errors[0] : null,
      })
      .eq("id", log.id);
  }

  return NextResponse.json({
    success: result.errors.length === 0,
    synced: result.synced,
    errorCount: result.errors.length,
  });
}
