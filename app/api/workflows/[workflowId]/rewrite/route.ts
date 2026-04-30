export const dynamic = "force-dynamic";

/**
 * POST /api/workflows/:workflowId/rewrite
 *
 * Generate 3 rewrite variants for an underperforming workflow step.
 * Body: { stepId: string, context?: string }
 * Returns: diagnosis + 3 variant rewrites with different approaches.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { generateRewrites } from "@/lib/workflows/rewrite-engine";

export async function POST(request: NextRequest, { params }: { params: Promise<{ workflowId: string }> }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  try {
    // Sprint 0 fix: validate route params and return proper status codes instead of 500
    const { workflowId } = await params;

    if (!workflowId) {
      return NextResponse.json({ error: "Missing workflow ID" }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "AI service not configured" }, { status: 503 });
    }

    const body = await request.json();
    const { stepId, context } = body;

    if (!stepId) {
      return NextResponse.json({ error: "stepId is required" }, { status: 400 });
    }

    const result = await generateRewrites({ stepId, context });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Rewrite generation failed";

    // Sprint 0 fix: distinguish "not found" from server errors
    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    // Table doesn't exist yet — workflow schema not deployed
    if (message.includes("relation") && message.includes("does not exist")) {
      return NextResponse.json(
        { error: "Workflow tables not yet deployed. Run schema migration first." },
        { status: 503 }
      );
    }

    console.error("Rewrite generation error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
