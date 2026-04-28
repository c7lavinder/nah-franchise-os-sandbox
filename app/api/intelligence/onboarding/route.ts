export const dynamic = "force-dynamic";

/**
 * GET  /api/intelligence/onboarding?type=onboarding|coaching — list enrollments
 * POST /api/intelligence/onboarding — create onboarding enrollment for a franchisee
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";import {
  createOnboardingEnrollment,
  getOnboardingEnrollments,
} from "@/lib/intelligence/onboarding";

export async function GET(request: NextRequest) {
  { const _auth = await requireAuth(request); if (_auth instanceof Response) return _auth; }
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") as "onboarding" | "coaching" | null;

    const enrollments = await getOnboardingEnrollments(type ?? undefined);

    return NextResponse.json({ enrollments });
  } catch (err) {
    console.error("GET onboarding error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  { const _auth = await requireAuth(request); if (_auth instanceof Response) return _auth; }
  try {
    const body = await request.json();
    const { contactId, franchiseeName } = body;

    if (!contactId || !franchiseeName) {
      return NextResponse.json(
        { error: "contactId and franchiseeName are required" },
        { status: 400 }
      );
    }

    const enrollment = await createOnboardingEnrollment({ contactId, franchiseeName });

    if (!enrollment) {
      return NextResponse.json({ error: "Failed to create enrollment" }, { status: 500 });
    }

    return NextResponse.json({ enrollment }, { status: 201 });
  } catch (err) {
    console.error("POST onboarding error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
