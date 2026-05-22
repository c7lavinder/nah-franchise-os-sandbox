export const dynamic = "force-dynamic";
export const maxDuration = 120;

import { NextRequest, NextResponse } from "next/server";
import { syncAllEos } from "@/lib/mastersuite/sync-eos";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();

  const { data: log } = await supabase
    .from("cron_job_log")
    .insert({ job_name: "sync-ms-eos", status: "running" })
    .select("id")
    .single();

  try {
    const { results, totalErrors } = await syncAllEos();

    if (log) {
      await supabase
        .from("cron_job_log")
        .update({
          finished_at: new Date().toISOString(),
          status: totalErrors > 0 ? "completed_with_errors" : "completed",
          result: results,
          error: totalErrors > 0 ? `${totalErrors} errors across sync functions` : null,
        })
        .eq("id", log.id);
    }

    return NextResponse.json({ success: totalErrors === 0, results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("sync-ms-eos FAILED:", message);

    if (log) {
      await supabase
        .from("cron_job_log")
        .update({ finished_at: new Date().toISOString(), status: "failed", error: message })
        .eq("id", log.id);
    }

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
