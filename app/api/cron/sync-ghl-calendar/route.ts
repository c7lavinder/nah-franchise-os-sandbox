export const dynamic = "force-dynamic";

/**
 * GET /api/cron/sync-ghl-calendar
 *
 * Polls GHL calendar events, finds ones with meeting links,
 * and upserts into the calls table. Idempotent — safe to re-run.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getAppointments } from "@/lib/ghl/client";
import { classifyCallType } from "@/lib/calls/classify-type";

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

    const events = await getAppointments(startTime, endTime).catch(() => []);

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

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let callTypePreserved = 0;

    for (const event of events) {
      const ghlEventId = event.id;
      if (!ghlEventId) { skipped++; continue; }

      // Resolve contact
      const ghlContactId = event.contactId;
      let localContactId: string | null = null;
      let contactGhlId: string | null = null;
      if (ghlContactId) {
        const { data: contact } = await supabase
          .from("contacts")
          .select("id, ghl_contact_id")
          .eq("ghl_contact_id", ghlContactId)
          .maybeSingle();
        localContactId = contact?.id ?? null;
        contactGhlId = contact?.ghl_contact_id ?? null;
      }

      // Resolve hosted_by from GHL assigned user
      const assignedUserId = (event as unknown as Record<string, unknown>).assignedUserId as string | undefined;
      const hostedByUserId = assignedUserId ? userMap.get(assignedUserId) ?? null : null;
      const hostEmail = assignedUserId ? userEmailMap.get(assignedUserId) ?? null : null;

      // Territory-owner signal: is the resolved contact a current franchisee?
      let hasTerritoryOwner = false;
      if (contactGhlId) {
        const { data: owner } = await supabase
          .from("territory_owners")
          .select("ms_slug")
          .eq("ghl_contact_id", contactGhlId)
          .is("end_date", null)
          .maybeSingle();
        hasTerritoryOwner = !!owner;
      }

      const classification = classifyCallType({
        title: event.title ?? null,
        nah_emails: hostEmail ? [hostEmail] : [],
        is_internal: false,
        has_external_participant: !!localContactId,
        has_territory_owner: hasTerritoryOwner,
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

      // Find pipeline state for auto-log
      let contactPipelineStateId: string | null = null;
      if (localContactId) {
        const { data: cps } = await supabase
          .from("contact_pipeline_state")
          .select("id")
          .eq("contact_id", localContactId)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();
        contactPipelineStateId = cps?.id ?? null;
      }

      // Check if exists
      const { data: existing } = await supabase
        .from("calls")
        .select("id, source")
        .eq("ghl_event_id", ghlEventId)
        .maybeSingle();

      if (existing) {
        // Only overwrite call_type_id / classification_reason when we own the
        // row. Rows sourced from Read.ai or manual entry carry higher-signal
        // classifications and must not be clobbered by title-regex guesses.
        const canOverwriteCallType = existing.source === "ghl_calendar";
        if (!canOverwriteCallType) {
          console.info(
            `[sync-ghl-calendar] preserving call_type_id on call ${existing.id} ` +
              `(source=${existing.source ?? "null"}, cron would have set slug=${classification.slug})`,
          );
          callTypePreserved++;
        }

        const updatePayload: Record<string, unknown> = {
          contact_id: localContactId,
          sub_task_id: subTaskId,
          contact_pipeline_state_id: contactPipelineStateId,
          scheduled_at: event.startTime,
          started_at: status === "completed" ? event.startTime : null,
          ended_at: status === "completed" ? event.endTime : null,
          duration_seconds: durationSeconds,
          meeting_link: meetingLink,
          hosted_by_user_id: hostedByUserId,
          status,
        };
        if (canOverwriteCallType) {
          updatePayload.call_type_id = callTypeId;
          updatePayload.classification_reason = classification.reason;
        }

        await supabase.from("calls").update(updatePayload).eq("id", existing.id);
        updated++;
      } else {
        // Insert
        await supabase.from("calls").insert({
          ghl_event_id: ghlEventId,
          contact_id: localContactId,
          call_type_id: callTypeId,
          classification_reason: classification.reason,
          sub_task_id: subTaskId,
          contact_pipeline_state_id: contactPipelineStateId,
          source: "ghl_calendar",
          scheduled_at: event.startTime,
          started_at: status === "completed" ? event.startTime : null,
          ended_at: status === "completed" ? event.endTime : null,
          duration_seconds: durationSeconds,
          meeting_link: meetingLink,
          hosted_by_user_id: hostedByUserId,
          status,
        });
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
