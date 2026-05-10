export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/ghl-calendar
 *
 * Receives webhook events from GHL Calendar (create, update, cancel, no-show).
 * Upserts to calls table and logs to integration_logs.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireGhlSignature } from "@/lib/auth/ghl-webhook-verify";
import { createServerClient } from "@/lib/supabase/server";
import { classifyCallType } from "@/lib/calls/classify-type";
import {
  resolveCallParticipants,
  createSupabaseResolverDb,
  type ParticipantSignal,
} from "@/lib/calls/resolve-participants";
import { upsertCallJunctions } from "@/lib/calls/processors/upsert-call-junctions";

interface GHLCalendarWebhookPayload {
  id?: string;
  appointmentId?: string;
  contactId?: string;
  calendarId?: string;
  title?: string;
  startTime?: string;
  endTime?: string;
  status?: string;
  appointmentStatus?: string;
  assignedUserId?: string;
  meetingLocation?: string;
  meetLink?: string;
  [key: string]: unknown;
}

const CALL_TYPE_TO_SUB_TASK: Record<string, string> = {
  intro_call: "intro-call",
  matt_call: "matt-call",
  sam_call: "sam-call",
  mark_call: "mark-call",
  matt_final_call: "matt-final-call",
};

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const sigError = requireGhlSignature(rawBody, request.headers);
  if (sigError) return sigError;
  const body = JSON.parse(rawBody) as GHLCalendarWebhookPayload;
  const supabase = createServerClient();

  // Process async — return 200 immediately so GHL doesn't retry
  processWebhook(body, supabase).catch(console.error);
  return NextResponse.json({ received: true });
}

async function processWebhook(body: GHLCalendarWebhookPayload, supabase: ReturnType<typeof createServerClient>) {
  const ghlEventId = body.appointmentId ?? body.id;
  if (!ghlEventId) {
    console.warn("[ghl-calendar-webhook] No appointmentId in payload");
    return;
  }

  try {
    const ghlContactId = body.contactId;
    const now = new Date();

    // Resolve contact UUID
    let localContactId: string | null = null;
    const signals: ParticipantSignal[] = [];

    // Look up assigned user
    const { data: users } = await supabase
      .from("users")
      .select("id, email, ghl_user_id")
      .not("ghl_user_id", "is", null);
    const userMap = new Map((users ?? []).map((u: { ghl_user_id: string; id: string }) => [u.ghl_user_id, u.id]));
    const userEmailMap = new Map(
      (users ?? []).map((u: { ghl_user_id: string; email: string | null }) => [u.ghl_user_id, u.email])
    );

    const hostedByUserId = body.assignedUserId ? (userMap.get(body.assignedUserId) ?? null) : null;
    const hostEmail = body.assignedUserId ? (userEmailMap.get(body.assignedUserId) ?? null) : null;
    if (hostEmail) signals.push({ email: hostEmail });

    if (ghlContactId) {
      const { data: contact } = await supabase
        .from("contacts")
        .select("id, email, phone, first_name, last_name")
        .eq("ghl_contact_id", ghlContactId)
        .maybeSingle();
      if (contact) {
        localContactId = contact.id;
        const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim() || null;
        signals.push({
          email: contact.email ?? null,
          phone: contact.phone ?? null,
          name,
        });
      }
    }

    // Classify call type
    const resolverDb = createSupabaseResolverDb(supabase);
    const match = await resolveCallParticipants(
      { participants: signals, meeting_title: body.title ?? null, source: "ghl_calendar" },
      resolverDb
    );
    if (match.contact_id) localContactId = match.contact_id;

    const { data: callTypes } = await supabase.from("call_types").select("id, slug");
    const slugToCallTypeId = new Map((callTypes ?? []).map((ct: { slug: string; id: string }) => [ct.slug, ct.id]));

    const classification = classifyCallType({
      title: body.title ?? null,
      nah_emails: hostEmail ? [hostEmail] : [],
      is_internal: false,
      has_external_participant: !!localContactId,
      has_territory_owner: !!match.TerritorySlug,
      source: "ghl_calendar",
    });
    const callTypeId = slugToCallTypeId.get(classification.slug) ?? null;

    const { data: subTasks } = await supabase.from("pipeline_sub_tasks").select("id, slug");
    const subTaskSlugMap = new Map((subTasks ?? []).map((st: { slug: string; id: string }) => [st.slug, st.id]));
    const subTaskSlug = CALL_TYPE_TO_SUB_TASK[classification.slug];
    const subTaskId = subTaskSlug ? (subTaskSlugMap.get(subTaskSlug) ?? null) : null;

    const meetingLink = body.meetingLocation ?? body.meetLink ?? null;

    // Determine status from webhook payload
    const apptStatus = body.appointmentStatus ?? body.status;
    const status =
      apptStatus === "cancelled"
        ? "cancelled"
        : apptStatus === "no_show" || apptStatus === "noshow"
          ? "missed"
          : body.endTime && new Date(body.endTime) < now
            ? "completed"
            : "scheduled";

    const durationSeconds =
      body.startTime && body.endTime
        ? Math.round((new Date(body.endTime).getTime() - new Date(body.startTime).getTime()) / 1000)
        : null;

    const journeyPipelineStateId: string | null = match.journey_pipeline_state_id;

    // Upsert to calls table
    const { data: existing } = await supabase
      .from("calls")
      .select("id, source")
      .eq("ghl_event_id", ghlEventId)
      .maybeSingle();

    if (existing) {
      // Preserve match fields if row was created by a higher-signal source
      const canOverwriteMatch = existing.source === "ghl_calendar";

      const updatePayload: Record<string, unknown> = {
        sub_task_id: subTaskId,
        scheduled_at: body.startTime ?? undefined,
        started_at: status === "completed" ? body.startTime : undefined,
        ended_at: status === "completed" ? body.endTime : undefined,
        duration_seconds: durationSeconds,
        meeting_link: meetingLink,
        hosted_by_user_id: hostedByUserId,
        status,
      };
      if (canOverwriteMatch) {
        updatePayload.call_type_id = callTypeId;
        updatePayload.classification_reason = classification.reason;
        updatePayload.contact_id = localContactId;
        updatePayload.TerritorySlug = match.TerritorySlug;
        updatePayload.journey_pipeline_state_id = journeyPipelineStateId;
        updatePayload.match_confidence = match.confidence;
        updatePayload.match_reason = match.reason;
      }

      await supabase.from("calls").update(updatePayload).eq("id", existing.id);
      if (canOverwriteMatch) {
        await upsertCallJunctions(supabase, existing.id, match);
      }
    } else {
      const { data: inserted } = await supabase
        .from("calls")
        .insert({
          ghl_event_id: ghlEventId,
          contact_id: localContactId,
          TerritorySlug: match.TerritorySlug,
          call_type_id: callTypeId,
          classification_reason: classification.reason,
          match_confidence: match.confidence,
          match_reason: match.reason,
          sub_task_id: subTaskId,
          journey_pipeline_state_id: journeyPipelineStateId,
          source: "ghl_calendar",
          scheduled_at: body.startTime ?? null,
          started_at: status === "completed" ? body.startTime : null,
          ended_at: status === "completed" ? body.endTime : null,
          duration_seconds: durationSeconds,
          meeting_link: meetingLink,
          hosted_by_user_id: hostedByUserId,
          status,
        })
        .select("id")
        .single();
      if (inserted?.id) {
        await upsertCallJunctions(supabase, inserted.id, match);
      }
    }

    // Log success
    await supabase.from("integration_logs").insert({
      integration_name: "ghl-calendar",
      event_type: apptStatus === "cancelled" ? "appointment_cancelled" : "appointment_synced",
      status: "success",
      payload_summary: `Appointment ${ghlEventId} synced — status: ${status}, contact: ${localContactId ?? "unmatched"}`,
      metadata: { ghlEventId, contactId: ghlContactId, status, callType: classification.slug },
    });
  } catch (err) {
    console.error("[ghl-calendar-webhook] Processing error:", err);
    await supabase.from("integration_logs").insert({
      integration_name: "ghl-calendar",
      event_type: "error",
      status: "failed",
      error_message: err instanceof Error ? err.message : String(err),
      metadata: { ghlEventId, body },
    });
  }
}
