export const dynamic = "force-dynamic";

/**
 * GET  /api/workflows/:workflowId/ab-tests — list all A/B tests for a workflow
 * POST /api/workflows/:workflowId/ab-tests — create a new A/B test
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getTestsForWorkflow,
  createABTest,
} from "@/lib/workflows/ab-testing";
import type { ABTestType } from "@/lib/workflows/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workflowId: string }> }
) {
  { const _auth = await requireAuth(request); if (_auth instanceof Response) return _auth; }
  try {
    const { workflowId } = await params;

    const tests = await getTestsForWorkflow(workflowId);

    return NextResponse.json({ tests });
  } catch (err) {
    console.error("GET ab-tests error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workflowId: string }> }
) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  try {
    const { workflowId } = await params;
    const body = await request.json();

    const { testType, minSampleSize } = body as {
      testType?: string;
      minSampleSize?: number;
    };

    if (!testType || !minSampleSize) {
      return NextResponse.json(
        { error: "Missing required fields: testType, minSampleSize" },
        { status: 400 }
      );
    }

    if (testType !== "step" && testType !== "full_workflow") {
      return NextResponse.json(
        { error: "testType must be 'step' or 'full_workflow'" },
        { status: 400 }
      );
    }

    const result = await createABTest({
      workflowId,
      testType: testType as ABTestType,
      variantAStepId: body.variantAStepId as string | undefined,
      variantBStepId: body.variantBStepId as string | undefined,
      variantAVersionId: body.variantAVersionId as string | undefined,
      variantBVersionId: body.variantBVersionId as string | undefined,
      minSampleSize,
      createdBy: user.id,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ test: result.test }, { status: 201 });
  } catch (err) {
    console.error("POST ab-tests error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
