export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { syncTerritories } from "@/lib/mastersuite/sync-territories";
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
    .insert({ job_name: "sync-ms-territories", status: "running" })
    .select("id")
    .single();

  try {
    const result = await syncTerritories();

    if (log) {
      await supabase
        .from("cron_job_log")
        .update({
          finished_at: new Date().toISOString(),
          status: "completed",
          result: { synced: result.synced, errors: result.errors },
          error: result.errors.length > 0 ? result.errors[0] : null,
        })
        .eq("id", log.id);
    }

    // Mark all territory briefs as stale after sync
    if (result.synced > 0) {
      await supabase.from("territory_briefs").update({ stale: true }).eq("stale", false);
    }

    return NextResponse.json({
      success: result.errors.length === 0,
      synced: result.synced,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("sync-ms-territories FAILED:", message);

    if (log) {
      await supabase
        .from("cron_job_log")
        .update({ finished_at: new Date().toISOString(), status: "failed", error: message })
        .eq("id", log.id);
    }

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
