export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/calls/:callId/generate — triggers the Post-Call Agent.
 * Thin wrapper — all logic lives in lib/agents/post-call/agent.ts.
 */

import { NextRequest, NextResponse } from "next/server";
import { runPostCallAgent } from "@/lib/agents/post-call/agent";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  const { callId } = await params;

  const result = await runPostCallAgent(callId);

  if (!result.success && result.errors.length > 0 && !result.summary) {
    return NextResponse.json(
      { error: `Scout generation failed: ${result.errors.join("; ")}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: result.errors.length === 0,
    summary: result.summary ? "generated" : null,
    coaching_score: result.coaching?.score ?? null,
    actionsCount: result.actionsCount,
    extractionsCount: result.extractionsCount,
    errors: result.errors.length > 0 ? result.errors : undefined,
  });
}
