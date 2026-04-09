/**
 * Pre-Call Brief API
 *
 * POST /api/contacts/:contactId/brief — Generate a pre-call brief
 * Body: { callType: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { generatePreCallBrief } from "@/lib/calls/brief-generator";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const { contactId } = await params;

  let body: { callType?: string } = {};
  try {
    body = await request.json();
  } catch {
    // Default to "general"
  }

  const callType = body.callType ?? "general";

  try {
    const brief = await generatePreCallBrief(contactId, callType);
    return NextResponse.json({ success: true, brief });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
