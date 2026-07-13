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
import { transcribeAudio } from "@/lib/calls/whisper";
import { getUploadExtension, resolveUploadKind } from "@/lib/calls/upload-validation";
import { loadUploadableCall } from "@/lib/calls/upload-call-record";
import { resolveFromTranscript } from "@/lib/calls/resolve-from-transcript";

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
      await resolveFromTranscript(supabase, callId, text.trim(), call.hosted_by_user_id, call.contact_id).catch(
        (err) => {
          console.error(`[upload] speaker resolution failed for call ${callId}:`, err);
        }
      );

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
        await resolveFromTranscript(supabase, callId, whisperText, call.hosted_by_user_id, call.contact_id).catch(
          (err) => {
            console.error(`[upload] speaker resolution failed for call ${callId}:`, err);
          }
        );
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
