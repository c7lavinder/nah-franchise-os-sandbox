export const dynamic = "force-dynamic";

/**
 * POST /api/calls/:callId/grade-rubric
 *
 * Triggers Scout rubric-based grading for a call.
 * Requires transcript and configured rubric criteria.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";import { gradeCall } from "@/lib/calls/grader";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  const { callId } = await params;

  try {
    const result = await gradeCall(callId);
    return NextResponse.json({ grade: result, success: true });
  } catch (err) {
    console.error("Grade rubric error:", err);
    const message = err instanceof Error ? err.message : "Grading failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
