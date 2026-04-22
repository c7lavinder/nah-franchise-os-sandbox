/**
 * Prospect call processor — creates contact if needed, call record, triggers review pipeline.
 */

import { createServerClient } from "@/lib/supabase/server";
import type { ReadAIWebhookPayload, ClassifiedCall } from "../classifier";
import { formatTranscript, standardizeTitle } from "../classifier";
import { insertCallParticipants } from "./insert-participants";
import { upsertCallJunctions } from "./upsert-call-junctions";
import { reconcileCall } from "./reconcile-call";
import { classifyCallType } from "../classify-type";
import { resolveCallTypeBySlug } from "../resolve-call-type";
import { callAlreadyExistsForReadAiSession } from "./check-existing";

export async function processProspectCall(
  payload: ReadAIWebhookPayload,
  classified: ClassifiedCall
): Promise<void> {
  const supabase = createServerClient();

  if (await callAlreadyExistsForReadAiSession(supabase, payload.session_id)) {
    console.info(`[prospect-processor] call already exists for session ${payload.session_id}; skipping`);
    return;
  }

  // 1. Create a contact if the classifier couldn't match one.
  let resolvedContactUuid = classified.match.contact_id;
  if (!resolvedContactUuid && classified.external_participant_email) {
    const { data: newContact } = await supabase
      .from("contacts")
      .insert({
        email: classified.external_participant_email,
        first_name: classified.external_participant_name?.split(" ")[0] ?? null,
        last_name: classified.external_participant_name?.split(" ").slice(1).join(" ") ?? null,
        opportunity_source: "Read.ai Call",
        needs_review: true,
      })
      .select("id")
      .single();
    resolvedContactUuid = newContact?.id ?? null;
  }

  // 2. Determine call type via the shared helper.
  const nahEmails = classified.match.participants
    .filter((p) => p.role === "nah_team" && p.email)
    .map((p) => p.email as string);
  if (classified.nah_participant_email && !nahEmails.includes(classified.nah_participant_email)) {
    nahEmails.push(classified.nah_participant_email);
  }
  const classification = classifyCallType({
    title: payload.title ?? null,
    nah_emails: nahEmails,
    is_internal: false,
    has_external_participant: true,
    has_territory_owner: !!classified.match.territory_ms_slug,
    source: "read_ai",
  });
  const callType = await resolveCallTypeBySlug(supabase, classification.slug);

  // 3. Look up host user.
  let hostedByUserId: string | null = null;
  if (classified.nah_participant_email) {
    const { data: hostUser } = await supabase
      .from("users")
      .select("id")
      .ilike("email", classified.nah_participant_email)
      .maybeSingle();
    hostedByUserId = hostUser?.id ?? null;
  }

  // 4. Insert the call.
  const { data: callRecord } = await supabase
    .from("calls")
    .insert({
      contact_id: resolvedContactUuid,
      call_type_id: callType.id,
      classification_reason: classification.reason,
      match_confidence: classified.match.confidence,
      match_reason: classified.match.reason,
      territory_ms_slug: classified.match.territory_ms_slug,
      journey_pipeline_state_id: classified.match.journey_pipeline_state_id,
      read_ai_session_id: payload.session_id,
      title: standardizeTitle(
        callType.name,
        classified.external_participant_name ? [classified.external_participant_name] : [],
        payload.title ?? null,
      ),
      started_at: payload.start_time ?? null,
      ended_at: payload.end_time ?? null,
      duration_seconds: payload.start_time && payload.end_time
        ? Math.round((new Date(payload.end_time).getTime() - new Date(payload.start_time).getTime()) / 1000)
        : null,
      raw_transcript: formatTranscript(payload.transcript, payload.participants),
      source: "read_ai",
      status: "completed",
      hosted_by_user_id: hostedByUserId,
    })
    .select("id")
    .single();

  if (!callRecord) return;

  // 5. Insert call_participants (the resolver already did the matching).
  await insertCallParticipants(callRecord.id, classified.match.participants);

  // 5a. Populate call_territories + call_journeys junctions so every contact's
  //     territory and journey is attached to the call, not just the primary.
  await upsertCallJunctions(supabase, callRecord.id, classified.match);

  // 5b. Safety-net reconcile for contacts that appear after the call lands.
  await reconcileCall(callRecord.id);

  // 6. Link call back to read_ai_sessions
  await supabase
    .from("read_ai_sessions")
    .update({ linked_call_id: callRecord.id })
    .eq("session_id", payload.session_id);

  // 7. Store transcript
  const hasTranscript = (payload.transcript?.speaker_blocks?.length ?? 0) > 0 || (payload.transcript?.turns?.length ?? 0) > 0;
  if (hasTranscript) {
    await supabase.from("call_transcripts").insert({
      call_id: callRecord.id,
      source: "read_ai",
      full_text: formatTranscript(payload.transcript, payload.participants),
      word_count: formatTranscript(payload.transcript, payload.participants).split(/\s+/).length,
    });
  }

  // 8. Trigger review pipeline
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    await fetch(`${appUrl}/api/calls/${callRecord.id}/review-package`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    // Non-critical
  }

  // 9. Trigger Scout generation
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
