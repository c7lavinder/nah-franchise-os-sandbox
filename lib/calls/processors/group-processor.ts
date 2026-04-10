/**
 * Group call processor — creates call record, pending KB suggestion, flags for journal.
 */

import { createServerClient } from "@/lib/supabase/server";
import type { ReadAIWebhookPayload, ClassifiedCall } from "../classifier";
import { formatTranscript } from "../classifier";

export async function processGroupCall(
  payload: ReadAIWebhookPayload,
  classified: ClassifiedCall
): Promise<void> {
  const supabase = createServerClient();

  // 1. Create call record (no contact, no territory)
  const { data: callRecord } = await supabase
    .from("calls")
    .insert({
      call_type_id: null,
      read_ai_session_id: payload.session_id,
      title: payload.title ?? "Group Call",
      started_at: payload.start_time ?? null,
      ended_at: payload.end_time ?? null,
      duration_seconds: payload.start_time && payload.end_time
        ? Math.round((new Date(payload.end_time).getTime() - new Date(payload.start_time).getTime()) / 1000)
        : null,
      raw_transcript: formatTranscript(payload.transcript),
      summary: payload.summary ?? null,
      action_items: payload.action_items ?? null,
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
  if (payload.transcript?.turns?.length) {
    await supabase.from("call_transcripts").insert({
      call_id: callRecord.id,
      source: "read_ai",
      full_text: formatTranscript(payload.transcript),
      word_count: formatTranscript(payload.transcript).split(/\s+/).length,
    });
  }

  // 4. Create pending_review KB document from summary
  if (payload.summary) {
    const tokenCount = Math.ceil(payload.summary.length / 4);
    await supabase.from("knowledge_documents").insert({
      title: `Group Call: ${payload.title ?? "Untitled"} — ${new Date(payload.start_time ?? Date.now()).toLocaleDateString()}`,
      category: "coaching",
      content: payload.summary,
      is_active: true,
      priority: 3,
      token_count: tokenCount,
      status: "pending_review",
    });
  }

  // 5. Trigger review pipeline (for coaching tab content)
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
