export const dynamic = "force-dynamic";

/**
 * GET /api/cron/sync-ghl-calendar
 *
 * Polls GHL calendar events, finds ones with meeting links,
 * and upserts into the calls table. Idempotent — safe to re-run.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getAllAppointments } from "@/lib/ghl/client";
import { classifyCallType } from "@/lib/calls/classify-type";
import {
  resolveCallParticipants,
  createSupabaseResolverDb,
  type ParticipantSignal,
} from "@/lib/calls/resolve-participants";
import { upsertCallJunctions } from "@/lib/calls/processors/upsert-call-junctions";

// Sub-task slug mapping — only populated for prospect-sequence call types.
const CALL_TYPE_TO_SUB_TASK: Record<string, string> = {
  intro_call: "intro-call",
  matt_call: "matt-call",
  sam_call: "sam-call",
  mark_call: "mark-call",
  matt_final_call: "matt-final-call",
};

export async function GET(request: NextRequest) {
  // Optionally protect with CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const supabase = createServerClient();

    // Date range: last 14 days to next 7 days
    const now = new Date();
    const startTime = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const endTime = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const events = await getAllAppointments(startTime, endTime).catch(() => []);

    // Pre-fetch lookup data
    const { data: callTypes } = await supabase.from("call_types").select("id, slug");
    const slugToCallTypeId = new Map((callTypes ?? []).map((ct) => [ct.slug, ct.id]));

    const { data: users } = await supabase
      .from("users")
      .select("id, email, ghl_user_id")
      .not("ghl_user_id", "is", null);
    const userMap = new Map((users ?? []).map((u) => [u.ghl_user_id, u.id]));
    const userEmailMap = new Map((users ?? []).map((u) => [u.ghl_user_id, u.email as string | null]));

    // Sub-task slugs matching call types
    const { data: subTasks } = await supabase.from("pipeline_sub_tasks").select("id, slug");
    const subTaskSlugMap = new Map((subTasks ?? []).map((st) => [st.slug, st.id]));

    const resolverDb = createSupabaseResolverDb(supabase);

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let callTypePreserved = 0;

    for (const event of events) {
      const ghlEventId = event.id;
      if (!ghlEventId) { skipped++; continue; }

      // Build participant signals from what GHL gives us.
      const ghlContactId = event.contactId;
      const signals: ParticipantSignal[] = [];

      // Host — resolver will recognize as NAH team.
      const assignedUserId = (event as unknown as Record<string, unknown>).assignedUserId as string | undefined;
      const hostedByUserId = assignedUserId ? userMap.get(assignedUserId) ?? null : null;
      const hostEmail = assignedUserId ? userEmailMap.get(assignedUserId) ?? null : null;
      if (hostEmail) signals.push({ email: hostEmail });

      // Contact — feed email + phone + name so the resolver can confirm or
      // upgrade the link (e.g., phone rematch if email changed in GHL).
      if (ghlContactId) {
        const { data: contact } = await supabase
          .from("contacts")
          .select("email, phone, first_name, last_name")
          .eq("ghl_contact_id", ghlContactId)
          .maybeSingle();
        if (contact) {
          const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim() || null;
          signals.push({
            email: contact.email ?? null,
            phone: contact.phone ?? null,
            name,
          });
        }
      }

      const match = await resolveCallParticipants(
        { participants: signals, meeting_title: event.title ?? null, source: "ghl_calendar" },
        resolverDb,
      );
      const localContactId = match.contact_id;

      const classification = classifyCallType({
        title: event.title ?? null,
        nah_emails: hostEmail ? [hostEmail] : [],
        is_internal: false,
        has_external_participant: !!localContactId,
        has_territory_owner: !!match.territory_ms_slug,
        source: "ghl_calendar",
      });
      const callTypeId = slugToCallTypeId.get(classification.slug) ?? null;
      const subTaskSlug = CALL_TYPE_TO_SUB_TASK[classification.slug];
      const subTaskId = subTaskSlug ? (subTaskSlugMap.get(subTaskSlug) ?? null) : null;

      // Extract meeting link from event (GHL may include it as meetingLocation or other field)
      const meetingLink = (event as unknown as Record<string, unknown>).meetingLocation as string ??
        (event as unknown as Record<string, unknown>).meetLink as string ??
        null;

      const status = event.status === "cancelled" ? "cancelled"
        : event.status === "no-show" ? "missed"
        : new Date(event.endTime) < now ? "completed"
        : "scheduled";

      const durationSeconds = event.startTime && event.endTime
        ? Math.round((new Date(event.endTime).getTime() - new Date(event.startTime).getTime()) / 1000)
        : null;

      // Source jps directly from the shared resolver — same selection rule
      // used by every other entry point (prefer territory match, then
      // pre-award NULL-territory, then most-recent active).
      const journeyPipelineStateId: string | null = match.journey_pipeline_state_id;

      // Check if exists
      const { data: existing } = await supabase
        .from("calls")
        .select("id, source")
        .eq("ghl_event_id", ghlEventId)
        .maybeSingle();

      if (existing) {
        // Only overwrite classifier/resolver fields when the row was first
        // authored by the cron. Rows sourced from Read.ai or manual entry
        // (and rows with unknown source, pre-Phase-4 migration era) carry
        // higher-signal matches and must not be clobbered by title-regex
        // or GHL-only lookups.
        const canOverwriteMatch = existing.source === "ghl_calendar";
        if (!canOverwriteMatch) {
          console.info(
            `[sync-ghl-calendar] preserving match fields on call ${existing.id} ` +
              `(source=${existing.source ?? "null"}; cron would have set ` +
              `call_type=${classification.slug}, contact_id=${localContactId}, ` +
              `territory=${match.territory_ms_slug})`,
          );
          callTypePreserved++;
        }

        const updatePayload: Record<string, unknown> = {
          sub_task_id: subTaskId,
          scheduled_at: event.startTime,
          started_at: status === "completed" ? event.startTime : null,
          ended_at: status === "completed" ? event.endTime : null,
          duration_seconds: durationSeconds,
          meeting_link: meetingLink,
          hosted_by_user_id: hostedByUserId,
          status,
        };
        if (canOverwriteMatch) {
          updatePayload.call_type_id = callTypeId;
          updatePayload.classification_reason = classification.reason;
          updatePayload.contact_id = localContactId;
          updatePayload.territory_ms_slug = match.territory_ms_slug;
          updatePayload.journey_pipeline_state_id = journeyPipelineStateId;
          updatePayload.match_confidence = match.confidence;
          updatePayload.match_reason = match.reason;
        }

        await supabase.from("calls").update(updatePayload).eq("id", existing.id);
        if (canOverwriteMatch) {
          await upsertCallJunctions(supabase, existing.id, match);
        }
        updated++;
      } else {
        // Insert
        const { data: inserted } = await supabase
          .from("calls")
          .insert({
            ghl_event_id: ghlEventId,
            contact_id: localContactId,
            territory_ms_slug: match.territory_ms_slug,
            call_type_id: callTypeId,
            classification_reason: classification.reason,
            match_confidence: match.confidence,
            match_reason: match.reason,
            sub_task_id: subTaskId,
            journey_pipeline_state_id: journeyPipelineStateId,
            source: "ghl_calendar",
            scheduled_at: event.startTime,
            started_at: status === "completed" ? event.startTime : null,
            ended_at: status === "completed" ? event.endTime : null,
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
        created++;
      }
    }

    return NextResponse.json({
      success: true,
      totalEvents: events.length,
      created,
      updated,
      skipped,
      callTypePreserved,
    });
  } catch (err) {
    console.error("GHL calendar sync error:", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
