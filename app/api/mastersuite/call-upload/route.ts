export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/mastersuite/call-upload
 *
 * Server-to-server call intake for the native MasterSuite FranDev pages.
 * Auth: shared secret (MASTERSUITE_UPLOAD_SECRET) as `Authorization: Bearer`,
 * modeled on CRON_SECRET but REQUIRED — the route refuses to run without it
 * outside development.
 *
 * Recordings ride Supabase Storage directly (signed upload URL) instead of
 * this route's request body, because Vercel caps function bodies at ~4.5MB.
 * Transcription then happens on the async transcript_jobs queue
 * (process-transcripts cron, every 5 min).
 *
 * Actions (JSON body, discriminated by `action`):
 *  - init:       { action, file_name, requested_by, title?, contact_id?, ghl_contact_id? }
 *                → creates the calls row + returns a signed upload URL.
 *  - complete:   { action, call_id, path }
 *                → verifies the object landed, sets recording_url, enqueues
 *                  a transcript job.
 *  - transcript: { action, transcript_text, requested_by, file_name?, title?,
 *                  contact_id?, ghl_contact_id? }
 *                → creates the call + ingests the transcript inline (same
 *                  behavior as the app's .txt upload path).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { classifyCallType } from "@/lib/calls/classify-type";
import { resolveCallTypeBySlug } from "@/lib/calls/resolve-call-type";
import { getUploadExtension, resolveUploadKind } from "@/lib/calls/upload-validation";
import { resolveFromTranscript } from "@/lib/calls/resolve-from-transcript";

const BUCKET = "call-recordings";

function requireUploadSecret(request: NextRequest): NextResponse | null {
  const secret = process.env.MASTERSUITE_UPLOAD_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "development") return null;
    return NextResponse.json({ error: "MASTERSUITE_UPLOAD_SECRET not configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

type UploadBody = {
  action?: string;
  file_name?: string;
  requested_by?: string;
  title?: string;
  contact_id?: string;
  ghl_contact_id?: string;
  call_id?: string;
  path?: string;
  transcript_text?: string;
};

/** Resolve the MasterSuite username (email) to a Supabase users.id. */
async function resolveHostUserId(
  supabase: ReturnType<typeof createServerClient>,
  requestedBy: string | undefined
): Promise<{ id: string; email: string } | null> {
  if (!requestedBy?.trim()) return null;
  const { data } = await supabase.from("users").select("id, email").ilike("email", requestedBy.trim()).maybeSingle();
  return data ?? null;
}

/** Resolve an optional contact reference. GHL ids must never be compared
 *  against uuid columns, so the two id kinds use separate lookups. */
async function resolveContactId(
  supabase: ReturnType<typeof createServerClient>,
  contactId: string | undefined,
  ghlContactId: string | undefined
): Promise<string | null> {
  if (contactId?.trim()) return contactId.trim();
  if (!ghlContactId?.trim()) return null;
  const { data } = await supabase.from("contacts").select("id").eq("ghl_contact_id", ghlContactId.trim()).maybeSingle();
  return data?.id ?? null;
}

async function createUploadCall(
  supabase: ReturnType<typeof createServerClient>,
  body: UploadBody,
  status: "scheduled" | "completed"
): Promise<{ callId: string; hostedByUserId: string | null; contactId: string | null } | NextResponse> {
  const host = await resolveHostUserId(supabase, body.requested_by);
  const contactId = await resolveContactId(supabase, body.contact_id, body.ghl_contact_id);
  const title = body.title?.trim() || "Uploaded Call";

  const classification = classifyCallType({
    title,
    nah_emails: host ? [host.email] : [],
    is_internal: false,
    has_external_participant: !!contactId,
    has_territory_owner: false,
    source: "manual",
  });
  const callType = await resolveCallTypeBySlug(supabase, classification.slug);

  const { data: call, error } = await supabase
    .from("calls")
    .insert({
      title,
      contact_id: contactId,
      call_type_id: callType.id,
      classification_reason: classification.reason,
      hosted_by_user_id: host?.id ?? null,
      source: "manual",
      status,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return { callId: call.id, hostedByUserId: host?.id ?? null, contactId };
}

export async function POST(request: NextRequest) {
  const authError = requireUploadSecret(request);
  if (authError) return authError;

  let body: UploadBody;
  try {
    body = (await request.json()) as UploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const supabase = createServerClient();

  try {
    // ─── init: create call + signed upload URL for the recording ─────────
    if (body.action === "init") {
      if (!body.file_name?.trim()) {
        return NextResponse.json({ error: "file_name is required" }, { status: 400 });
      }
      const ext = getUploadExtension(body.file_name);
      if (resolveUploadKind(null, body.file_name) !== "recording") {
        return NextResponse.json(
          { error: `Unsupported recording type: .${ext} — send transcripts via action=transcript` },
          { status: 400 }
        );
      }

      const created = await createUploadCall(supabase, body, "scheduled");
      if (created instanceof NextResponse) return created;

      const storagePath = `calls/${created.callId}/recording.${ext}`;
      let signed = await supabase.storage.from(BUCKET).createSignedUploadUrl(storagePath);
      if (signed.error?.message?.includes("not found") || signed.error?.message?.includes("Bucket")) {
        await supabase.storage.createBucket(BUCKET, { public: false });
        signed = await supabase.storage.from(BUCKET).createSignedUploadUrl(storagePath);
      }
      if (signed.error || !signed.data) {
        return NextResponse.json({ error: signed.error?.message ?? "Could not create upload URL" }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        call_id: created.callId,
        path: storagePath,
        upload_url: signed.data.signedUrl,
        token: signed.data.token,
        hosted_by_user_id: created.hostedByUserId,
      });
    }

    // ─── complete: recording landed in storage — link it + queue Whisper ─
    if (body.action === "complete") {
      if (!body.call_id?.trim() || !body.path?.trim()) {
        return NextResponse.json({ error: "call_id and path are required" }, { status: 400 });
      }

      const { data: call } = await supabase.from("calls").select("id").eq("id", body.call_id.trim()).maybeSingle();
      if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });

      // Signed-URL creation fails if the object never arrived — this doubles
      // as the existence check.
      const { data: urlData, error: urlError } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(body.path.trim(), 60 * 60 * 24 * 365);
      if (urlError || !urlData?.signedUrl) {
        return NextResponse.json(
          { error: `Recording not found in storage: ${urlError?.message ?? body.path}` },
          { status: 400 }
        );
      }

      await supabase.from("calls").update({ recording_url: urlData.signedUrl }).eq("id", call.id);
      const { error: jobError } = await supabase.from("transcript_jobs").insert({
        call_id: call.id,
        audio_url: urlData.signedUrl,
        status: "pending",
      });
      if (jobError) return NextResponse.json({ error: jobError.message }, { status: 500 });

      return NextResponse.json({ success: true, call_id: call.id, queued: true });
    }

    // ─── transcript: small text payload — ingest inline ──────────────────
    if (body.action === "transcript") {
      const text = body.transcript_text?.trim();
      if (!text) return NextResponse.json({ error: "transcript_text is required" }, { status: 400 });

      const created = await createUploadCall(supabase, body, "completed");
      if (created instanceof NextResponse) return created;

      const wordCount = text.split(/\s+/).length;
      const { data: transcript, error: txErr } = await supabase
        .from("call_transcripts")
        .insert({
          call_id: created.callId,
          source: "upload",
          full_text: text,
          word_count: wordCount,
          metadata: { original_filename: body.file_name ?? "native-paste.txt", origin: "mastersuite_native" },
        })
        .select("id")
        .single();
      if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });

      await supabase.from("calls").update({ raw_transcript: text, status: "completed" }).eq("id", created.callId);

      await resolveFromTranscript(supabase, created.callId, text, created.hostedByUserId, created.contactId).catch(
        (err) => {
          console.error(`[mastersuite-upload] speaker resolution failed for call ${created.callId}:`, err);
        }
      );

      return NextResponse.json({
        success: true,
        type: "transcript",
        call_id: created.callId,
        transcript_id: transcript.id,
        word_count: wordCount,
      });
    }

    return NextResponse.json({ error: `Unknown action: ${body.action ?? "(none)"}` }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
