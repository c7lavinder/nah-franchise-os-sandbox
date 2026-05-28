export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { syncLeadListCounts } from "@/lib/mastersuite/sync-properties";
import { withCronLogging } from "@/lib/mastersuite/cron-helpers";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return withCronLogging(
    "sync-ms-lead-list",
    280_000,
    () => syncLeadListCounts(),
    (result) => ({
      status: result.errors.length === 0 ? "success" : "failed",
      result: { synced: result.synced, errors: result.errors },
      error: result.errors.length > 0 ? result.errors[0] : null,
    })
  );
}
