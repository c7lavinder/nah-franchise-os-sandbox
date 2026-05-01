/**
 * Coaching call processor — links to territory + coach, triggers review, extracts action items.
 */

import { createServerClient } from "@/lib/supabase/server";
import type { ReadAIWebhookPayload, ClassifiedCall } from "../classifier";
import { formatTranscript, standardizeTitle, toClassifyCategory } from "../classifier";
import { insertCallParticipants } from "./insert-participants";
import { upsertCallJunctions } from "./upsert-call-junctions";
import { reconcileCall } from "./reconcile-call";
import { classifyCallType } from "../classify-type";
import { resolveCallTypeBySlug } from "../resolve-call-type";
import { callAlreadyExistsForReadAiSession } from "./check-existing";

export async function processCoachingCall(payload: ReadAIWebhookPayload, classified: ClassifiedCall): Promise<void> {
  const supabase = createServerClient();

  if (await callAlreadyExistsForReadAiSession(supabase, payload.session_id)) {
    console.info(`[coaching-processor] call already exists for session ${payload.session_id}; skipping`);
    return;
  }

  if (!classified.match.territory_ms_slug) return;

  // 1. Classify call type
  const nahEmails = classified.match.participants
    .filter((p) => p.role === "nah_team" && p.email)
    .map((p) => p.email as string);
  const classification = classifyCallType({
    title: payload.title ?? null,
    nah_emails: nahEmails,
    is_internal: false,
    has_external_participant: true,
    has_territory_owner: true,
    category: toClassifyCategory(classified.call_type),
    source: "read_ai",
  });
  const callType = await resolveCallTypeBySlug(supabase, classification.slug);

  // 2. Insert call
  const { data: callRecord } = await supabase
    .from("calls")
    .insert({
      contact_id: classified.match.contact_id,
      territory_ms_slug: classified.match.territory_ms_slug,
      journey_pipeline_state_id: classified.match.journey_pipeline_state_id,
      coach_user_id: classified.coach_user_id,
      call_type_id: callType.id,
      classification_reason: classification.reason,
      match_confidence: classified.match.confidence,
      match_reason: classified.match.reason,
      read_ai_session_id: payload.session_id,
      title: standardizeTitle(
        callType.name ?? "Coaching Call",
        classified.external_participant_name ? [classified.external_participant_name] : [],
        payload.title ?? null
      ),
      started_at: payload.start_time ?? null,
      ended_at: payload.end_time ?? null,
      duration_seconds:
        payload.start_time && payload.end_time
          ? Math.round((new Date(payload.end_time).getTime() - new Date(payload.start_time).getTime()) / 1000)
          : null,
      raw_transcript: formatTranscript(payload.transcript, payload.participants),
      source: "read_ai",
      status: "completed",
      hosted_by_user_id: classified.coach_user_id,
    })
    .select("id")
    .single();

  if (!callRecord) return;

  // 3. Insert call_participants
  await insertCallParticipants(callRecord.id, classified.match.participants);

  // 3a. Populate call_territories + call_journeys junctions.
  await upsertCallJunctions(supabase, callRecord.id, classified.match);

  // 3b. Safety-net reconcile
  await reconcileCall(callRecord.id);

  // 4. Link back to read_ai_sessions
  await supabase
    .from("read_ai_sessions")
    .update({ linked_call_id: callRecord.id })
    .eq("session_id", payload.session_id);

  // 5. Store transcript
  const hasTranscript =
    (payload.transcript?.speaker_blocks?.length ?? 0) > 0 || (payload.transcript?.turns?.length ?? 0) > 0;
  if (hasTranscript) {
    await supabase.from("call_transcripts").insert({
      call_id: callRecord.id,
      source: "read_ai",
      full_text: formatTranscript(payload.transcript, payload.participants),
      word_count: formatTranscript(payload.transcript, payload.participants).split(/\s+/).length,
    });
  }

  // 6. Review pipeline
  const appUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/frandev`;
  try {
    await fetch(`${appUrl}/api/calls/${callRecord.id}/review-package`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    // Non-critical
  }

  // 7. Scout generation
  if (hasTranscript) {
    try {
      await fetch(`${appUrl}/api/calls/${callRecord.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      // Non-critical
    }
  }
}
