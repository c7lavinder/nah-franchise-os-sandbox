export const dynamic = "force-dynamic";

/**
 * GET /api/settings/calendar-activity
 *
 * Returns the last 30 scout-appointment events (drafts + pushes, success +
 * failures) so admins can see whether Scout is drafting at all, which
 * calendar got picked, and whether the push to GHL actually succeeded.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("integration_logs")
    .select("id, event_type, status, payload_summary, error_message, related_contact_id, created_at")
    .eq("integration_name", "scout-appointment")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ activity: data ?? [] });
}
