/**
 * GHL Action Executor
 *
 * Routes action codes to the correct GHL API call.
 * All 30 actions handled here. Each action validates inputs,
 * calls the GHL client, and returns a structured result.
 */

import * as ghl from "@/lib/ghl/client";
import {
  customerFacingSendsDisabledReason,
  customerFacingSendsEnabled,
  isCustomerFacingGHLActionCode,
} from "@/lib/ghl/action-safety";
import { sendContactSmsViaSignalHouse } from "@/lib/sms/contact-sms";
import { signalHouseEnabled } from "@/lib/sms/signalhouse-client";
import { isSchedulableGhlContactId } from "@/lib/ghl/contact-id";
import type { GHLActionCode } from "@/lib/ghl/permissions";

export interface ActionResult {
  success: boolean;
  actionCode: string;
  data?: unknown;
  error?: string;
}

/**
 * Execute a GHL action by code.
 * Params are pre-validated by the draft queue.
 */
export async function executeGHLAction(
  actionCode: GHLActionCode,
  params: Record<string, unknown>,
  userId: string,
  contactId: string | null
): Promise<ActionResult> {
  try {
    if (isCustomerFacingGHLActionCode(actionCode) && !customerFacingSendsEnabled()) {
      return {
        success: false,
        actionCode,
        error: customerFacingSendsDisabledReason(),
      };
    }

    switch (actionCode) {
      // ============ Communication (C1-C8) ============

      case "C1": {
        // Send SMS
        const targetContactId = String(params.contactId ?? contactId);
        const result = signalHouseEnabled()
          ? await sendContactSmsViaSignalHouse(targetContactId, String(params.message), {
              fromNumber: String(params.fromNumber ?? ""),
            })
          : await ghl.sendMessage({
              type: "SMS",
              contactId: targetContactId,
              message: String(params.message),
            });
        return { success: true, actionCode, data: result };
      }

      case "C2": {
        // Send Email
        const result = await ghl.sendMessage({
          type: "Email",
          contactId: String(params.contactId ?? contactId),
          html: String(params.html ?? params.message),
          subject: String(params.subject ?? ""),
          emailFrom: String(params.emailFrom ?? "team@newagainhouses.com"),
        });
        return { success: true, actionCode, data: result };
      }

      case "C3": {
        // Send Template SMS
        const targetContactId = String(params.contactId ?? contactId);
        const result = signalHouseEnabled()
          ? await sendContactSmsViaSignalHouse(targetContactId, String(params.templateContent), {
              fromNumber: String(params.fromNumber ?? ""),
            })
          : await ghl.sendMessage({
              type: "SMS",
              contactId: targetContactId,
              message: String(params.templateContent),
            });
        return { success: true, actionCode, data: result };
      }

      case "C4": {
        // Send Template Email
        const result = await ghl.sendMessage({
          type: "Email",
          contactId: String(params.contactId ?? contactId),
          html: String(params.templateContent),
          subject: String(params.subject ?? ""),
          emailFrom: String(params.emailFrom ?? "team@newagainhouses.com"),
        });
        return { success: true, actionCode, data: result };
      }

      case "C5": {
        // Add to Campaign
        // GHL campaign enrollment via workflow trigger
        await ghl.triggerWorkflow(String(params.contactId ?? contactId), String(params.campaignName));
        return { success: true, actionCode, data: { enrolled: true } };
      }

      case "C6": {
        // Remove from Campaign
        // Campaign removal via contact tag or workflow
        await ghl.updateContact(String(params.contactId ?? contactId), {
          tags: (params.removeTags as string[]) ?? [],
        });
        return { success: true, actionCode, data: { removed: true } };
      }

      case "C7": {
        // Log Manual Call — use SMS type as internal note
        const result = await ghl.sendMessage({
          type: "SMS",
          contactId: String(params.contactId ?? contactId),
          message: `[Manual Call Log] ${String(params.notes ?? "")}`,
        });
        return { success: true, actionCode, data: result };
      }

      case "C8": {
        // Add Internal Note — use SMS type
        const result = await ghl.sendMessage({
          type: "SMS",
          contactId: String(params.contactId ?? contactId),
          message: `[Internal Note] ${String(params.note)}`,
        });
        return { success: true, actionCode, data: result };
      }

      // ============ Tasks (T1-T5) ============

      case "T1": {
        // Create Task
        const result = await ghl.createTask(String(params.contactId ?? contactId), {
          title: String(params.title),
          body: String(params.body ?? ""),
          dueDate: String(params.dueDate ?? ""),
          assignedTo: String(params.assignedTo ?? userId),
        });
        return { success: true, actionCode, data: result };
      }

      case "T2": {
        // Update Task
        const result = await ghl.updateTask(String(params.contactId ?? contactId), String(params.taskId), {
          title: params.title as string | undefined,
          body: params.body as string | undefined,
          dueDate: params.dueDate as string | undefined,
        });
        return { success: true, actionCode, data: result };
      }

      case "T3": {
        // Complete Task
        const result = await ghl.updateTask(String(params.contactId ?? contactId), String(params.taskId), {
          completed: true,
        });
        return { success: true, actionCode, data: result };
      }

      case "T4": {
        // Delete Task
        // GHL doesn't have a delete task endpoint — mark as completed
        const result = await ghl.updateTask(String(params.contactId ?? contactId), String(params.taskId), {
          completed: true,
        });
        return { success: true, actionCode, data: result };
      }

      case "T5": {
        // Reassign Task
        const cid = String(params.contactId ?? contactId);
        const result = await ghl.updateTask(cid, String(params.taskId), { assignedTo: String(params.assignedTo) });
        return { success: true, actionCode, data: result };
      }

      // ============ Calendar (A1-A5) ============

      case "A1": {
        // Schedule Appointment
        const targetContactId = String(params.contactId ?? contactId);
        if (!isSchedulableGhlContactId(targetContactId)) {
          throw new Error("This contact is not linked to a real GHL contact yet, so it cannot be scheduled.");
        }
        const result = await ghl.createAppointment({
          calendarId: String(params.calendarId),
          contactId: targetContactId,
          startTime: String(params.startTime),
          endTime: String(params.endTime),
          title: String(params.title ?? "NAH Call"),
          assignedUserId: String(params.assignedUserId ?? userId),
        });
        return { success: true, actionCode, data: result };
      }

      case "A2": {
        // Update Appointment
        await ghl.updateAppointment(String(params.appointmentId), {
          appointmentStatus: params.status as string | undefined,
          title: params.title as string | undefined,
          notes: params.notes as string | undefined,
        });
        return { success: true, actionCode, data: { updated: true } };
      }

      case "A3": {
        // Cancel Appointment
        await ghl.updateAppointment(String(params.appointmentId), {
          appointmentStatus: "cancelled",
        });
        return { success: true, actionCode, data: { cancelled: true } };
      }

      case "A4": {
        // Reschedule Appointment — cancel old, create new
        const targetContactId = String(params.contactId ?? contactId);
        if (!isSchedulableGhlContactId(targetContactId)) {
          throw new Error("This contact is not linked to a real GHL contact yet, so it cannot be scheduled.");
        }
        await ghl.updateAppointment(String(params.appointmentId), {
          appointmentStatus: "cancelled",
        });
        const result = await ghl.createAppointment({
          calendarId: String(params.calendarId),
          contactId: targetContactId,
          startTime: String(params.newStartTime),
          endTime: String(params.newEndTime),
          title: String(params.title ?? "NAH Call (Rescheduled)"),
          assignedUserId: String(params.assignedUserId ?? userId),
        });
        return { success: true, actionCode, data: result };
      }

      case "A5": {
        // Send Appointment Reminder
        const targetContactId = String(params.contactId ?? contactId);
        const reminderMessage = String(
          params.reminderMessage ?? "Reminder: You have an upcoming call with New Again Houses."
        );
        const result = signalHouseEnabled()
          ? await sendContactSmsViaSignalHouse(targetContactId, reminderMessage, {
              fromNumber: String(params.fromNumber ?? ""),
            })
          : await ghl.sendMessage({
              type: "SMS",
              contactId: targetContactId,
              message: reminderMessage,
            });
        return { success: true, actionCode, data: result };
      }

      // ============ Contact Management (M1-M9) ============

      case "M1": {
        // Create Contact
        const result = await ghl.upsertContact({
          firstName: String(params.firstName ?? ""),
          lastName: String(params.lastName ?? ""),
          email: params.email as string | undefined,
          phone: params.phone as string | undefined,
        });
        return { success: true, actionCode, data: result };
      }

      case "M2": {
        // Update Contact Fields
        const cid = String(params.contactId ?? contactId);
        const fields = (params.fields as Record<string, unknown>) ?? {};
        const result = await ghl.updateContact(cid, fields);
        return { success: true, actionCode, data: result };
      }

      case "M3": {
        // Update Pipeline Stage (GHL custom field write)
        const cid = String(params.contactId ?? contactId);
        const customFields = (params.customFields as Array<{ id: string; value: string }>) ?? [
          { id: String(params.fieldId), value: String(params.fieldValue) },
        ];
        const result = await ghl.updateContact(cid, { customFields });
        return { success: true, actionCode, data: result };
      }

      case "M4": {
        // Add Tag
        const cid = String(params.contactId ?? contactId);
        const result = await ghl.updateContact(cid, {
          tags: params.tags as string[],
        });
        return { success: true, actionCode, data: result };
      }

      case "M5": {
        // Remove Tag
        const cid = String(params.contactId ?? contactId);
        // GHL tag removal: update with filtered tags
        const result = await ghl.updateContact(cid, {
          tags: (params.remainingTags as string[]) ?? [],
        });
        return { success: true, actionCode, data: result };
      }

      case "M6": {
        // Assign Contact
        const cid = String(params.contactId ?? contactId);
        const result = await ghl.updateContact(cid, {
          assignedTo: String(params.assignedTo),
        });
        return { success: true, actionCode, data: result };
      }

      case "M7": {
        // Mark as Lost
        const cid = String(params.contactId ?? contactId);
        const result = await ghl.updateContact(cid, {
          tags: [...((params.existingTags as string[]) ?? []), "lost"],
        });
        return { success: true, actionCode, data: result };
      }

      case "M8": {
        // Mark as DNC
        const cid = String(params.contactId ?? contactId);
        const result = await ghl.updateContact(cid, {
          dnd: true,
        });
        return { success: true, actionCode, data: result };
      }

      case "M9": {
        // Delete Contact
        // Soft delete — add DNC tag, don't actually delete
        const cid = String(params.contactId ?? contactId);
        const result = await ghl.updateContact(cid, {
          dnd: true,
          tags: [...((params.existingTags as string[]) ?? []), "deleted"],
        });
        return { success: true, actionCode, data: result };
      }

      // ============ Opportunities (O1-O3) ============

      case "O1": {
        // Create Opportunity
        const result = await ghl.createOpportunity({
          pipelineId: String(params.pipelineId),
          pipelineStageId: String(params.stageId),
          name: String(params.name),
          contactId: String(params.contactId ?? contactId),
          status: "open",
        });
        return { success: true, actionCode, data: result };
      }

      case "O2": {
        // Update Opportunity
        const result = await ghl.movePipelineStage(String(params.opportunityId), String(params.stageId));
        return { success: true, actionCode, data: result };
      }

      case "O3": {
        // Close Opportunity
        const result = await ghl.movePipelineStage(String(params.opportunityId), String(params.closedStageId));
        return { success: true, actionCode, data: result };
      }

      default:
        return { success: false, actionCode, error: `Unknown action code: ${actionCode}` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, actionCode, error: message };
  }
}
