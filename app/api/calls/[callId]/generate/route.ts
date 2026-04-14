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

  try {
    const result = await runPostCallAgent(callId);

    // Any errors = 500 so callers know something failed
    if (!result.success || result.errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          summary: result.summary ? "generated" : null,
          coaching_score: result.coaching?.score ?? null,
          actionsCount: result.actionsCount,
          extractionsCount: result.extractionsCount,
          kbDocsUpdated: result.kbDocsUpdated,
          errors: result.errors,
        },
        { status: result.summary ? 207 : 500 } // 207 = partial success (some sections worked)
      );
    }

    return NextResponse.json({
      success: true,
      summary: "generated",
      coaching_score: result.coaching?.score ?? null,
      actionsCount: result.actionsCount,
      extractionsCount: result.extractionsCount,
      kbDocsUpdated: result.kbDocsUpdated,
    });
  } catch (err) {
    console.error(`[generate] callId=${callId} fatal error:`, err instanceof Error ? err.message : err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
