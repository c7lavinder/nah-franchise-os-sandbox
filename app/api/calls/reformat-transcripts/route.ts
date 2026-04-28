export const dynamic = "force-dynamic";

/**
 * POST /api/calls/reformat-transcripts — re-formats all stored transcripts
 * from the original Read.ai raw_payload using the improved formatTranscript().
 *
 * Fixes: UNKNOWN_SPEAKER merging, title suffix stripping, speaker resolution.
 * Safe to run repeatedly — overwrites raw_transcript with corrected version.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";import { createServerClient } from "@/lib/supabase/server";
import { formatTranscript } from "@/lib/calls/classifier";
import type { ReadAIParticipant, ReadAITranscriptTurn } from "@/lib/calls/classifier";

export async function POST(request: NextRequest) {
  { const _auth = await requireAuth(request); if (_auth instanceof Response) return _auth; }
  const supabase = createServerClient();

  // Get all calls with their Read.ai session data
  const { data: calls } = await supabase
    .from("calls")
    .select("id, read_ai_session_id, raw_transcript")
    .not("read_ai_session_id", "is", null)
    .not("raw_transcript", "is", null);

  if (!calls?.length) {
    return NextResponse.json({ reformatted: 0, message: "No calls with transcripts found" });
  }

  // Get all sessions with raw_payload
  const sessionIds = calls.map((c) => c.read_ai_session_id).filter(Boolean) as string[];
  const { data: sessions } = await supabase
    .from("read_ai_sessions")
    .select("session_id, raw_payload")
    .in("session_id", sessionIds);

  const sessionMap = new Map<string, Record<string, unknown>>();
  for (const s of sessions ?? []) {
    if (s.raw_payload) sessionMap.set(s.session_id, s.raw_payload as Record<string, unknown>);
  }

  let reformatted = 0;
  const errors: string[] = [];

  for (const call of calls) {
    const payload = sessionMap.get(call.read_ai_session_id);
    if (!payload) continue;

    const transcript = payload.transcript as {
      turns?: ReadAITranscriptTurn[];
      speaker_blocks?: ReadAITranscriptTurn[];
    } | undefined;

    const participants = payload.participants as ReadAIParticipant[] | undefined;

    if (!transcript) continue;

    const newTranscript = formatTranscript(transcript, participants);
    if (!newTranscript) continue;

    // Only update if different
    if (newTranscript === call.raw_transcript) continue;

    const { error } = await supabase
      .from("calls")
      .update({ raw_transcript: newTranscript })
      .eq("id", call.id);

    if (error) {
      errors.push(`${call.id}: ${error.message}`);
    } else {
      reformatted++;
    }

    // Also update call_transcripts if exists
    await supabase
      .from("call_transcripts")
      .update({
        full_text: newTranscript,
        word_count: newTranscript.split(/\s+/).length,
      })
      .eq("call_id", call.id);
  }

  return NextResponse.json({
    success: true,
    reformatted,
    total: calls.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
