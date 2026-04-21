/**
 * Transcript Job Processor
 *
 * Picks up pending transcript_jobs, downloads audio, runs Whisper,
 * stores the transcript, and triggers the review package pipeline.
 */

import { createServerClient } from "@/lib/supabase/server";
import { transcribeAudio } from "@/lib/calls/whisper";
import { generateReviewPackage } from "@/lib/calls/review-package";
import { resolveJpsIdForCps } from "@/lib/journeys/sync";

const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 5;

export async function processTranscriptJobs(): Promise<{
  processed: number;
  failed: number;
  skipped: number;
}> {
  const supabase = createServerClient();
  let processed = 0;
  let failed = 0;
  let skipped = 0;

  // Pick up pending jobs (oldest first, max 5 per run)
  const { data: jobs } = await supabase
    .from("transcript_jobs")
    .select("id, call_id, audio_url, attempts")
    .eq("status", "pending")
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at")
    .limit(BATCH_SIZE);

  if (!jobs || jobs.length === 0) {
    return { processed: 0, failed: 0, skipped: 0 };
  }

  for (const job of jobs) {
    // Mark as processing
    await supabase
      .from("transcript_jobs")
      .update({ status: "processing", started_at: new Date().toISOString(), attempts: job.attempts + 1 })
      .eq("id", job.id);

    try {
      // Download audio
      const audioRes = await fetch(job.audio_url);
      if (!audioRes.ok) {
        throw new Error(`Failed to download audio: ${audioRes.status}`);
      }

      const buffer = Buffer.from(await audioRes.arrayBuffer());
      const filename = job.audio_url.split("/").pop() ?? "audio.webm";

      // Transcribe
      const result = await transcribeAudio(buffer, filename);
      const wordCount = result.text.split(/\s+/).length;

      // Store transcript
      const { data: transcript, error: txError } = await supabase
        .from("call_transcripts")
        .insert({
          call_id: job.call_id,
          source: "whisper",
          full_text: result.text,
          word_count: wordCount,
          metadata: {
            duration: result.duration,
            language: result.language,
            source_url: job.audio_url,
            job_id: job.id,
          },
        })
        .select("id")
        .single();

      if (txError) throw new Error(txError.message);

      // Mark job completed
      await supabase
        .from("transcript_jobs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          transcript_id: transcript.id,
        })
        .eq("id", job.id);

      // Update call status
      await supabase
        .from("calls")
        .update({ status: "completed" })
        .eq("id", job.call_id)
        .eq("status", "scheduled");

      // Auto-log sub-task and trigger review package (fire-and-forget)
      const { data: call } = await supabase
        .from("calls")
        .select("id, contact_id, sub_task_id, contact_pipeline_state_id, hosted_by_user_id")
        .eq("id", job.call_id)
        .single();

      if (call?.sub_task_id && call.contact_pipeline_state_id) {
        const preview = result.text.length > 500 ? result.text.slice(0, 500) + "..." : result.text;
        const jpsId = await resolveJpsIdForCps(supabase, call.contact_pipeline_state_id);
        await supabase.from("contact_sub_task_logs").insert({
          contact_pipeline_state_id: call.contact_pipeline_state_id,
          journey_pipeline_state_id: jpsId,
          sub_task_id: call.sub_task_id,
          logger_user_id: call.hosted_by_user_id,
          source: "ai",
          content_type: "transcript",
          content_text: preview,
          state_advance: "second",
          metadata: { call_id: job.call_id },
        });
      }

      // Trigger review package generation (non-blocking)
      void generateReviewPackage(job.call_id).catch(() => {});

      processed++;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const newStatus = job.attempts + 1 >= MAX_ATTEMPTS ? "failed" : "pending";

      await supabase
        .from("transcript_jobs")
        .update({ status: newStatus, error_message: errorMessage })
        .eq("id", job.id);

      if (newStatus === "failed") failed++;
      else skipped++;
    }
  }

  return { processed, failed, skipped };
}
