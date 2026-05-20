export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { syncPtoProspects } from "@/lib/mastersuite/sync-pto-prospects";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

  const { data: log } = await supabase
    .from("cron_job_log")
    .insert({ job_name: "sync-ms-prospects", status: "running" })
    .select("id")
    .single();

  try {
    // Incremental: look at PTO entries from the last 7 days
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const result = await syncPtoProspects(since);

    if (log) {
      await supabase
        .from("cron_job_log")
        .update({
          finished_at: new Date().toISOString(),
          status: "completed",
          result: { created: result.created, wired: result.wired, skipped: result.skipped, errors: result.errors },
          error: result.errors.length > 0 ? result.errors[0] : null,
        })
        .eq("id", log.id);
    }

    return NextResponse.json({
      success: result.errors.length === 0,
      created: result.created,
      wired: result.wired,
      skipped: result.skipped,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("sync-ms-prospects FAILED:", message, stack);

    if (log) {
      await supabase
        .from("cron_job_log")
        .update({
          finished_at: new Date().toISOString(),
          status: "failed",
          error: message,
        })
        .eq("id", log.id);
    }

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
