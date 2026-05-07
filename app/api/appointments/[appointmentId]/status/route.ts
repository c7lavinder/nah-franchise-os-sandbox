export const dynamic = "force-dynamic";

/**
 * PATCH /api/appointments/[appointmentId]/status
 *
 * Updates an appointment's status in GHL and syncs to calls table.
 * Body: { status: "confirmed" | "showed" | "noshow" | "cancelled" }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { updateAppointment } from "@/lib/ghl";
import { createServerClient } from "@/lib/supabase/server";

const VALID_STATUSES = ["confirmed", "showed", "noshow", "cancelled"];

// Map GHL appointment statuses to calls table statuses
const STATUS_TO_CALL_STATUS: Record<string, string> = {
  confirmed: "scheduled",
  showed: "completed",
  noshow: "missed",
  cancelled: "cancelled",
};

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ appointmentId: string }> }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const { appointmentId } = await params;
  const body = (await request.json()) as { status: string };

  if (!body.status) {
    return NextResponse.json({ error: "status is required" }, { status: 400 });
  }

  if (!VALID_STATUSES.includes(body.status)) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    await updateAppointment(appointmentId, { appointmentStatus: body.status });

    // Sync status back to calls table
    const callStatus = STATUS_TO_CALL_STATUS[body.status];
    if (callStatus) {
      const supabase = createServerClient();
      const updatePayload: Record<string, unknown> = { status: callStatus };

      if (body.status === "showed") {
        updatePayload.started_at = new Date().toISOString();
      }

      await supabase.from("calls").update(updatePayload).eq("ghl_event_id", appointmentId);
    }

    return NextResponse.json({ success: true, status: body.status });
  } catch (err) {
    console.error("Failed to update appointment status:", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 502 });
  }
}
