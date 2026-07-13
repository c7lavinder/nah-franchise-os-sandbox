export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/ghl
 *
 * Receives webhook events from GoHighLevel.
 * Handles: messages (inbound/outbound) and opportunity stage changes.
 * ContactCreate events go to /api/webhooks/ghl/contacts instead.
 *
 * GHL webhook events include a type field that identifies the event.
 * See: ghl-masterclass/webhooks/webhook-index.md
 *
 * Setup: In GHL Marketplace App > Advanced > Webhooks, enable events.
 * Auth: Verified via X-GHL-Signature (Ed25519) sent by GHL on every webhook.
 * Subscribe to: InboundMessage, OutboundMessage, TaskUpdate,
 *               AppointmentCreate, AppointmentUpdate, AppointmentDelete
 */

import { NextRequest, NextResponse } from "next/server";
import { requireGhlSignature } from "@/lib/auth/ghl-webhook-verify";
import { createServerClient } from "@/lib/supabase/server";
import { matchWorkflowTriggers } from "@/lib/workflows/trigger-matcher";

/** GHL webhook payload — shape varies by event type */
interface GHLWebhookPayload {
  type?: string;
  event?: string;
  webhookId?: string;
  contactId?: string;
  contact_id?: string;
  locationId?: string;
  location_id?: string;
  // Message events
  body?: string;
  messageId?: string;
  messageType?: string;
  direction?: string;
  conversationId?: string;
  // Opportunity events
  opportunityId?: string;
  pipelineId?: string;
  pipelineStageId?: string;
  previousStageId?: string;
  status?: string;
  dateAdded?: string;
  // Appointment events — data is nested, not at root
  appointment?: {
    id?: string;
    title?: string;
    calendarId?: string;
    contactId?: string;
    groupId?: string | null;
    assignedUserId?: string;
    appointmentStatus?: string;
    address?: string;
    source?: string;
    notes?: string;
    startTime?: string;
    endTime?: string;
    dateAdded?: string;
    dateUpdated?: string;
  };
  // Catch-all for unknown fields
  [key: string]: unknown;
}

/** Normalize the event type from various GHL payload formats */
function getEventType(payload: GHLWebhookPayload): string {
  // GHL sends type in different fields depending on the webhook version
  return (
    payload.type ??
    payload.event ??
    ((payload as Record<string, unknown>)["eventType"] as string) ??
    "unknown"
  ).toLowerCase();
}

/** Get the contact ID from various payload formats */
function getContactId(payload: GHLWebhookPayload): string | null {
  // Appointment events carry the contact id nested under `appointment`
  return payload.contactId ?? payload.contact_id ?? payload.appointment?.contactId ?? null;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const sigError = requireGhlSignature(rawBody, request.headers);
  if (sigError) return sigError;
  try {
    const payload = JSON.parse(rawBody) as GHLWebhookPayload;
    const eventType = getEventType(payload);
    const contactId = getContactId(payload);

    const supabase = createServerClient();

    // Dedup check — per ghl-masterclass, webhooks can fire multiple times
    if (payload.webhookId) {
      const { data: existing } = await supabase
        .from("app_settings")
        .select("setting_key")
        .eq("setting_key", `webhook_dedup:${payload.webhookId}`)
        .single();

      if (existing) {
        return NextResponse.json({ received: true, dedup: true });
      }

      // Mark as processed — ignore duplicate insert race
      try {
        await supabase.from("app_settings").insert({
          setting_key: `webhook_dedup:${payload.webhookId}`,
          setting_value: { processedAt: new Date().toISOString() },
          description: "Webhook dedup marker",
        });
      } catch {
        /* ignore duplicate */
      }
    }

    switch (true) {
      // ─── ContactCreate handled by /api/webhooks/ghl/contacts ───
      // That handler does: sync → pipeline state → speed-to-lead alert → action log.
      // Configure GHL to send ContactCreate events to /api/webhooks/ghl/contacts.

      // ─── Outbound Message Delivery ───
      // Per ghl-masterclass: OutboundMessage webhook confirms SMS/Email delivery
      case eventType.includes("outboundmessage"):
      case eventType.includes("outbound"): {
        if (!payload.messageId) break;

        // Find matching workflow step log by ghl_message_id
        const { data: stepLog } = await supabase
          .from("workflow_step_logs")
          .select("id")
          .eq("ghl_message_id", payload.messageId)
          .limit(1)
          .single();

        if (stepLog) {
          await supabase
            .from("workflow_step_logs")
            .update({
              delivered: payload.status === "delivered",
              delivery_data: {
                status: payload.status,
                messageType: payload.messageType,
                timestamp: payload.dateAdded ?? new Date().toISOString(),
              },
            })
            .eq("id", stepLog.id);
        }

        break;
      }

      // ─── Inbound Message Received ───
      case eventType.includes("message") && eventType.includes("inbound"):
      case eventType.includes("inboundmessage"): {
        if (!contactId) break;

        // Mark the most recent workflow step log as "responded"
        // Per workflows.md: SMS response rate is a key health scoring metric
        const { data: recentLog } = await supabase
          .from("workflow_step_logs")
          .select("id")
          .eq("ghl_contact_id", contactId)
          .eq("responded", false)
          .eq("delivered", true)
          .order("executed_at", { ascending: false })
          .limit(1)
          .single();

        if (recentLog) {
          await supabase.from("workflow_step_logs").update({ responded: true }).eq("id", recentLog.id);
        }

        // Log inbound message event
        await supabase.from("scout_action_logs").insert({
          action_type: "inbound_message",
          action_status: "executed",
          ghl_contact_id: contactId,
          draft_content: {
            event: "inbound_message",
            messageType: payload.messageType,
            direction: payload.direction,
            bodyPreview: payload.body?.slice(0, 100),
          },
          final_content: { event: "inbound_message" },
          executed_at: new Date().toISOString(),
        });

        break;
      }

      // ─── Opportunity Updated (includes stage changes) ───
      // GHL sends "OpportunityUpdate" for ALL opportunity changes including stage moves.
      case eventType.includes("opportunity"): {
        const oppContactId = contactId ?? null;

        // Log the stage change
        await supabase.from("scout_action_logs").insert({
          action_type: "stage_move",
          action_status: "executed",
          ghl_contact_id: oppContactId,
          draft_content: {
            event: "opportunity_stage_update",
            opportunityId: payload.opportunityId,
            pipelineId: payload.pipelineId,
            fromStageId: payload.previousStageId,
            toStageId: payload.pipelineStageId,
            status: payload.status,
            source: "ghl_webhook",
          },
          final_content: {
            event: "opportunity_stage_update",
            source: "ghl_webhook",
          },
          executed_at: new Date().toISOString(),
        });

        break;
      }

      // ─── Task Events (Create, Complete, Delete) ───
      // GHL sends TaskCreate, TaskComplete, TaskDelete (not TaskUpdate)
      case eventType.includes("task"): {
        const p = payload as Record<string, unknown>;
        const taskId = (p.taskId as string | undefined) ?? (p.id as string | undefined);
        if (taskId && contactId) {
          const { handleGhlTaskUpdate } = await import("@/lib/tasks/sync");
          await handleGhlTaskUpdate({
            id: taskId,
            contactId,
            title: p.title as string | undefined,
            body: p.body as string | undefined,
            completed: p.completed as boolean | undefined,
            dueDate: p.dueDate as string | undefined,
            assignedTo: p.assignedTo as string | undefined,
          });
        }
        break;
      }

      // ─── Appointment Events (Create, Update, Delete) ───
      // Payload is nested under `appointment`; see ghl-masterclass/webhooks/appointment-events.md.
      // Deletes are soft (deleted_at) so the MasterSuite push mirror stays consistent.
      case eventType.includes("appointment"): {
        const appt = payload.appointment;
        if (!appt?.id) break;

        if (eventType.includes("delete")) {
          await supabase
            .from("ghl_appointments")
            .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq("ghl_appointment_id", appt.id);
          break;
        }

        await supabase.from("ghl_appointments").upsert(
          {
            ghl_appointment_id: appt.id,
            calendar_id: appt.calendarId ?? null,
            ghl_contact_id: appt.contactId ?? null,
            title: appt.title ?? null,
            assigned_user_id: appt.assignedUserId ?? null,
            appointment_status: appt.appointmentStatus ?? null,
            address: appt.address ?? null,
            source: appt.source ?? null,
            notes: appt.notes ?? null,
            location_id: payload.locationId ?? null,
            group_id: appt.groupId ?? null,
            start_time: appt.startTime ?? null,
            end_time: appt.endTime ?? null,
            date_added: appt.dateAdded ?? null,
            date_updated: appt.dateUpdated ?? null,
            // Un-cancelled/re-created appointments come back to life
            deleted_at: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "ghl_appointment_id" }
        );
        break;
      }

      // ─── Unknown Event ───
      default: {
        // Log unknown events for debugging
        console.log(`GHL webhook: unhandled event type "${eventType}"`);
        break;
      }
    }

    // Flexible workflow trigger matching — evaluate all live workflows' trigger_config
    // against this event and auto-enroll contacts that match
    if (contactId) {
      const triggerResult = await matchWorkflowTriggers(eventType, contactId, payload as Record<string, unknown>);
      if (triggerResult.enrolled > 0) {
        console.log(`[ghl-webhook] Trigger matcher: ${triggerResult.enrolled} enrollments from event "${eventType}"`);
      }
    }

    // Always return 200 to GHL — even if we didn't process the event
    return NextResponse.json({ received: true, event: eventType });
  } catch (err) {
    // Still return 200 to prevent GHL from retrying
    console.error("Webhook handler error:", err instanceof Error ? err.message : "Unknown error");
    return NextResponse.json({ received: true, error: "handler_error" });
  }
}
