/**
 * Pre-Call Brief Agent API
 *
 * POST /api/agents/pre-call-brief/:callId
 * Triggers pre-call brief enrichment agent for a specific call.
 * Returns immediately, processes async.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";import { runPreCallBriefAgent } from "@/lib/agents/pre-call-brief";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  const { callId } = await params;

  // Fire and forget
  runPreCallBriefAgent(callId).catch(console.error);

  return NextResponse.json({ status: "running" });
}
