export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { syncProspects } from "@/lib/mastersuite/sync-prospects";
import { withCronLogging } from "@/lib/mastersuite/cron-helpers";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  return withCronLogging(
    "sync-ms-prospects",
    50_000,
    () => syncProspects(since),
    (result) => ({
      status: "success",
      result: { created: result.created, wired: result.wired, skipped: result.skipped, errors: result.errors },
      error: result.errors.length > 0 ? result.errors[0] : null,
    })
  );
}
