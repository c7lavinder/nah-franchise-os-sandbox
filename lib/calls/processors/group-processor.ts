/**
 * Group call processor — creates call record, pending KB suggestion, flags for journal.
 */

import { createServerClient } from "@/lib/supabase/server";
import type { ReadAIWebhookPayload, ClassifiedCall } from "../classifier";
import { formatTranscript, standardizeTitle, isNAHTeamEmail } from "../classifier";
import { insertCallParticipants } from "./insert-participants";
import { reconcileCall } from "./reconcile-call";
import { classifyCallType } from "../classify-type";
import { resolveCallTypeBySlug } from "../resolve-call-type";

export async function processGroupCall(
  payload: ReadAIWebhookPayload,
  classified: ClassifiedCall
): Promise<void> {
  const supabase = createServerClient();

  const isInternal = classified.call_type === "internal";

  // 1. Classify via shared helper
  const nahEmails = (classified.resolved_participants ?? [])
    .filter((p) => p.role === "nah_team" && p.email)
    .map((p) => p.email as string);
  const hasTerritoryOwner = (classified.resolved_participants ?? []).some(
    (p) => !!p.territory_ms_slug,
  );
  const classification = classifyCallType({
    title: payload.title ?? null,
    nah_emails: nahEmails,
    is_internal: isInternal,
    has_external_participant: !isInternal,
    has_territory_owner: hasTerritoryOwner,
    source: "read_ai",
  });

  // 2. Resolve slug → call_type row
  const callType = await resolveCallTypeBySlug(supabase, classification.slug);

  const typeLabel = callType.name ?? (isInternal ? "Team Call" : "Group Call");
  const externalNames = (payload.participants ?? [])
    .filter((p) => !isNAHTeamEmail(p.email))
    .map((p) => p.name)
    .filter(Boolean) as string[];

  const { data: callRecord } = await supabase
    .from("calls")
    .insert({
      call_type_id: callType.id,
      classification_reason: classification.reason,
      read_ai_session_id: payload.session_id,
      title: standardizeTitle(typeLabel, externalNames, payload.title ?? null),
      started_at: payload.start_time ?? null,
      ended_at: payload.end_time ?? null,
      duration_seconds: payload.start_time && payload.end_time
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

  // 3. Insert call_participants
  await insertCallParticipants(callRecord.id, classified.resolved_participants ?? []);

  // 3b. Reconcile — link any unmatched participants to contacts/territories immediately
  await reconcileCall(callRecord.id);

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
      full_text: formatTranscript(payload.transcript, payload.participants),
      word_count: formatTranscript(payload.transcript, payload.participants).split(/\s+/).length,
    });
  }

  // 6. Trigger review pipeline (Scout will analyze transcript)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    await fetch(`${appUrl}/api/calls/${callRecord.id}/review-package`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    // Non-critical
  }

  // 7. Trigger Scout generation (summary, coaching, next steps, data extractions)
  if (hasTranscript) {
    try {
      await fetch(`${appUrl}/api/calls/${callRecord.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      // Non-critical — generation can be triggered manually from the UI
    }
  }
}
