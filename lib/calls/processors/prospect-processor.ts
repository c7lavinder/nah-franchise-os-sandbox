/**
 * Prospect call processor — creates contact if needed, call record, triggers review pipeline.
 */

import { createServerClient } from "@/lib/supabase/server";
import type { ReadAIWebhookPayload, ClassifiedCall } from "../classifier";
import { formatTranscript } from "../classifier";

/** Map NAH participant email to call type slug for rubric selection */
function determineProspectCallType(
  nahEmail: string | null,
  title: string | null
): string {
  if (!nahEmail) return "unknown_call";
  const email = nahEmail.toLowerCase();
  if (email.includes("matt")) return "matt_call";
  if (email.includes("sam")) return "sam_call";
  if (email.includes("mark")) return "mark_call";
  if (email.includes("chad")) {
    if (title?.toLowerCase().includes("intro")) return "intro_call";
    return "chad_call";
  }
  return "unknown_call";
}

export async function processProspectCall(
  payload: ReadAIWebhookPayload,
  classified: ClassifiedCall
): Promise<void> {
  const supabase = createServerClient();

  // 1. Create or find contact if not matched
  let contactId = classified.contact_id;
  if (!contactId && classified.external_participant_email) {
    const { data: newContact } = await supabase
      .from("contacts")
      .insert({
        email: classified.external_participant_email,
        first_name: classified.external_participant_name?.split(" ")[0] ?? null,
        last_name: classified.external_participant_name?.split(" ").slice(1).join(" ") ?? null,
        opportunity_source: "Read.ai Call",
        needs_review: true,
      })
      .select("ghl_contact_id")
      .single();
    contactId = newContact?.ghl_contact_id ?? null;
  }

  // 2. Determine call type for rubric
  const callTypeSlug = determineProspectCallType(
    classified.nah_participant_email,
    payload.title ?? null
  );

  // 3. Look up call_type_id
  const { data: callType } = await supabase
    .from("call_types")
    .select("id")
    .eq("slug", callTypeSlug)
    .maybeSingle();

  // 4. Look up host user
  let hostedByUserId: string | null = null;
  if (classified.nah_participant_email) {
    const { data: hostUser } = await supabase
      .from("users")
      .select("id")
      .ilike("email", classified.nah_participant_email)
      .maybeSingle();
    hostedByUserId = hostUser?.id ?? null;
  }

  // 5. Resolve contact to local UUID
  let contactUuid: string | null = null;
  if (contactId) {
    const { data: localContact } = await supabase
      .from("contacts")
      .select("id")
      .eq("ghl_contact_id", contactId)
      .maybeSingle();
    contactUuid = localContact?.id ?? null;
  }

  // 6. Create call record
  const { data: callRecord } = await supabase
    .from("calls")
    .insert({
      contact_id: contactUuid,
      call_type_id: callType?.id ?? null,
      read_ai_session_id: payload.session_id,
      title: payload.title ?? "Prospect Call",
      started_at: payload.start_time ?? null,
      ended_at: payload.end_time ?? null,
      duration_seconds: payload.start_time && payload.end_time
        ? Math.round((new Date(payload.end_time).getTime() - new Date(payload.start_time).getTime()) / 1000)
        : null,
      raw_transcript: formatTranscript(payload.transcript),
      source: "read_ai",
      status: "completed",
      hosted_by_user_id: hostedByUserId,
    })
    .select("id")
    .single();

  if (!callRecord) return;

  // 7. Link call back to read_ai_sessions
  await supabase
    .from("read_ai_sessions")
    .update({ linked_call_id: callRecord.id })
    .eq("session_id", payload.session_id);

  // 8. Store transcript in call_transcripts table
  const hasTranscript = (payload.transcript?.speaker_blocks?.length ?? 0) > 0 || (payload.transcript?.turns?.length ?? 0) > 0;
  if (hasTranscript) {
    await supabase.from("call_transcripts").insert({
      call_id: callRecord.id,
      source: "read_ai",
      full_text: formatTranscript(payload.transcript),
      word_count: formatTranscript(payload.transcript).split(/\s+/).length,
    });
  }

  // 9. Trigger review pipeline (non-blocking)
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    await fetch(`${appUrl}/api/calls/${callRecord.id}/review-package`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    // Non-critical — review can be triggered manually
  }
}
