/**
 * GET /api/calls/[callId]
 *
 * Returns call details including recording URL and transcript.
 * callId format: conversationId_messageId
 */

import { NextRequest, NextResponse } from "next/server";
import * as ghl from "@/lib/ghl";

export async function GET(
  _request: NextRequest,
  { params }: { params: { callId: string } }
) {
  try {
    const [conversationId, messageId] = params.callId.split("_");
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
