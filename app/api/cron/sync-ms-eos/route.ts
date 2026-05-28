export const dynamic = "force-dynamic";
export const maxDuration = 120;

import { NextRequest, NextResponse } from "next/server";
import { syncAllEos } from "@/lib/mastersuite/sync-eos";
import { withCronLogging } from "@/lib/mastersuite/cron-helpers";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return withCronLogging(
    "sync-ms-eos",
    110_000,
    () => syncAllEos(),
    ({ results, totalErrors }) => ({
      status: totalErrors > 0 ? "failed" : "success",
      result: results as unknown as Record<string, unknown>,
      error: totalErrors > 0 ? `${totalErrors} errors across sync functions` : null,
    })
  );
}
