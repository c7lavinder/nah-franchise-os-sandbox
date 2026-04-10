export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min max for transcript processing

import { NextRequest, NextResponse } from "next/server";
import { processTranscriptJobs } from "@/lib/calls/transcript-processor";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await processTranscriptJobs();

  return NextResponse.json({
    success: true,
    ...result,
  });
}
