export const dynamic = "force-dynamic";

/**
 * GET /api/ghl/calendars
 *
 * Returns the list of GHL calendars in the location. Used by Scout's
 * appointment-draft confirm card to render a searchable dropdown so the
 * user can edit the calendar before pushing the appointment.
 */

import { NextResponse } from "next/server";
import * as ghl from "@/lib/ghl";

export async function GET() {
  try {
    const calendars = await ghl.getCalendars();
    // Trim to UI-relevant fields and exclude inactive calendars by default.
    const compact = calendars
      .filter((c) => c.isActive !== false)
      .map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        slotDuration: c.slotDuration,
        timezone: c.timezone,
        calendarType: c.calendarType,
      }));
    return NextResponse.json({ calendars: compact });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
