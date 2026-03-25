/**
 * POST /api/inbox/send
 *
 * Sends an SMS or email reply through GHL.
 */

import { NextRequest, NextResponse } from "next/server";
import * as ghl from "@/lib/ghl";
import type { GHLSendMessagePayload } from "@/types/ghl";

interface SendRequest {
  type: "SMS" | "Email";
  contactId: string;
  message?: string;
  subject?: string;
  html?: string;
  emailFrom?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SendRequest;

    if (!body.contactId || !body.type) {
      return NextResponse.json({ error: "contactId and type are required" }, { status: 400 });
    }

    let payload: GHLSendMessagePayload;

    if (body.type === "SMS") {
      if (!body.message?.trim()) {
        return NextResponse.json({ error: "Message text is required for SMS" }, { status: 400 });
      }
      payload = {
        type: "SMS",
        contactId: body.contactId,
        message: body.message.trim(),
      };
    } else {
      if (!body.html?.trim() || !body.subject?.trim()) {
        return NextResponse.json({ error: "Subject and body are required for email" }, { status: 400 });
      }
      payload = {
        type: "Email",
        contactId: body.contactId,
        html: body.html.trim(),
        subject: body.subject.trim(),
        emailFrom: body.emailFrom ?? "chad@newagainhouses.com",
      };
    }

    const message = await ghl.sendMessage(payload);
    return NextResponse.json({ message });
  } catch (err) {
    console.error("Send message failed:", err);
    const msg = err instanceof Error ? err.message : "Failed to send message";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
