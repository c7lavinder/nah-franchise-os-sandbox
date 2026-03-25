export const dynamic = "force-dynamic";

/**
 * POST /api/workflows/:workflowId/rewrite
 *
 * Generate 3 rewrite variants for an underperforming workflow step.
 * Body: { stepId: string, context?: string }
 * Returns: diagnosis + 3 variant rewrites with different approaches.
 */

import { NextRequest, NextResponse } from "next/server";
import { generateRewrites } from "@/lib/workflows/rewrite-engine";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workflowId: string }> }
) {
  try {
    await params; // validate route param exists
    const body = await request.json();
    const { stepId, context } = body;

    if (!stepId) {
      return NextResponse.json({ error: "stepId is required" }, { status: 400 });
    }

    const result = await generateRewrites({ stepId, context });

    return NextResponse.json(result);
  } catch (err) {
    console.error("Rewrite generation error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Rewrite generation failed" },
      { status: 500 }
    );
  }
}
