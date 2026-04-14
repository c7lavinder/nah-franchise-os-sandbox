/**
 * Group call processor — creates call record, pending KB suggestion, flags for journal.
 */

import { createServerClient } from "@/lib/supabase/server";
import type { ReadAIWebhookPayload, ClassifiedCall } from "../classifier";
import { formatTranscript, standardizeTitle, isNAHTeamEmail } from "../classifier";
import { insertCallParticipants } from "./insert-participants";
import { reconcileCall } from "./reconcile-call";

export async function processGroupCall(
  payload: ReadAIWebhookPayload,
  classified: ClassifiedCall
): Promise<void> {
  const supabase = createServerClient();

  // 1. Determine call type — internal (team only) vs group (with externals)
  const isInternal = classified.call_type === "internal";
  const callTypeSlug = isInternal ? "team_call" : null;

  // Look up call_type_id for team calls
  let callTypeId: string | null = null;
  if (callTypeSlug) {
    const { data: ct } = await supabase
      .from("call_types")
      .select("id")
      .eq("slug", callTypeSlug)
      .maybeSingle();
    callTypeId = ct?.id ?? null;
  }

  const typeLabel = isInternal ? "Team Call" : "Group Call";
  const externalNames = (payload.participants ?? [])
    .filter((p) => !isNAHTeamEmail(p.email))
    .map((p) => p.name)
    .filter(Boolean) as string[];

  const { data: callRecord } = await supabase
    .from("calls")
    .insert({
      call_type_id: callTypeId,
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

  // 2. Insert call_participants
  await insertCallParticipants(callRecord.id, classified.resolved_participants ?? []);

  // 2b. Reconcile — link any unmatched participants to contacts/territories immediately
  await reconcileCall(callRecord.id);

  // 3. Link call back to read_ai_sessions
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
      full_text: formatTranscript(payload.transcript, payload.participants),
      word_count: formatTranscript(payload.transcript, payload.participants).split(/\s+/).length,
    });
  }

  // 4. Trigger review pipeline (Scout will analyze transcript)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    await fetch(`${appUrl}/api/calls/${callRecord.id}/review-package`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    // Non-critical
  }

  // 5. Trigger Scout generation (summary, coaching, next steps, data extractions)
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
