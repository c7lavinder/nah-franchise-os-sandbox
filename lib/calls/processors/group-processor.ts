/**
 * Group call processor — creates call record, pending KB suggestion, flags for journal.
 */

import { createServerClient } from "@/lib/supabase/server";
import type { ReadAIWebhookPayload, ClassifiedCall } from "../classifier";
import { formatTranscript, standardizeTitle, isNAHTeamEmail } from "../classifier";

export async function processGroupCall(
  payload: ReadAIWebhookPayload,
  classified: ClassifiedCall
): Promise<void> {
  const supabase = createServerClient();

  // 1. Build standardized title from external participant names
  const externalNames = (payload.participants ?? [])
    .filter((p) => !isNAHTeamEmail(p.email))
    .map((p) => p.name)
    .filter(Boolean) as string[];

  const { data: callRecord } = await supabase
    .from("calls")
    .insert({
      call_type_id: null,
      read_ai_session_id: payload.session_id,
      title: standardizeTitle("Group Call", externalNames, payload.title ?? null),
      started_at: payload.start_time ?? null,
      ended_at: payload.end_time ?? null,
      duration_seconds: payload.start_time && payload.end_time
        ? Math.round((new Date(payload.end_time).getTime() - new Date(payload.start_time).getTime()) / 1000)
        : null,
      raw_transcript: formatTranscript(payload.transcript),
      source: "read_ai",
      status: "completed",
      participant_count: payload.participants?.length ?? 0,
      hosted_by_user_id: null,
    })
    .select("id")
    .single();

  if (!callRecord) return;

  // 2. Link call back to read_ai_sessions
  await supabase
    .from("read_ai_sessions")
    .update({ linked_call_id: callRecord.id })
    .eq("session_id", payload.session_id);

  // 3. Store transcript
  const hasTranscript = (payload.transcript?.speaker_blocks?.length ?? 0) > 0 || (payload.transcript?.turns?.length ?? 0) > 0;
  if (hasTranscript) {
    await supabase.from("call_transcripts").insert({
      call_id: callRecord.id,
      source: "read_ai",
      full_text: formatTranscript(payload.transcript),
      word_count: formatTranscript(payload.transcript).split(/\s+/).length,
    });
  }

  // 4. Trigger review pipeline (Scout will analyze transcript)
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    await fetch(`${appUrl}/api/calls/${callRecord.id}/review-package`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    // Non-critical
  }
}
