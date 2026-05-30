export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/calls/:callId/upload
 *
 * Handles file uploads for calls: .txt transcripts and audio recordings.
 *
 * For transcripts:
 *   - Extracts speaker names from the text
 *   - Runs participant resolver to map speakers → contacts/users
 *   - Updates call with contact_id, territory, journey, title
 *   - Inserts call_participants
 *
 * For audio recordings (.mp4/.webm/.m4a/.mp3/.wav):
 *   - Stores in Supabase Storage
 *   - Auto-triggers Whisper transcription
 *   - After transcript is ready, runs speaker extraction + AI processing
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { extractSpeakers } from "@/lib/calls/extract-speakers";
import { resolveCallParticipants, createSupabaseResolverDb } from "@/lib/calls/resolve-participants";
import { upsertCallJunctions } from "@/lib/calls/processors/upsert-call-junctions";
import { classifyCallType } from "@/lib/calls/classify-type";
import { resolveCallTypeBySlug } from "@/lib/calls/resolve-call-type";
import { transcribeAudio } from "@/lib/calls/whisper";
import { applySelectedUploadContact, buildNewCallParticipants } from "@/lib/calls/upload-mapping";
import { getUploadExtension, resolveUploadKind } from "@/lib/calls/upload-validation";
import { loadUploadableCall } from "@/lib/calls/upload-call-record";

/**
 * After a transcript is available, extract speakers, resolve participants,
 * and update the call record with contact/territory/journey/title.
 */
async function resolveFromTranscript(
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

export async function POST(request: NextRequest, { params }: { params: Promise<{ callId: string }> }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const { callId } = await params;
  const supabase = createServerClient();

  const call = await loadUploadableCall(supabase, callId);
  if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const fileType = formData.get("type") as string | null;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const ext = getUploadExtension(file.name);
  const uploadKind = resolveUploadKind(fileType, file.name);

  try {
    // ─── Transcript upload ────────────────────────────────────────────
    if (uploadKind === "transcript") {
      const text = await file.text();
      if (!text.trim()) return NextResponse.json({ error: "Empty transcript file" }, { status: 400 });

      const wordCount = text.trim().split(/\s+/).length;

      const { data: transcript, error: txErr } = await supabase
        .from("call_transcripts")
        .insert({
          call_id: callId,
          source: "upload",
          full_text: text.trim(),
          word_count: wordCount,
          metadata: { original_filename: file.name },
        })
        .select("id")
        .single();

      if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });

      await supabase.from("calls").update({ raw_transcript: text.trim(), status: "completed" }).eq("id", callId);

      // Extract speakers and resolve participants
      await resolveFromTranscript(supabase, callId, text.trim(), call.hosted_by_user_id, call.contact_id).catch((err) => {
        console.error(`[upload] speaker resolution failed for call ${callId}:`, err);
      });

      // Auto-log sub-task if applicable
      if (call.sub_task_id && call.journey_pipeline_state_id) {
        const preview = text.length > 500 ? text.slice(0, 500) + "..." : text;
        await supabase.from("contact_sub_task_logs").insert({
          journey_pipeline_state_id: call.journey_pipeline_state_id,
          sub_task_id: call.sub_task_id,
          logger_user_id: call.hosted_by_user_id,
          source: "ai",
          content_type: "transcript",
          content_text: preview,
          state_advance: "second",
          metadata: { call_id: callId },
        });
      }

      return NextResponse.json({ type: "transcript", id: transcript.id, wordCount, success: true });
    }

    // ─── Audio/video recording upload ─────────────────────────────────
    if (uploadKind === "recording") {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const storagePath = `calls/${callId}/recording.${ext}`;

      // Upload to Supabase Storage
      let uploadError = (
        await supabase.storage.from("call-recordings").upload(storagePath, buffer, {
          contentType: file.type || `video/${ext}`,
          upsert: true,
        })
      ).error;

      if (uploadError?.message?.includes("not found") || uploadError?.message?.includes("Bucket")) {
        await supabase.storage.createBucket("call-recordings", { public: false });
        uploadError = (
          await supabase.storage.from("call-recordings").upload(storagePath, buffer, {
            contentType: file.type || `video/${ext}`,
            upsert: true,
          })
        ).error;
      }

      if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

      const { data: urlData } = await supabase.storage
        .from("call-recordings")
        .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

      const recordingUrl = urlData?.signedUrl ?? storagePath;

      await supabase.from("calls").update({ recording_url: recordingUrl, status: "completed" }).eq("id", callId);

      // Auto-transcribe via Whisper
      let whisperText: string | null = null;
      try {
        const result = await transcribeAudio(buffer, `recording.${ext}`);
        whisperText = result.text;

        const wordCount = result.text.split(/\s+/).length;
        await supabase.from("call_transcripts").insert({
          call_id: callId,
          source: "whisper",
          full_text: result.text,
          word_count: wordCount,
          metadata: {
            duration: result.duration,
            language: result.language,
            source_url: recordingUrl,
          },
        });

        await supabase
          .from("calls")
          .update({
            raw_transcript: result.text,
            duration_seconds: result.duration ? Math.round(result.duration) : null,
          })
          .eq("id", callId);
      } catch (err) {
        console.error(`[upload] Whisper transcription failed for call ${callId}:`, err);
      }

      // If we got a transcript, resolve speakers
      if (whisperText) {
        await resolveFromTranscript(supabase, callId, whisperText, call.hosted_by_user_id, call.contact_id).catch((err) => {
          console.error(`[upload] speaker resolution failed for call ${callId}:`, err);
        });
      }

      return NextResponse.json({
        type: "recording",
        url: recordingUrl,
        size: buffer.length,
        transcribed: !!whisperText,
        success: true,
      });
    }

    return NextResponse.json({ error: `Unsupported file type: .${ext}` }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
