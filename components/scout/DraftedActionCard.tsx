"use client";

import { useState } from "react";
import {
  MessageSquare,
  Mail,
  CheckSquare,
  ArrowRightLeft,
  Check,
  X,
  Loader2,
  User,
  GitBranch,
  Calendar,
  StickyNote,
  Zap,
  ClipboardList,
} from "lucide-react";
import {
  TaskActionForm,
  SMSActionForm,
  EmailActionForm,
  StageMoveActionForm,
  AppointmentActionForm,
  NoteActionForm,
  ProfileUpdateActionForm,
  SubTaskLogActionForm,
} from "@/components/scout/action-forms";
import type {
  DraftedAction,
  DraftedMessagePayload,
  DraftedTaskPayload,
  DraftedStageMovePayload,
  DraftedProfileUpdatePayload,
  DraftedJourneyActionPayload,
  DraftedAppointmentPayload,
  DraftedNotePayload,
  DraftedTriggerWorkflowPayload,
  DraftedSubTaskLogPayload,
} from "@/types/scout";

interface DraftedActionCardProps {
  action: DraftedAction;
  onConfirm: (action: DraftedAction) => void;
  onCancel: (actionId: string) => void;
  isExecuting: boolean;
}

function ActionIcon({ action }: { action: DraftedAction }) {
  switch (action.type) {
    case "message": {
      const ch = (action.payload as DraftedMessagePayload).channel;
      return ch === "Email" ? (
        <Mail size={16} className="text-scout-purple" />
      ) : (
        <MessageSquare size={16} className="text-scout-purple" />
      );
    }
    case "task":
      return <CheckSquare size={16} className="text-scout-purple" />;
    case "stage_move":
      return <ArrowRightLeft size={16} className="text-scout-purple" />;
    case "profile_update":
      return <User size={16} className="text-scout-purple" />;
    case "journey_action":
      return <GitBranch size={16} className="text-scout-purple" />;
    case "appointment":
      return <Calendar size={16} className="text-scout-purple" />;
    case "note":
      return <StickyNote size={16} className="text-scout-purple" />;
    case "trigger_workflow":
      return <Zap size={16} className="text-scout-purple" />;
    case "sub_task_log":
      return <ClipboardList size={16} className="text-scout-purple" />;
    default:
      return <MessageSquare size={16} className="text-scout-purple" />;
  }
}

function actionTypeLabel(action: DraftedAction): string {
  switch (action.type) {
    case "message": {
      const ch = (action.payload as DraftedMessagePayload).channel;
      return ch === "Email" ? "Send Email" : "Send SMS";
    }
    case "task":
      return "Create Task";
    case "stage_move":
      return "Move Stage";
    case "profile_update":
      return "Update Profile";
    case "journey_action":
      return "Journey Action";
    case "appointment":
      return "Book Appointment";
    case "note":
      return "Add Note";
    case "trigger_workflow":
      return "Trigger Workflow";
    case "sub_task_log":
      return "Log Sub-Task";
    default:
      return "Action";
  }
}

function FallbackDisplay({ action }: { action: DraftedAction }) {
  let content = "";
  switch (action.type) {
    case "journey_action": {
      const p = action.payload as DraftedJourneyActionPayload;
      const verb =
        p.kind === "enroll_workflow"
          ? "Enroll"
          : p.kind === "pause_workflow"
            ? "Pause"
            : p.kind === "resume_workflow"
              ? "Resume"
              : "Exit";
      const lines: string[] = [`${verb} ${action.contactName}`];
      if (p.workflowName ?? p.workflowId) lines.push(`Workflow: ${p.workflowName ?? p.workflowId}`);
      if (p.enrollmentId) lines.push(`Enrollment: ${p.enrollmentId}`);
      if (p.reason) lines.push(`Reason: ${p.reason}`);
      content = lines.join("\n");
      break;
    }
    case "trigger_workflow": {
      const p = action.payload as DraftedTriggerWorkflowPayload;
      content = `Workflow: ${p.workflowName ?? p.workflowId}\nContact: ${action.contactName}`;
      break;
    }
    default:
      content = JSON.stringify(action.payload, null, 2);
  }
  return <div className="text-body-sm text-text-secondary whitespace-pre-wrap">{content}</div>;
}

export default function DraftedActionCard({ action, onConfirm, onCancel, isExecuting }: DraftedActionCardProps) {
  const [editedPayload, setEditedPayload] = useState(action.payload);
  const [editedContactId, setEditedContactId] = useState(action.contactId);
  const [editedContactName, setEditedContactName] = useState(action.contactName);

  const isResolved = action.status === "confirmed" || action.status === "cancelled";

  function handleContactChange(id: string, name: string) {
    setEditedContactId(id);
    setEditedContactName(name);
  }

  function handleConfirm() {
    const updated: DraftedAction = {
      ...action,
      status: "confirmed",
      contactId: editedContactId,
      contactName: editedContactName,
      payload: editedPayload,
    };
    onConfirm(updated);
  }

  function renderForm() {
    const disabled = isResolved || isExecuting;

    switch (action.type) {
      case "task":
        return (
          <TaskActionForm
            payload={editedPayload as DraftedTaskPayload}
            contactId={editedContactId}
            contactName={editedContactName}
            onChange={setEditedPayload}
            onContactChange={handleContactChange}
            disabled={disabled}
          />
        );
      case "message": {
        const msgPayload = editedPayload as DraftedMessagePayload;
        return msgPayload.channel === "Email" ? (
          <EmailActionForm
            payload={msgPayload}
            contactId={editedContactId}
            contactName={editedContactName}
            onChange={setEditedPayload}
            onContactChange={handleContactChange}
            disabled={disabled}
          />
        ) : (
          <SMSActionForm
            payload={msgPayload}
            contactId={editedContactId}
            contactName={editedContactName}
            onChange={setEditedPayload}
            onContactChange={handleContactChange}
            disabled={disabled}
          />
        );
      }
      case "stage_move":
        return (
          <StageMoveActionForm
            payload={editedPayload as DraftedStageMovePayload}
            contactId={editedContactId}
            contactName={editedContactName}
            onChange={setEditedPayload}
            onContactChange={handleContactChange}
            disabled={disabled}
          />
        );
      case "appointment":
        return (
          <AppointmentActionForm
            payload={editedPayload as DraftedAppointmentPayload}
            contactId={editedContactId}
            contactName={editedContactName}
            onChange={setEditedPayload}
            onContactChange={handleContactChange}
            disabled={disabled}
          />
        );
      case "note":
        return (
          <NoteActionForm
            payload={editedPayload as DraftedNotePayload}
            contactId={editedContactId}
            contactName={editedContactName}
            onChange={setEditedPayload}
            onContactChange={handleContactChange}
            disabled={disabled}
          />
        );
      case "profile_update":
        return (
          <ProfileUpdateActionForm
            payload={editedPayload as DraftedProfileUpdatePayload}
            contactId={editedContactId}
            contactName={editedContactName}
            onChange={setEditedPayload}
            onContactChange={handleContactChange}
            disabled={disabled}
          />
        );
      case "sub_task_log":
        return (
          <SubTaskLogActionForm
            payload={editedPayload as DraftedSubTaskLogPayload}
            contactName={editedContactName}
            onChange={setEditedPayload}
            disabled={disabled}
          />
        );
      default:
        return <FallbackDisplay action={action} />;
    }
  }

  return (
    <div className="bg-scout-action-bg border border-scout-bubble-border rounded-lg p-4 my-2">
      <div className="flex items-center gap-2 mb-3">
        <ActionIcon action={action} />
        <span className="text-overline text-scout-purple uppercase tracking-wider">{actionTypeLabel(action)}</span>
        {action.status === "confirmed" && <span className="badge-success ml-auto">Confirmed</span>}
        {action.status === "cancelled" && <span className="badge-danger ml-auto">Cancelled</span>}
      </div>

      <div className="mb-3">{renderForm()}</div>

      {!isResolved && (
        <div className="flex items-center gap-2 pt-2 border-t border-border-glass">
          <button
            onClick={handleConfirm}
            disabled={isExecuting}
            className="btn-scout text-body-sm py-1.5 px-3 flex items-center gap-1.5"
          >
            {isExecuting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Confirm
          </button>
          <button
            onClick={() => onCancel(action.id)}
            disabled={isExecuting}
            className="btn-ghost text-body-sm py-1.5 px-3 text-danger flex items-center gap-1.5"
          >
            <X size={14} />
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
