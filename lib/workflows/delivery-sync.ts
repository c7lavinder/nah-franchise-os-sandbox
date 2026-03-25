/**
 * Workflow Delivery Sync — polls GHL for message delivery data.
 *
 * Instead of relying on GHL webhooks (which require manual dashboard setup),
 * this service polls GHL conversation messages for contacts in active workflows.
 * It matches outbound messages against step logs and checks for inbound responses.
 *
 * Uses the same GHL API calls as the inbox feature — PIT key or OAuth.
 * Per ghl-masterclass: GET /conversations/search + GET /conversations/:id/messages
 */

import { createServerClient } from "@/lib/supabase/server";
import * as ghl from "@/lib/ghl";

/** Result of a delivery sync run */
export interface DeliverySyncResult {
  enrollmentsChecked: number;
  messagesDelivered: number;
  responsesDetected: number;
  errors: string[];
}

/**
 * Poll GHL for delivery data on recent workflow step logs.
 * Finds step logs that were executed but not yet confirmed as delivered,
 * then checks GHL conversation history to verify delivery and detect responses.
 */
export async function syncDeliveryData(): Promise<DeliverySyncResult> {
  const supabase = createServerClient();
  const result: DeliverySyncResult = {
    enrollmentsChecked: 0,
    messagesDelivered: 0,
    responsesDetected: 0,
    errors: [],
  };

  // Find recent step logs that need delivery verification
  // Only check logs from the last 7 days that haven't been marked delivered
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: pendingLogs, error: logErr } = await supabase
    .from("workflow_step_logs")
    .select("id, enrollment_id, ghl_contact_id, step_type, content_sent, executed_at, delivered, responded, ghl_message_id")
    .in("step_type", ["sms", "email"])
    .not("executed_at", "is", null)
    .gte("executed_at", sevenDaysAgo.toISOString())
    .order("executed_at", { ascending: false })
    .limit(100);

  if (logErr || !pendingLogs || pendingLogs.length === 0) {
    return result;
  }

  // Group logs by contact to minimize GHL API calls
  const contactLogs = new Map<string, typeof pendingLogs>();
  for (const log of pendingLogs) {
    const contactId = log.ghl_contact_id;
    if (!contactLogs.has(contactId)) contactLogs.set(contactId, []);
    contactLogs.get(contactId)!.push(log);
  }

  for (const [contactId, logs] of contactLogs) {
    try {
      result.enrollmentsChecked++;

      // Fetch conversation history from GHL (same as inbox does)
      const messages = await ghl.getContactHistory(contactId);

      if (!messages || messages.length === 0) continue;

      for (const log of logs) {
        // Skip already fully synced logs
        if (log.delivered && log.responded) continue;

        // Check for delivery — find matching outbound message in GHL
        if (!log.delivered) {
          const matchedOutbound = messages.find((msg) => {
            // Match by GHL message ID if we have it
            if (log.ghl_message_id && msg.id === log.ghl_message_id) return true;

            // Otherwise match by direction + timing + type
            if (msg.direction !== "outbound") return false;

            const msgType = typeof msg.type === "string" ? msg.type.toUpperCase() : "";
            const logType = log.step_type.toUpperCase();
            if (msgType !== logType && msgType !== "") return false;

            // Match by timing — message sent within 5 minutes of step execution
            if (log.executed_at && msg.dateAdded) {
              const execTime = new Date(log.executed_at).getTime();
              const msgTime = new Date(msg.dateAdded).getTime();
              if (Math.abs(execTime - msgTime) < 5 * 60 * 1000) return true;
            }

            return false;
          });

          if (matchedOutbound) {
            await supabase
              .from("workflow_step_logs")
              .update({
                delivered: true,
                ghl_message_id: matchedOutbound.id,
                delivery_data: {
                  deliveredAt: matchedOutbound.dateAdded,
                  source: "polling",
                },
              })
              .eq("id", log.id);
            result.messagesDelivered++;
          }
        }

        // Check for response — find inbound message AFTER the step was executed
        if (!log.responded && log.executed_at) {
          const execTime = new Date(log.executed_at).getTime();
          const hasResponse = messages.some((msg) => {
            if (msg.direction !== "inbound") return false;
            const msgTime = new Date(msg.dateAdded).getTime();
            // Inbound message came after the step was executed
            return msgTime > execTime;
          });

          if (hasResponse) {
            await supabase
              .from("workflow_step_logs")
              .update({ responded: true })
              .eq("id", log.id);
            result.responsesDetected++;
          }
        }
      }

      // Rate limit: 200ms between contacts per ghl-masterclass (100/10s burst)
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      result.errors.push(`Contact ${contactId}: ${msg}`);
    }
  }

  return result;
}

/**
 * Poll GHL for pipeline stage changes and auto-enroll contacts in workflows.
 * Replaces webhook-based auto-enrollment.
 * Checks all live workflows with stage_entry triggers against current pipeline data.
 */
export async function syncStageEnrollments(): Promise<{ enrolled: number; errors: string[] }> {
  const supabase = createServerClient();
  const result = { enrolled: 0, errors: [] as string[] };

  // Get all live workflows with stage_entry triggers
  const { data: workflows } = await supabase
    .from("workflows")
    .select("id, name, trigger_type, current_version_id")
    .eq("status", "live")
    .like("trigger_type", "stage_entry:%");

  if (!workflows || workflows.length === 0) return result;

  // Get pipeline stages from GHL
  const pipelines = await ghl.getPipelines();
  if (pipelines.length === 0) return result;

  const { enrollContact } = await import("@/lib/workflows/enrollment");

  for (const workflow of workflows) {
    if (!workflow.current_version_id) continue;

    // Extract stage name from trigger_type (e.g., "stage_entry:new_lead" → "new_lead")
    const triggerStage = workflow.trigger_type.replace("stage_entry:", "").replace(/_/g, " ");

    // Find the matching GHL stage
    for (const pipeline of pipelines) {
      const matchingStage = pipeline.stages.find(
        (s) => s.name.toLowerCase().includes(triggerStage.toLowerCase())
      );
      if (!matchingStage) continue;

      try {
        // Get opportunities currently in this stage
        const opportunities = await ghl.searchOpportunities({
          pipelineId: pipeline.id,
          stageId: matchingStage.id,
          status: "open",
          limit: 50,
        });

        for (const opp of opportunities) {
          if (!opp.contactId) continue;

          // Try to enroll — will skip if already enrolled (dedup built into enrollContact)
          const enrollResult = await enrollContact({
            workflowId: workflow.id,
            workflowVersionId: workflow.current_version_id,
            ghlContactId: opp.contactId,
            contactName: opp.name ?? undefined,
          });

          if (enrollResult.success) {
            result.enrolled++;
            console.log(`[delivery-sync] Auto-enrolled ${opp.contactId} in "${workflow.name}"`);
          }
        }

        // Rate limit between pipeline queries
        await new Promise((r) => setTimeout(r, 200));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown";
        result.errors.push(`Workflow "${workflow.name}": ${msg}`);
      }
    }
  }

  return result;
}
