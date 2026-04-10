export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/read-ai — Read.ai webhook receiver
 *
 * Single entry point for all Read.ai meeting data.
 * Returns 200 immediately, processes async.
 * Per-user signing key: READ_AI_WEBHOOK_SIGNING_KEY_{EMAIL_PREFIX}
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { classifyCall } from "@/lib/calls/classifier";
import type { ReadAIWebhookPayload, ClassifiedCall } from "@/lib/calls/classifier";
import { processProspectCall } from "@/lib/calls/processors/prospect-processor";
import { processCoachingCall } from "@/lib/calls/processors/coaching-processor";
import { processGroupCall } from "@/lib/calls/processors/group-processor";
import { createHmac } from "crypto";

/** Verify Read.ai webhook signature using per-user signing key */
async function verifySignature(
  signature: string,
  rawBody: string,
  ownerEmail: string | null
): Promise<boolean> {
  // Try per-user key from env: READ_AI_WEBHOOK_SIGNING_KEY_{PREFIX}
  if (ownerEmail) {
    const prefix = ownerEmail.split("@")[0].toUpperCase();
    const envKey = process.env[`READ_AI_WEBHOOK_SIGNING_KEY_${prefix}`];
    if (envKey) {
      const computed = createHmac("sha256", envKey)
        .update(rawBody)
        .digest("base64");
      if (computed === signature) return true;
    }
  }

  // Try per-user key from DB
  const supabase = createServerClient();
  if (ownerEmail) {
    const { data: keyRow } = await supabase
      .from("read_ai_webhook_keys")
      .select("signing_key")
      .eq("user_email", ownerEmail.toLowerCase())
      .maybeSingle();

    if (keyRow?.signing_key) {
      const computed = createHmac("sha256", keyRow.signing_key)
        .update(rawBody)
        .digest("base64");
      if (computed === signature) return true;
    }
  }

  // No matching key found — reject
  return false;
}

export async function POST(request: NextRequest) {
  const receivedAt = new Date().toISOString();
  const rawBody = await request.text();
  let payload: ReadAIWebhookPayload;

  try {
    payload = JSON.parse(rawBody) as ReadAIWebhookPayload;
  } catch {
    await logWebhookEvent("parse_error", null, null, "Invalid JSON", receivedAt);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sessionId = payload.session_id ?? null;
  const ownerEmail = payload.owner?.email ?? null;

  // Verify signature if present
  const signature = request.headers.get("X-Read-Signature");
  let signatureStatus: "valid" | "invalid" | "missing" = "missing";
  if (signature) {
    const isValid = await verifySignature(signature, rawBody, ownerEmail);
    signatureStatus = isValid ? "valid" : "invalid";
    if (!isValid) {
      console.warn("Read.ai signature verification failed for owner:", ownerEmail ?? "unknown");
    }
  }

  // Process synchronously — Vercel serverless kills async work after response
  try {
    await processReadAIWebhook(payload);
    await logWebhookEvent("success", sessionId, ownerEmail, null, receivedAt, {
      title: payload.title,
      signature_status: signatureStatus,
      participant_count: payload.participants?.length ?? 0,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    console.error("Read.ai webhook processing error:", err);
    await logWebhookEvent("error", sessionId, ownerEmail, errMsg, receivedAt, {
      title: payload.title,
      signature_status: signatureStatus,
    });
  }

  return NextResponse.json({ ok: true });
}

/** Log webhook events to integration_logs for the admin debug page */
async function logWebhookEvent(
  status: string,
  sessionId: string | null,
  ownerEmail: string | null,
  errorMessage: string | null,
  receivedAt: string,
  metadata?: Record<string, unknown>,
) {
  try {
    const supabase = createServerClient();
    await supabase.from("integration_logs").insert({
      integration_name: "read_ai",
      event_type: "webhook_received",
      status,
      payload_summary: metadata?.title ? `${metadata.title}` : sessionId ?? "unknown",
      error_message: errorMessage,
      metadata: { session_id: sessionId, owner_email: ownerEmail, received_at: receivedAt, ...metadata },
    });
  } catch {
    // Don't let logging failures break the webhook
  }
}

async function processReadAIWebhook(
  payload: ReadAIWebhookPayload
): Promise<void> {
  const supabase = createServerClient();
  const sessionId = payload.session_id;

  // Deduplicate
  const { data: existing } = await supabase
    .from("read_ai_sessions")
    .select("session_id, processing_status")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (existing?.processing_status === "complete") return;

  // Log incoming session
  await supabase.from("read_ai_sessions").upsert(
    {
      session_id: sessionId,
      title: payload.title ?? null,
      start_time: payload.start_time ?? null,
      end_time: payload.end_time ?? null,
      platform: payload.platform ?? null,
      owner_email: payload.owner?.email ?? null,
      participant_emails: payload.participants
        ?.map((p) => p.email)
        .filter(Boolean) as string[] ?? [],
      raw_payload: payload as unknown as Record<string, unknown>,
      processing_status: "processing",
    },
    { onConflict: "session_id" }
  );

  let classified: ClassifiedCall | null = null;

  try {
    // Classify
    classified = await classifyCall(payload);

    await supabase
      .from("read_ai_sessions")
      .update({
        call_type: classified.call_type,
        classified_at: new Date().toISOString(),
      })
      .eq("session_id", sessionId);

    // Route to processor
    switch (classified.call_type) {
      case "prospect":
        await processProspectCall(payload, classified);
        break;
      case "coaching":
        await processCoachingCall(payload, classified);
        break;
      case "group":
        await processGroupCall(payload, classified);
        break;
      case "internal":
        await supabase
          .from("read_ai_sessions")
          .update({ processing_status: "skipped" })
          .eq("session_id", sessionId);
        break;
      case "unknown":
        await supabase
          .from("read_ai_sessions")
          .update({
            processing_status: "failed",
            error_message: classified.classification_reason,
          })
          .eq("session_id", sessionId);
        break;
    }

    // Mark complete (unless internal/unknown already handled)
    if (classified.call_type !== "internal" && classified.call_type !== "unknown") {
      await supabase
        .from("read_ai_sessions")
        .update({
          processing_status: "complete",
          processed_at: new Date().toISOString(),
        })
        .eq("session_id", sessionId);
    }
  } catch (err) {
    await supabase
      .from("read_ai_sessions")
      .update({
        processing_status: "failed",
        error_message: err instanceof Error ? err.message : "Unknown error",
      })
      .eq("session_id", sessionId);
  }

}
