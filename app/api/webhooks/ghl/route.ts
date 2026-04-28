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
 * Setup: In GHL Settings > Webhooks, add this URL:
 *   https://your-domain.com/api/webhooks/ghl
 * Subscribe to: InboundMessage, OutboundMessage, OpportunityStageUpdate
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSecret } from "@/lib/auth/webhook-verify";
import { createServerClient } from "@/lib/supabase/server";

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
  return payload.contactId ?? payload.contact_id ?? null;
}

export async function POST(request: NextRequest) {
  const webhookAuthError = verifyWebhookSecret(request);
  if (webhookAuthError) return webhookAuthError;
  try {
    const payload = (await request.json()) as GHLWebhookPayload;
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

      // ─── Opportunity Stage Changed ───
      case eventType.includes("opportunity") && eventType.includes("stage"):
      case eventType.includes("opportunitystage"): {
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

        // Auto-enroll in workflows triggered by this stage
        if (oppContactId && payload.pipelineStageId) {
          const { data: stage } = await supabase
            .from("ghl_pipeline_stages")
            .select("stage_name")
            .eq("stage_id", payload.pipelineStageId)
            .limit(1)
            .single();

          if (stage) {
            const stageName = (stage.stage_name as string).toLowerCase().replace(/\s+/g, "_");
            const triggerKey = `stage_entry:${stageName}`;

            const { data: workflows } = await supabase
              .from("workflows")
              .select("id, current_version_id, name")
              .eq("trigger_type", triggerKey)
              .eq("status", "live");

            if (workflows && workflows.length > 0) {
              const { enrollContact } = await import("@/lib/workflows/enrollment");
              for (const wf of workflows) {
                if (!wf.current_version_id) continue;
                const result = await enrollContact({
                  workflowId: wf.id,
                  workflowVersionId: wf.current_version_id,
                  ghlContactId: oppContactId,
                });
                if (result.success) {
                  console.log(`[ghl-webhook] Auto-enrolled ${oppContactId} in "${wf.name}"`);
                }
              }
            }
          }
        }

        break;
      }

      // ─── Unknown Event ───
      default: {
        // Log unknown events for debugging
        console.log(`GHL webhook: unhandled event type "${eventType}"`);
        break;
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
