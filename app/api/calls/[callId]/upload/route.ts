export const dynamic = "force-dynamic";

/**
 * POST /api/calls/:callId/upload
 * Handles file uploads for calls: .txt transcripts and .mp4/.webm recordings.
 * Stores files in Supabase Storage, updates call record.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  const { callId } = await params;
  const supabase = createServerClient();

  const { data: call } = await supabase
    .from("calls")
    .select("id, contact_id, sub_task_id, journey_pipeline_state_id, hosted_by_user_id")
    .eq("id", callId)
    .single();
  if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const fileType = formData.get("type") as string | null; // "transcript" or "recording"

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

  try {
    if (fileType === "transcript" || ext === "txt") {
      // .txt transcript — read text content and save to call_transcripts
      const text = await file.text();
      if (!text.trim()) return NextResponse.json({ error: "Empty transcript file" }, { status: 400 });

      const wordCount = text.trim().split(/\s+/).length;

      const { data: transcript, error: txErr } = await supabase
        .from("call_transcripts")
        .insert({
          call_id: callId,
          source: "file_upload",
          full_text: text.trim(),
          word_count: wordCount,
          metadata: { original_filename: file.name },
        })
        .select("id")
        .single();

      if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });

      // Also store as raw_transcript on call
      await supabase.from("calls").update({ raw_transcript: text.trim(), status: "completed" }).eq("id", callId);

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

    if (fileType === "recording" || ["mp4", "webm", "m4a", "mp3", "wav"].includes(ext)) {
      // Video/audio recording — upload to Supabase Storage
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const storagePath = `calls/${callId}/recording.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("call-recordings")
        .upload(storagePath, buffer, {
          contentType: file.type || `video/${ext}`,
          upsert: true,
        });

      if (uploadErr) {
        // Bucket might not exist — try creating it
        if (uploadErr.message?.includes("not found") || uploadErr.message?.includes("Bucket")) {
          await supabase.storage.createBucket("call-recordings", { public: false });
          const { error: retryErr } = await supabase.storage
            .from("call-recordings")
            .upload(storagePath, buffer, {
              contentType: file.type || `video/${ext}`,
              upsert: true,
            });
          if (retryErr) return NextResponse.json({ error: retryErr.message }, { status: 500 });
        } else {
          return NextResponse.json({ error: uploadErr.message }, { status: 500 });
        }
      }

      // Get public/signed URL
      const { data: urlData } = await supabase.storage
        .from("call-recordings")
        .createSignedUrl(storagePath, 60 * 60 * 24 * 365); // 1 year

      const recordingUrl = urlData?.signedUrl ?? storagePath;

      // Update call with recording URL
      await supabase.from("calls").update({
        recording_url: recordingUrl,
        status: "completed",
      }).eq("id", callId);

      return NextResponse.json({
        type: "recording",
        url: recordingUrl,
        size: buffer.length,
        success: true,
      });
    }

    return NextResponse.json({ error: `Unsupported file type: .${ext}` }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
