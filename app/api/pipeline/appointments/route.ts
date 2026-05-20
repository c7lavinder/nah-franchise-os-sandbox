export const dynamic = "force-dynamic";

/**
 * GET /api/pipeline/appointments
 *
 * Fetches upcoming appointments from GHL for the next 30 days.
 * Returns a map of contactId → { title, startTime }.
 * Called once on page load (not on every filter/search change).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import * as ghl from "@/lib/ghl";

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  try {
    const nowISO = new Date().toISOString();
    const in30d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const appointments = await ghl.getAllAppointments(nowISO, in30d);

    const byContact: Record<string, { title: string; startTime: string }> = {};
    for (const apt of appointments) {
      if (!apt.contactId) continue;
      const existing = byContact[apt.contactId];
      if (!existing || new Date(apt.startTime) < new Date(existing.startTime)) {
        byContact[apt.contactId] = { title: apt.title, startTime: apt.startTime };
      }
    }

    return NextResponse.json({ appointments: byContact });
  } catch {
    return NextResponse.json({ appointments: {} });
  }
}
