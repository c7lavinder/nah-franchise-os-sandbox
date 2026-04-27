export const dynamic = "force-dynamic";

/**
 * POST /api/calls/:callId/transcript
 *
 * Accepts manual paste, file upload URL, or whisper transcription request.
 * After transcript exists, auto-logs a contact_sub_task_logs entry.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { transcribeAudio } from "@/lib/calls/whisper";

interface TranscriptBody {
  source: "manual_paste" | "upload" | "whisper";
  text?: string;
  audioFileUrl?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  await requireAuth(request);
  const { callId } = await params;
  const body = await request.json() as TranscriptBody;
  const supabase = createServerClient();

  // Verify call exists
  const { data: call } = await supabase
    .from("calls")
    .select("id, contact_id, sub_task_id, journey_pipeline_state_id, hosted_by_user_id")
    .eq("id", callId)
    .single();
  if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });

  let fullText: string;
  let wordCount: number;
  const metadata: Record<string, unknown> = {};

  try {
    if (body.source === "manual_paste") {
      if (!body.text?.trim()) return NextResponse.json({ error: "Text is required" }, { status: 400 });
      fullText = body.text.trim();
    } else if (body.source === "whisper" || body.source === "upload") {
      if (!body.audioFileUrl) return NextResponse.json({ error: "audioFileUrl is required" }, { status: 400 });

      // Download the audio file
      const audioRes = await fetch(body.audioFileUrl);
      if (!audioRes.ok) return NextResponse.json({ error: "Failed to download audio file" }, { status: 400 });

      const buffer = Buffer.from(await audioRes.arrayBuffer());
      const filename = body.audioFileUrl.split("/").pop() ?? "audio.webm";

      const result = await transcribeAudio(buffer, filename);
      fullText = result.text;
      metadata.duration = result.duration;
      metadata.language = result.language;
      metadata.source_url = body.audioFileUrl;
    } else {
      return NextResponse.json({ error: "Invalid source" }, { status: 400 });
    }

    wordCount = fullText.split(/\s+/).length;

    // Insert transcript
    const { data: transcript, error: txError } = await supabase
      .from("call_transcripts")
      .insert({
        call_id: callId,
        source: body.source,
        full_text: fullText,
        word_count: wordCount,
        metadata: Object.keys(metadata).length > 0 ? metadata : null,
      })
      .select("id")
      .single();

    if (txError) return NextResponse.json({ error: txError.message }, { status: 500 });

    // Auto-log to contact_sub_task_logs if call has sub_task + pipeline state
    if (call.sub_task_id && call.journey_pipeline_state_id) {
      const preview = fullText.length > 500 ? fullText.slice(0, 500) + "... [full transcript in call]" : fullText;
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

    // Update call status to completed if it was scheduled
    await supabase
      .from("calls")
      .update({ status: "completed" })
      .eq("id", callId)
      .eq("status", "scheduled");

    return NextResponse.json({ id: transcript.id, wordCount, success: true });
  } catch (err) {
    console.error("Transcript intake error:", err);
    const message = err instanceof Error ? err.message : "Failed to process transcript";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
