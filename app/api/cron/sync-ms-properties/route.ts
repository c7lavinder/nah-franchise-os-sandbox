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

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

  const { data: lastLog } = await supabase
    .from("cron_job_log")
    .select("finished_at")
    .eq("job_name", "sync-ms-properties")
    .eq("status", "completed")
    .order("finished_at", { ascending: false })
    .limit(1)
    .single();

  // If no previous success, default to 30 days back instead of syncing everything
  const since = lastLog?.finished_at ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: log } = await supabase
    .from("cron_job_log")
    .insert({ job_name: "sync-ms-properties", status: "running" })
    .select("id")
    .single();

  try {
    const result = await syncProperties(since);

    if (log) {
      await supabase
        .from("cron_job_log")
        .update({
          finished_at: new Date().toISOString(),
          status: "completed",
          result: { synced: result.synced, errors: result.errors.slice(0, 10), since },
          error: result.errors.length > 0 ? result.errors[0] : null,
        })
        .eq("id", log.id);
    }

    return NextResponse.json({
      success: result.errors.length === 0,
      synced: result.synced,
      errorCount: result.errors.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("sync-ms-properties FAILED:", message);

    if (log) {
      await supabase
        .from("cron_job_log")
        .update({ finished_at: new Date().toISOString(), status: "failed", error: message })
        .eq("id", log.id);
    }

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
