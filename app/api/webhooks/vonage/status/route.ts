export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/vonage/status
 *
 * Delivery receipts (DLRs) from the Vonage Messages API. Updates the matching
 * outbound row in sms_messages with the latest status.
 *
 * Configure this URL on the Vonage Application > Messages capability "Status URL".
 * Auth: signed JWT in the Authorization header. Always returns 200.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { verifyVonageWebhook } from "@/lib/vonage/client";

interface VonageStatusPayload {
  message_uuid?: string;
  status?: string;
  timestamp?: string;
  [key: string]: unknown;
}

const FAILED_STATUSES = new Set(["rejected", "undeliverable", "failed", "expired"]);

export async function POST(request: NextRequest) {
  if (!verifyVonageWebhook(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Invalid Vonage webhook signature" }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as VonageStatusPayload;
    if (!payload.message_uuid || !payload.status) {
      return NextResponse.json({ received: true, skipped: "incomplete" });
    }

    const status = payload.status.toLowerCase();
    const ts = payload.timestamp ?? new Date().toISOString();
    const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (status === "delivered") update.delivered_at = ts;
    if (FAILED_STATUSES.has(status)) update.failed_at = ts;

    const supabase = createServerClient();
    await supabase
      .from("sms_messages")
      .update(update)
      .eq("provider", "vonage")
      .eq("provider_message_id", payload.message_uuid);

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Vonage status webhook error:", err instanceof Error ? err.message : "Unknown error");
    return NextResponse.json({ received: true, error: "handler_error" });
  }
}
