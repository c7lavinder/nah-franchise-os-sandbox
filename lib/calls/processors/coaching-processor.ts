/**
 * Coaching call processor — links to territory + coach, triggers review, extracts action items.
 */

import { createServerClient } from "@/lib/supabase/server";
import type { ReadAIWebhookPayload, ClassifiedCall } from "../classifier";
import { formatTranscript, standardizeTitle } from "../classifier";

export async function processCoachingCall(
  payload: ReadAIWebhookPayload,
  classified: ClassifiedCall
): Promise<void> {
  const supabase = createServerClient();

  if (!classified.territory_ms_slug) return;

  // 1. Resolve contact to local UUID
  let contactUuid: string | null = null;
  if (classified.contact_id) {
    const { data: localContact } = await supabase
      .from("contacts")
      .select("id")
      .eq("ghl_contact_id", classified.contact_id)
      .maybeSingle();
    contactUuid = localContact?.id ?? null;
  }

  // 2. Look up coaching call type
  const { data: callType } = await supabase
    .from("call_types")
    .select("id")
    .eq("slug", "coaching_call")
    .maybeSingle();

  // 3. Create call record
  const { data: callRecord } = await supabase
    .from("calls")
    .insert({
      contact_id: contactUuid,
      territory_ms_slug: classified.territory_ms_slug,
      coach_user_id: classified.coach_user_id,
      call_type_id: callType?.id ?? null,
      read_ai_session_id: payload.session_id,
      title: standardizeTitle(
        "Coaching Call",
        classified.external_participant_name ? [classified.external_participant_name] : [],
        payload.title ?? null,
      ),
      started_at: payload.start_time ?? null,
      ended_at: payload.end_time ?? null,
      duration_seconds: payload.start_time && payload.end_time
        ? Math.round((new Date(payload.end_time).getTime() - new Date(payload.start_time).getTime()) / 1000)
        : null,
      raw_transcript: formatTranscript(payload.transcript),
      source: "read_ai",
      status: "completed",
      hosted_by_user_id: classified.coach_user_id,
    })
    .select("id")
    .single();

  if (!callRecord) return;

  // 4. Link call back to read_ai_sessions
  await supabase
    .from("read_ai_sessions")
    .update({ linked_call_id: callRecord.id })
    .eq("session_id", payload.session_id);

  // 5. Store transcript
  const hasTranscript = (payload.transcript?.speaker_blocks?.length ?? 0) > 0 || (payload.transcript?.turns?.length ?? 0) > 0;
  if (hasTranscript) {
    await supabase.from("call_transcripts").insert({
      call_id: callRecord.id,
      source: "read_ai",
      full_text: formatTranscript(payload.transcript),
      word_count: formatTranscript(payload.transcript).split(/\s+/).length,
    });
  }

  // 6. Trigger review pipeline
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
