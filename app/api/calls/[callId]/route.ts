export const dynamic = "force-dynamic";

/**
 * GET /api/calls/[callId]
 *
 * Returns call details including recording URL and transcript.
 * callId format: conversationId_messageId
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import * as ghl from "@/lib/ghl";

export async function GET(request: NextRequest, { params }: { params: Promise<{ callId: string }> }) {
  try {
    const { callId } = await params;
    const [conversationId, messageId] = callId.split("_");
    if (!conversationId || !messageId) {
      return NextResponse.json({ error: "Invalid call ID" }, { status: 400 });
    }

    // Fetch recording and transcript in parallel
    const [recordingUrl, transcription] = await Promise.all([
      ghl.getCallRecording(messageId),
      ghl.getCallTranscription(messageId),
    ]);

    return NextResponse.json({
      conversationId,
      messageId,
      recordingUrl,
      transcription,
    });
  } catch (err) {
    console.error("Call detail fetch failed:", err);
    return NextResponse.json({ error: "Failed to load call details" }, { status: 502 });
  }
}
