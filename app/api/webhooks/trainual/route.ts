/**
 * POST /api/webhooks/trainual — Trainual completion webhook stub
 *
 * Trainual fires webhooks when a prospect completes sections or the
 * full curriculum. This endpoint is a placeholder until Trainual
 * integration is configured.
 *
 * Expected payload: { contact_id, completion_pct, last_section, event_type }
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    contact_id?: string;
    completion_pct?: number;
    last_section?: string;
    event_type?: string;
  };

  const supabase = createServerClient();

  // Log the webhook for future processing
  await supabase.from("integration_logs").insert({
    integration_name: "trainual",
    event_type: body.event_type ?? "completion_update",
    status: "received",
    payload_summary: JSON.stringify(body).slice(0, 500),
    related_contact_id: body.contact_id ?? null,
  });

  // TODO: When Trainual integration is live, update contact_profile_fields
  // with trainual_completion_pct and trainual_last_section

  return NextResponse.json({ received: true });
}
