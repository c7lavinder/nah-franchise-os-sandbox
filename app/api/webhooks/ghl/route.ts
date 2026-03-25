/**
 * POST /api/webhooks/ghl
 *
 * Receives webhook events from GoHighLevel.
 * Handles: new contacts, incoming messages, opportunity stage changes.
 *
 * GHL webhook events include a type field that identifies the event.
 * See: ghl-masterclass/webhooks/webhook-index.md
 *
 * Setup: In GHL Settings > Webhooks, add this URL:
 *   https://your-domain.com/api/webhooks/ghl
 * Subscribe to: ContactCreate, InboundMessage, OpportunityStageUpdate
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/** GHL webhook payload — shape varies by event type */
interface GHLWebhookPayload {
  type?: string;
  event?: string;
  contactId?: string;
  contact_id?: string;
  locationId?: string;
  location_id?: string;
  // Contact events
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  source?: string;
  // Message events
  body?: string;
  messageType?: string;
  direction?: string;
  conversationId?: string;
  // Opportunity events
  opportunityId?: string;
  pipelineId?: string;
  pipelineStageId?: string;
  previousStageId?: string;
  status?: string;
  // Catch-all for unknown fields
  [key: string]: unknown;
}

/** Normalize the event type from various GHL payload formats */
function getEventType(payload: GHLWebhookPayload): string {
  // GHL sends type in different fields depending on the webhook version
  return (
    payload.type ??
    payload.event ??
    (payload as Record<string, unknown>)["eventType"] as string ??
    "unknown"
  ).toLowerCase();
}

/** Get the contact ID from various payload formats */
function getContactId(payload: GHLWebhookPayload): string | null {
  return payload.contactId ?? payload.contact_id ?? null;
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as GHLWebhookPayload;
    const eventType = getEventType(payload);
    const contactId = getContactId(payload);

    const supabase = createServerClient();

    switch (true) {
      // ─── New Contact Created ───
      case eventType.includes("contact") && eventType.includes("create"): {
        if (!contactId) break;

        const contactName = [payload.firstName, payload.lastName]
          .filter(Boolean)
          .join(" ")
          .trim() || "Unknown";

        // Create a speed-to-lead alert — Chad needs to contact within 5 minutes
        await supabase.from("inactivity_alerts").insert({
          alert_type: "speed_to_lead",
          severity: "critical",
          ghl_contact_id: contactId,
          message: `New lead: ${contactName}${payload.source ? ` (${payload.source})` : ""}. Contact within 5 minutes.`,
          details: {
            contactName,
            source: payload.source ?? "Unknown",
            email: payload.email,
            phone: payload.phone,
            receivedAt: new Date().toISOString(),
          },
        });

        // Log the event in scout_action_logs
        await supabase.from("scout_action_logs").insert({
          action_type: "webhook_event",
          action_status: "executed",
          ghl_contact_id: contactId,
          draft_content: { event: "contact_create", payload: { contactName, source: payload.source } },
          final_content: { event: "contact_create" },
          executed_at: new Date().toISOString(),
        });

        break;
      }

      // ─── Inbound Message Received ───
      case eventType.includes("message") && eventType.includes("inbound"):
      case eventType.includes("inboundmessage"): {
        if (!contactId) break;

        // Update Last Touch Date and Channel on the contact
        const { data: mappings } = await supabase
          .from("ghl_custom_fields")
          .select("field_name, ghl_field_id")
          .eq("entity_type", "contact")
          .in("field_name", ["Last Touch Date", "Last Touch Channel"]);

        if (mappings && mappings.length > 0) {
          // We don't call GHL updateContact here to avoid circular webhooks.
          // Instead, log the touch for the next time the contact is read.
          // The touch will be picked up by the scoring engine.
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
    console.error("Webhook handler error:", err);
    return NextResponse.json({ received: true, error: "handler_error" });
  }
}
