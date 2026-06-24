export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/vonage/inbound
 *
 * Receives inbound SMS from the Vonage Messages API and stores it in
 * sms_messages so replies appear in the in-app inbox. This replaces relying on
 * GHL's InboundMessage webhook for SMS once SMS_PROVIDER=vonage.
 *
 * Configure this URL on the Vonage Application > Messages capability "Inbound URL".
 * Auth: signed JWT in the Authorization header (verified with the signature secret).
 * Always returns 200 so Vonage does not retry for hours.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { phoneLookupKey, toSignalHousePhone } from "@/lib/sms/phone";
import { verifyVonageWebhook } from "@/lib/vonage/client";

interface VonageInboundPayload {
  message_uuid?: string;
  to?: string;
  from?: string;
  channel?: string;
  message_type?: string;
  text?: string;
  timestamp?: string;
  [key: string]: unknown;
}

async function findContactIdByPhone(phone: string | undefined): Promise<{ id: string; ghl: string | null } | null> {
  const key = phoneLookupKey(phone);
  if (!key) return null;

  const supabase = createServerClient();
  const { data } = await supabase
    .from("contacts")
    .select("id, ghl_contact_id")
    .eq("phone_normalized", key)
    .limit(1)
    .maybeSingle();

  return data ? { id: data.id as string, ghl: (data.ghl_contact_id as string | null) ?? null } : null;
}

export async function POST(request: NextRequest) {
  if (!verifyVonageWebhook(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Invalid Vonage webhook signature" }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as VonageInboundPayload;

    if (!payload.message_uuid) {
      return NextResponse.json({ received: true, skipped: "no_message_uuid" });
    }

    const contact = await findContactIdByPhone(payload.from);
    const now = new Date().toISOString();
    const supabase = createServerClient();

    await supabase.from("sms_messages").upsert(
      {
        provider: "vonage",
        provider_message_id: payload.message_uuid,
        contact_id: contact?.id ?? null,
        ghl_contact_id: contact?.ghl ?? null,
        direction: "inbound",
        message_type: "SMS",
        from_number: toSignalHousePhone(payload.from) || null,
        to_number: toSignalHousePhone(payload.to) || null,
        body: payload.text ?? "",
        status: "RECEIVED",
        raw_payload: payload as Record<string, unknown>,
        received_at: payload.timestamp ?? now,
        updated_at: now,
      },
      { onConflict: "provider,provider_message_id" }
    );

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Vonage inbound webhook error:", err instanceof Error ? err.message : "Unknown error");
    return NextResponse.json({ received: true, error: "handler_error" });
  }
}
