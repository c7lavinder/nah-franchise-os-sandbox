export const dynamic = "force-dynamic";

/**
 * GET /api/contacts/:contactId/appointments
 * Returns upcoming appointments for a contact from GHL calendars (next 30 days).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import * as ghl from "@/lib/ghl";
import { resolveContactId } from "@/lib/contacts/pipeline-state";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ contactId: string }> }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const { contactId: rawId } = await params;

  // Resolve to GHL contact ID
  let ghlId = rawId;
  const localId = await resolveContactId(rawId);
  if (localId && localId !== rawId) {
    const supabase = createServerClient();
    const { data: c } = await supabase.from("contacts").select("ghl_contact_id").eq("id", localId).maybeSingle();
    if (c?.ghl_contact_id) ghlId = c.ghl_contact_id;
  }

  try {
    const now = new Date().toISOString();
    const in30d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const allApts = await ghl.getAllAppointments(now, in30d);

    const contactApts = allApts
      .filter((a) => a.contactId === ghlId)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      .slice(0, 10)
      .map((a) => ({ title: a.title, startTime: a.startTime, status: a.appointmentStatus }));

    return NextResponse.json({ appointments: contactApts });
  } catch {
    return NextResponse.json({ appointments: [] });
  }
}
