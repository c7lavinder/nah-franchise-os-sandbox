export const dynamic = "force-dynamic";

/**
 * GET    /api/workflows/enrollments/:enrollmentId — get enrollment details
 * PATCH  /api/workflows/enrollments/:enrollmentId — pause, resume, or exit
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getEnrollment,
  pauseEnrollment,
  resumeEnrollment,
  exitEnrollment,
  advanceDay,
} from "@/lib/workflows/enrollment";

export async function GET(request: NextRequest, { params }: { params: Promise<{ enrollmentId: string }> }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  try {
    const { enrollmentId } = await params;
    const enrollment = await getEnrollment(enrollmentId);

    if (!enrollment) {
      return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
    }

    return NextResponse.json({ enrollment });
  } catch (err) {
    console.error("GET enrollment error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ enrollmentId: string }> }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  try {
    const { enrollmentId } = await params;
    const body = await request.json();
    const { action, reason, goalAchieved } = body;

    if (!action) {
      return NextResponse.json({ error: "action is required (pause, resume, exit, advance)" }, { status: 400 });
    }

    let result;

    switch (action) {
      case "pause":
        result = await pauseEnrollment(enrollmentId);
        break;
      case "resume":
        result = await resumeEnrollment(enrollmentId);
        break;
      case "exit":
        if (!reason) {
          return NextResponse.json({ error: "reason is required for exit action" }, { status: 400 });
        }
        result = await exitEnrollment({
          enrollmentId,
          reason,
          goalAchieved: goalAchieved ?? false,
        });
        break;
      case "advance":
        result = await advanceDay(enrollmentId);
        break;
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Use pause, resume, exit, or advance` },
          { status: 400 }
        );
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    return NextResponse.json({ enrollment: result.enrollment });
  } catch (err) {
    console.error("PATCH enrollment error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}
