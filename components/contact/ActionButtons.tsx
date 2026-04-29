"use client";

/**
 * ActionButtons — contact-level action triggers that route through DraftedActionProvider.
 *
 * These replace the inline ActionPanels for SMS, Email, and Schedule actions.
 * Call logging stays as its own panel (it records past events, not future outbound actions).
 *
 * Usage: Import these hooks into any component and call them with contact data.
 * They create a DraftedAction and show the universal confirm card.
 */

import { useDraftedAction, buildDraftedAction } from "@/components/scout/DraftedActionProvider";
import type {
  DraftedMessagePayload,
  DraftedTaskPayload,
  DraftedNotePayload,
  DraftedAppointmentPayload,
  DraftedStageMovePayload,
} from "@/types/scout";

interface ContactInfo {
  contactId: string;
  contactName: string;
  phone?: string | null;
  email?: string | null;
}

/** Trigger a Send SMS action card */
export function useShowSMS() {
  const { showDraftCard } = useDraftedAction();

  return (contact: ContactInfo, onSuccess?: () => void) => {
    const payload: DraftedMessagePayload = {
      actionType: "message",
      channel: "SMS",
      content: "",
      toAddress: contact.phone ?? undefined,
      fromAddress: "+1 (888) NAH-FLIP",
      scheduledAt: null,
    };
    showDraftCard(buildDraftedAction("message", contact.contactId, contact.contactName, payload), onSuccess);
  };
}

/** Trigger a Send Email action card */
export function useShowEmail() {
  const { showDraftCard } = useDraftedAction();

  return (contact: ContactInfo, onSuccess?: () => void) => {
    const payload: DraftedMessagePayload = {
      actionType: "message",
      channel: "Email",
      content: "",
      subject: "",
      toAddress: contact.email ?? undefined,
      fromAddress: "notifications@newagainhouses.com",
      fromName: "Notifications",
      scheduledAt: null,
    };
    showDraftCard(buildDraftedAction("message", contact.contactId, contact.contactName, payload), onSuccess);
  };
}

/** Trigger a Create Task action card */
export function useShowTask() {
  const { showDraftCard } = useDraftedAction();

  return (contact: ContactInfo, defaults?: Partial<DraftedTaskPayload>, onSuccess?: () => void) => {
    const payload: DraftedTaskPayload = {
      actionType: "task",
      title: defaults?.title ?? "",
      description: defaults?.description ?? undefined,
      dueDate: defaults?.dueDate ?? new Date(Date.now() + 86400000).toISOString(),
      assignedTo: defaults?.assignedTo ?? undefined,
      assignedToName: defaults?.assignedToName ?? undefined,
    };
    showDraftCard(buildDraftedAction("task", contact.contactId, contact.contactName, payload), onSuccess);
  };
}

/** Trigger an Add Note action card */
export function useShowNote() {
  const { showDraftCard } = useDraftedAction();

  return (contact: ContactInfo, defaultBody?: string, onSuccess?: () => void) => {
    const payload: DraftedNotePayload = {
      actionType: "note",
      body: defaultBody ?? "",
    };
    showDraftCard(buildDraftedAction("note", contact.contactId, contact.contactName, payload), onSuccess);
  };
}

/** Trigger a Book Appointment action card */
export function useShowAppointment() {
  const { showDraftCard } = useDraftedAction();

  return (contact: ContactInfo, defaults?: Partial<DraftedAppointmentPayload>, onSuccess?: () => void) => {
    const now = new Date();
    const startDefault = new Date(now.getTime() + 3600000);
    const endDefault = new Date(now.getTime() + 5400000);

    const payload: DraftedAppointmentPayload = {
      actionType: "appointment",
      calendarId: defaults?.calendarId ?? "",
      calendarName: defaults?.calendarName ?? undefined,
      title: defaults?.title ?? `Meeting with ${contact.contactName}`,
      startTime: defaults?.startTime ?? startDefault.toISOString(),
      endTime: defaults?.endTime ?? endDefault.toISOString(),
      assignedUserId: defaults?.assignedUserId ?? undefined,
    };
    showDraftCard(buildDraftedAction("appointment", contact.contactId, contact.contactName, payload), onSuccess);
  };
}

/** Trigger a Move Stage action card */
export function useShowStageMove() {
  const { showDraftCard } = useDraftedAction();

  return (contact: ContactInfo, defaults?: Partial<DraftedStageMovePayload>, onSuccess?: () => void) => {
    const payload: DraftedStageMovePayload = {
      actionType: "stage_move",
      currentPipeline: defaults?.currentPipeline ?? "Unknown",
      currentPipelineId: defaults?.currentPipelineId ?? undefined,
      currentStage: defaults?.currentStage ?? "Unknown",
      newPipeline: defaults?.newPipeline ?? defaults?.currentPipeline ?? "Unknown",
      newPipelineId: defaults?.newPipelineId ?? defaults?.currentPipelineId ?? undefined,
      newStage: defaults?.newStage ?? "",
      reason: defaults?.reason ?? undefined,
    };
    showDraftCard(buildDraftedAction("stage_move", contact.contactId, contact.contactName, payload), onSuccess);
  };
}
