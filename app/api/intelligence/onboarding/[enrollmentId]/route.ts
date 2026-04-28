export const dynamic = "force-dynamic";

/**
 * PATCH /api/intelligence/onboarding/:enrollmentId — advance stage or update
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";import { advanceOnboardingStage } from "@/lib/intelligence/onboarding";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ enrollmentId: string }> }
) {
  try {
    const { enrollmentId } = await params;
    const body = await request.json();
    const { action, notes } = body;

    if (action === "advance") {
      // enrollmentId is actually the contactId for onboarding
      const enrollment = await advanceOnboardingStage(enrollmentId, notes);

      if (!enrollment) {
        return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
      }

      return NextResponse.json({ enrollment });
    }

    return NextResponse.json(
      { error: "Unknown action. Use: advance" },
      { status: 400 }
    );
  } catch (err) {
    console.error("PATCH onboarding error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
