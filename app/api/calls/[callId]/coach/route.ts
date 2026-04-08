export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { coachCall } from "@/lib/calls/coach";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  const { callId } = await params;

  try {
    const result = await coachCall(callId);
    return NextResponse.json({ coaching: result, success: true });
  } catch (err) {
    console.error("Coaching error:", err);
    const message = err instanceof Error ? err.message : "Coaching failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
