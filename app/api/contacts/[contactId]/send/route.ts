export const dynamic = "force-dynamic";

/**
 * POST /api/contacts/:contactId/send — Send SMS or Email via GHL
 * Body: { type: "SMS", message, fromNumber? } or { type: "Email", subject, html, emailFrom }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { customerFacingSendsDisabledReason, customerFacingSendsEnabled } from "@/lib/ghl/action-safety";
import { sendMessage } from "@/lib/ghl/client";
import { getAssignedSignalHouseNumber } from "@/lib/sms/number-assignment";
import { sendContactSmsViaSignalHouse } from "@/lib/sms/contact-sms";
import { signalHouseEnabled } from "@/lib/sms/signalhouse-client";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const { contactId } = await params;
  const body = await request.json();

  if (!body.type || !["SMS", "Email"].includes(body.type)) {
    return NextResponse.json({ error: "type must be SMS or Email" }, { status: 400 });
  }

  if (body.confirmed !== true) {
    return NextResponse.json(
      { error: "Customer-facing sends require explicit human confirmation.", success: false },
      { status: 409 }
    );
  }

  if (!customerFacingSendsEnabled()) {
    return NextResponse.json({ error: customerFacingSendsDisabledReason(), success: false }, { status: 409 });
  }

  try {
    if (body.type === "SMS") {
      if (!body.message?.trim()) {
        return NextResponse.json({ error: "message is required" }, { status: 400 });
      }
      let msg;
      if (signalHouseEnabled()) {
        const fromNumber = await getAssignedSignalHouseNumber(user.id);
        if (!fromNumber) {
          return NextResponse.json(
            { error: "Your user does not have a SignalHouse sending number assigned in Settings.", success: false },
            { status: 409 }
          );
        }
        msg = await sendContactSmsViaSignalHouse(contactId, body.message.trim(), { fromNumber });
      } else {
        msg = await sendMessage({
          type: "SMS",
          contactId,
          message: body.message.trim(),
        });
      }
      return NextResponse.json({ success: true, messageId: msg.id });
    }

    // Email
    if (!body.subject?.trim() || !body.html?.trim()) {
      return NextResponse.json({ error: "subject and html are required" }, { status: 400 });
    }
    const msg = await sendMessage({
      type: "Email",
      contactId,
      subject: body.subject.trim(),
      html: body.html.trim(),
      emailFrom: body.emailFrom ?? "notifications@newagainhouses.com",
    });
    return NextResponse.json({ success: true, messageId: msg.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to send";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
