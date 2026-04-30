export const dynamic = "force-dynamic";

/**
 * PATCH /api/appointments/[appointmentId]/status
 *
 * Updates an appointment's status in GHL.
 * Body: { status: "confirmed" | "showed" | "noshow" | "cancelled" }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { updateAppointment } from "@/lib/ghl";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ appointmentId: string }> }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const { appointmentId } = await params;
  const body = (await request.json()) as { status: string };

  if (!body.status) {
    return NextResponse.json({ error: "status is required" }, { status: 400 });
  }

  try {
    await updateAppointment(appointmentId, { appointmentStatus: body.status });
    return NextResponse.json({ success: true, status: body.status });
  } catch (err) {
    console.error("Failed to update appointment status:", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 502 });
  }
}
