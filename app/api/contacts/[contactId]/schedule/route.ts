export const dynamic = "force-dynamic";

/**
 * POST /api/contacts/:contactId/schedule — Create appointment via GHL
 * Body: { calendarId, title, startTime, endTime, timezone? }
 */

import { NextRequest, NextResponse } from "next/server";
import { createAppointment } from "@/lib/ghl/client";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const { contactId } = await params;
  const body = await request.json();

  if (!body.calendarId || !body.title || !body.startTime || !body.endTime) {
    return NextResponse.json(
      { error: "calendarId, title, startTime, and endTime are required" },
      { status: 400 }
    );
  }

  try {
    const event = await createAppointment({
      calendarId: body.calendarId,
      contactId,
      title: body.title,
      startTime: body.startTime,
      endTime: body.endTime,
      appointmentStatus: "confirmed",
      assignedUserId: body.assignedUserId,
    });
    return NextResponse.json({ success: true, eventId: event.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to schedule";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
