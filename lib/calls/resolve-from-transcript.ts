/**
 * Shared post-transcript resolution: extract speakers, resolve participants,
 * and update the call record with contact/territory/journey/title.
 *
 * Used by the direct upload route (app/api/calls/[callId]/upload) and by the
 * transcript job processor for native (MasterSuite) uploads, which ride the
 * async transcript_jobs queue instead of the inline route.
 */

import { createServerClient } from "@/lib/supabase/server";
import { extractSpeakers } from "@/lib/calls/extract-speakers";
import { resolveCallParticipants, createSupabaseResolverDb } from "@/lib/calls/resolve-participants";
import { upsertCallJunctions } from "@/lib/calls/processors/upsert-call-junctions";
import { classifyCallType } from "@/lib/calls/classify-type";
import { resolveCallTypeBySlug } from "@/lib/calls/resolve-call-type";
import { applySelectedUploadContact, buildNewCallParticipants } from "@/lib/calls/upload-mapping";

export async function resolveFromTranscript(
  supabase: ReturnType<typeof createServerClient>,
  callId: string,
  transcript: string,
  hostedByUserId: string | null,
  selectedContactId: string | null
) {
  const meta = extractSpeakers(transcript);
  if (meta.participantSignals.length === 0) return;

  const resolverDb = createSupabaseResolverDb(supabase);

  // Add the host user's email if we have one
  if (hostedByUserId) {
    const { data: hostUser } = await supabase.from("users").select("email").eq("id", hostedByUserId).maybeSingle();
    if (hostUser?.email) {
      meta.participantSignals.push({ email: hostUser.email });
    }
  }

  const match = await resolveCallParticipants(
    {
      participants: meta.participantSignals,
      meeting_title: meta.title,
      source: "manual",
    },
    resolverDb
  );

  // Manual prospect selection wins as explicit user context. Speaker extraction
  // is often imperfect on pasted transcripts; if the uploader selected a
  // prospect/journey, keep that mapping even when speaker names are vague or
  // misspelled.
  if (selectedContactId) {
    const [journey, selectedRes] = await Promise.all([
      resolverDb.getActiveJourneyForContact(selectedContactId, null),
      !match.participants.some((p) => p.contact_id === selectedContactId)
        ? supabase
            .from("contacts")
            .select("id, ghl_contact_id, first_name, last_name, email")
            .eq("id", selectedContactId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    applySelectedUploadContact(match, selectedContactId, selectedRes.data, journey);
  }

  // Build the update payload — only set fields if resolver found something
  const updates: Record<string, unknown> = {};

  if (match.contact_id) updates.contact_id = match.contact_id;
  if (match.TerritorySlug) updates.TerritorySlug = match.TerritorySlug;
  if (match.journey_pipeline_state_id) updates.journey_pipeline_state_id = match.journey_pipeline_state_id;
  if (match.confidence > 0) {
    updates.match_confidence = match.confidence;
    updates.match_reason = match.reason;
  }

  // Use extracted title if the call still has a generic title
  if (meta.title) {
    const { data: currentCall } = await supabase.from("calls").select("title").eq("id", callId).single();
    if (currentCall?.title === "Uploaded Call" || currentCall?.title === "transcript") {
      updates.title = meta.title;
    }
  }

  // Re-classify call type now that we have participant info
  if (match.contact_id || match.TerritorySlug) {
    let hostEmail: string | null = null;
    if (hostedByUserId) {
      const { data: hostUser } = await supabase.from("users").select("email").eq("id", hostedByUserId).maybeSingle();
      hostEmail = hostUser?.email ?? null;
    }

    const nahTeamEmails = match.participants.filter((p) => p.role === "nah_team" && p.email).map((p) => p.email!);
    if (hostEmail && !nahTeamEmails.includes(hostEmail)) {
      nahTeamEmails.push(hostEmail);
    }

    const classification = classifyCallType({
      title: meta.title ?? "Uploaded Call",
      nah_emails: nahTeamEmails,
      is_internal: match.participants.every((p) => p.role === "nah_team"),
      has_external_participant: match.participants.some((p) => p.role !== "nah_team"),
      has_territory_owner: !!match.TerritorySlug,
      source: "manual",
    });
    const resolved = await resolveCallTypeBySlug(supabase, classification.slug);
    updates.call_type_id = resolved.id;
    updates.classification_reason = classification.reason;
  }

  if (Object.keys(updates).length > 0) {
    await supabase.from("calls").update(updates).eq("id", callId);
  }

  // Insert junction rows (territories + journeys)
  await upsertCallJunctions(supabase, callId, match);

  // Insert call_participants rows
  const { data: existingParticipants } = await supabase
    .from("call_participants")
    .select("display_name, user_id, contact_id")
    .eq("call_id", callId);
  const newParticipants = buildNewCallParticipants(callId, match, existingParticipants ?? []);

  if (newParticipants.length > 0) {
    await supabase.from("call_participants").insert(newParticipants);
  }
}
