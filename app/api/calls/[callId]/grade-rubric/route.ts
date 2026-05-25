export const dynamic = "force-dynamic";

/**
 * POST /api/calls/:callId/grade-rubric
 *
 * Triggers Scout rubric-based grading for a call.
 * Requires transcript and configured rubric criteria.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { gradeCall } from "@/lib/calls/grader";
import { createServerClient } from "@/lib/supabase/server";
import { markJourneyBriefStaleByContact } from "@/lib/briefs/mark-journey-brief-stale";

export async function POST(request: NextRequest, { params }: { params: Promise<{ callId: string }> }) {
  const { callId } = await params;

  try {
    const result = await gradeCall(callId);

    // Mark journey brief stale after grading
    const supabase = createServerClient();
    const { data: call } = await supabase.from("calls").select("contact_id").eq("id", callId).maybeSingle();
    if (call?.contact_id) {
      void markJourneyBriefStaleByContact(call.contact_id).catch(() => {});
    }

    return NextResponse.json({ grade: result, success: true });
  } catch (err) {
    console.error("Grade rubric error:", err);
    const message = err instanceof Error ? err.message : "Grading failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
