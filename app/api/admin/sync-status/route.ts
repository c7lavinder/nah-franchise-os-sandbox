export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

const SYNC_JOBS = [
  "sync-ms-prospects",
  "sync-ms-territories",
  "sync-ms-properties",
  "sync-ms-eos",
  "sync-ms-lead-list",
];

/**
 * GET /api/admin/sync-status — returns sync health for admin banner.
 * Only accessible to admins. Returns list of jobs that have failed
 * their last 3+ consecutive runs.
 */
export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const supabase = createServerClient();
  const failing: { job: string; since: string; consecutiveFailures: number; error: string }[] = [];

  for (const job of SYNC_JOBS) {
    const { data: recent } = await supabase
      .from("cron_job_log")
      .select("status, error, created_at")
      .eq("job_name", job)
      .order("created_at", { ascending: false })
      .limit(3);

    if (!recent || recent.length === 0) continue;

    // Only alert if ALL of the last 3 runs failed
    const allFailed = recent.every((r) => r.status === "failed");
    if (!allFailed) continue;

    failing.push({
      job: job.replace("sync-ms-", ""),
      since: recent[recent.length - 1].created_at,
      consecutiveFailures: recent.length,
      error: recent[0].error || "Unknown error",
    });
  }

  return NextResponse.json({ healthy: failing.length === 0, failing });
}
