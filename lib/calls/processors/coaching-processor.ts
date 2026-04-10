/**
 * Coaching call processor — links to territory + coach, triggers review, extracts action items.
 */

import { createServerClient } from "@/lib/supabase/server";
import type { ReadAIWebhookPayload, ClassifiedCall } from "../classifier";
import { formatTranscript, isNAHTeamEmail } from "../classifier";
import { handleDuplicateFieldSuggestion } from "@/lib/scout-learning";

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
      title: payload.title ?? "Coaching Call",
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
  if (payload.transcript?.turns?.length) {
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

  // 7. Extract franchisee action items as territory suggestions
  if (payload.action_items?.length) {
    const franchiseeItems = payload.action_items
      .filter((item) => !isNAHTeamEmail(item.assignee_email))
      .map((item) => item.text)
      .join(" · ");

    if (franchiseeItems) {
      await handleDuplicateFieldSuggestion({
        territory_ms_slug: classified.territory_ms_slug,
        field_name: "coaching_action_items",
        field_table: "territory_profile",
        suggested_value: franchiseeItems,
        source: "call",
        source_id: `call-${callRecord.id}`,
        evidence: "From Read.ai coaching call action items",
        confidence: "high",
      });
    }
  }
}
