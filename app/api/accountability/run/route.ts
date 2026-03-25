export const dynamic = "force-dynamic";

/**
 * POST /api/accountability/run
 *
 * Triggers all accountability engine checks manually or via cron.
 * In production, this would be called by Railway Cron or a scheduled task.
 */

import { NextResponse } from "next/server";
import { runAllChecks } from "@/lib/accountability/engine";

export async function POST() {
  try {
    const results = await runAllChecks();
    console.log(`Accountability engine: ${results.total} alerts generated`, results.results);
    return NextResponse.json(results);
  } catch (err) {
    console.error("Accountability engine error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
