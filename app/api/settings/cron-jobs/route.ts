export const dynamic = "force-dynamic";

/**
 * GET /api/settings/cron-jobs — returns recent cron job executions for the calendar view.
 * Reads from cron_job_log, returns last 7 days of entries.
 */

import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createServerClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("cron_job_log")
    .select("id, job_name, started_at, finished_at, status, error")
    .gte("started_at", sevenDaysAgo)
    .order("started_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ jobs: data ?? [] });
}
