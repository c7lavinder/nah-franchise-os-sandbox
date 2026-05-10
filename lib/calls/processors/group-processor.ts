/**
 * Group call processor — writes contact_id/territory from the shared resolver,
 * inserts the participant list, triggers downstream review.
 */

import { createServerClient } from "@/lib/supabase/server";
import type { ReadAIWebhookPayload, ClassifiedCall } from "../classifier";
import { formatTranscript, standardizeTitle, isNAHTeamEmail, toClassifyCategory } from "../classifier";
import { insertCallParticipants } from "./insert-participants";
import { upsertCallJunctions } from "./upsert-call-junctions";
import { reconcileCall } from "./reconcile-call";
import { classifyCallType } from "../classify-type";
import { resolveCallTypeBySlug } from "../resolve-call-type";
import { callAlreadyExistsForReadAiSession } from "./check-existing";

export async function processGroupCall(payload: ReadAIWebhookPayload, classified: ClassifiedCall): Promise<void> {
  const supabase = createServerClient();

  if (await callAlreadyExistsForReadAiSession(supabase, payload.session_id)) {
    console.info(`[group-processor] call already exists for session ${payload.session_id}; skipping`);
    return;
  }

  const isInternal = classified.call_type === "internal";
  const nahEmails = classified.match.participants
    .filter((p) => p.role === "nah_team" && p.email)
    .map((p) => p.email as string);
  const classification = classifyCallType({
    title: payload.title ?? null,
    nah_emails: nahEmails,
    is_internal: isInternal,
    has_external_participant: !isInternal,
    has_territory_owner: !!classified.match.TerritorySlug,
    category: toClassifyCategory(classified.call_type),
    source: "read_ai",
  });
  const callType = await resolveCallTypeBySlug(supabase, classification.slug);

  const typeLabel = callType.name ?? (isInternal ? "Team Call" : "Group Call");
  const externalNames = (payload.participants ?? [])
    .filter((p) => !isNAHTeamEmail(p.email))
    .map((p) => p.name)
    .filter(Boolean) as string[];

  // Group + Internal calls intentionally carry NO primary contact / territory
  // / journey on the `calls` row — the junctions (call_participants,
  // call_territories, call_journeys) hold the full multi-entity truth. This
  // prevents "most-recent contact wins" from flipping the primary on rematch.
  const { data: callRecord } = await supabase
    .from("calls")
    .insert({
      contact_id: null,
      TerritorySlug: null,
      journey_pipeline_state_id: null,
      call_type_id: callType.id,
      classification_reason: classification.reason,
      match_confidence: classified.match.confidence,
      match_reason: classified.match.reason,
      read_ai_session_id: payload.session_id,
      title: standardizeTitle(typeLabel, externalNames, payload.title ?? null),
      started_at: payload.start_time ?? null,
      ended_at: payload.end_time ?? null,
      duration_seconds:
        payload.start_time && payload.end_time
          ? Math.round((new Date(payload.end_time).getTime() - new Date(payload.start_time).getTime()) / 1000)
          : null,
      raw_transcript: formatTranscript(payload.transcript, payload.participants),
      source: "read_ai",
      status: "completed",
      participant_count: payload.participants?.length ?? 0,
      hosted_by_user_id: null,
    })
    .select("id")
    .single();

  if (!callRecord) return;

  await insertCallParticipants(callRecord.id, classified.match.participants);
  await upsertCallJunctions(supabase, callRecord.id, classified.match);
  await reconcileCall(callRecord.id);

  await supabase
    .from("read_ai_sessions")
    .update({ linked_call_id: callRecord.id })
    .eq("session_id", payload.session_id);

  const hasTranscript =
    (payload.transcript?.speaker_blocks?.length ?? 0) > 0 || (payload.transcript?.turns?.length ?? 0) > 0;
  if (hasTranscript) {
    await supabase.from("call_transcripts").insert({
      call_id: callRecord.id,
      source: "upload",
      full_text: formatTranscript(payload.transcript, payload.participants),
      word_count: formatTranscript(payload.transcript, payload.participants).split(/\s+/).length,
    });
  }

  const appUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/frandev`;
  try {
    await fetch(`${appUrl}/api/calls/${callRecord.id}/review-package`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    // Non-critical
  }
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
