export const dynamic = "force-dynamic";

/**
 * POST /api/contacts/:contactId/schedule — Create appointment via GHL
 * Also immediately creates a row in the calls table for real-time visibility.
 * Body: { calendarId, title, startTime, endTime, timezone?, assignedUserId? }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createAppointment } from "@/lib/ghl/client";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ contactId: string }> }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const { contactId } = await params;
  const body = await request.json();

  if (!body.calendarId || !body.title || !body.startTime || !body.endTime) {
    return NextResponse.json({ error: "calendarId, title, startTime, and endTime are required" }, { status: 400 });
  }
  if (isNaN(Date.parse(body.startTime)) || isNaN(Date.parse(body.endTime))) {
    return NextResponse.json({ error: "startTime and endTime must be valid ISO dates" }, { status: 400 });
  }
  if (new Date(body.endTime) <= new Date(body.startTime)) {
    return NextResponse.json({ error: "endTime must be after startTime" }, { status: 400 });
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

    // Write to calls table immediately so it's visible in NAH OS
    const supabase = createServerClient();

    // Resolve Supabase contact UUID from GHL contact ID
    const { data: contact } = await supabase
      .from("contacts")
      .select("id")
      .eq("ghl_contact_id", contactId)
      .maybeSingle();

    const durationSeconds =
      body.startTime && body.endTime
        ? Math.round((new Date(body.endTime).getTime() - new Date(body.startTime).getTime()) / 1000)
        : null;

    // Resolve hosted_by from GHL user ID
    let hostedByUserId: string | null = null;
    if (body.assignedUserId) {
      const { data: hostUser } = await supabase
        .from("users")
        .select("id")
        .eq("ghl_user_id", body.assignedUserId)
        .maybeSingle();
      hostedByUserId = hostUser?.id ?? null;
    }

    await supabase.from("calls").upsert(
      {
        ghl_event_id: event.id,
        contact_id: contact?.id ?? null,
        source: "ghl_calendar",
        scheduled_at: body.startTime,
        duration_seconds: durationSeconds,
        meeting_link: ((event as unknown as Record<string, unknown>).meetingLocation as string) ?? null,
        hosted_by_user_id: hostedByUserId,
        status: "scheduled",
      },
      { onConflict: "ghl_event_id" }
    );

    return NextResponse.json({ success: true, eventId: event.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to schedule";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
