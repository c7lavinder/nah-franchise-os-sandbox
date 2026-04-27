"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

import { useState, useEffect } from "react";
import {
  MessageSquare,
  CheckSquare,
  ArrowRightLeft,
  Pencil,
  Check,
  X,
  Loader2,
  User,
  GitBranch,
  Calendar,
  StickyNote,
  Zap,
} from "lucide-react";
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
} from "@/types/scout";

interface CalendarOption {
  id: string;
  name: string;
  description?: string;
}

interface DraftedActionCardProps {
  action: DraftedAction;
  onConfirm: (action: DraftedAction) => void;
  onCancel: (actionId: string) => void;
  isExecuting: boolean;
}

/** Renders the icon for the action type */
function ActionIcon({ type }: { type: DraftedAction["type"] }) {
  switch (type) {
    case "message":
      return <MessageSquare size={16} className="text-scout-purple" />;
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
    default:
      return <MessageSquare size={16} className="text-scout-purple" />;
  }
}

/** Renders a human-readable label for the action type */
function actionLabel(action: DraftedAction): string {
  switch (action.type) {
    case "message": {
      const p = action.payload as DraftedMessagePayload;
      return `${p.channel} to ${action.contactName}`;
    }
    case "task": {
      const p = action.payload as DraftedTaskPayload;
      return `Task for ${action.contactName}: ${p.title}`;
    }
    case "stage_move": {
      const p = action.payload as DraftedStageMovePayload;
      return `Move ${action.contactName} → ${p.newStage}`;
    }
    case "profile_update": {
      const p = action.payload as DraftedProfileUpdatePayload;
      return `Update ${p.fields.length} profile field${p.fields.length !== 1 ? "s" : ""} for ${action.contactName}`;
    }
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
      const what = p.workflowName ?? p.workflowId ?? p.enrollmentId ?? "workflow";
      return `${verb} ${action.contactName} — ${what}`;
    }
    case "appointment": {
      const p = action.payload as DraftedAppointmentPayload;
      return `Appointment "${p.title}" with ${action.contactName}`;
    }
    case "note": {
      return `Note on ${action.contactName}`;
    }
    case "trigger_workflow": {
      const p = action.payload as DraftedTriggerWorkflowPayload;
      return `Trigger ${p.workflowName ?? p.workflowId} for ${action.contactName}`;
    }
    default:
      return `Action for ${action.contactName}`;
  }
}

/** Drafted action card — displayed in the chat when Scout proposes an action */
export default function DraftedActionCard({
  action,
  onConfirm,
  onCancel,
  isExecuting,
}: DraftedActionCardProps) {
  const [editing, setEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(getEditableContent(action));

  // Calendar dropdown state — only used for appointment drafts
  const [calendars, setCalendars] = useState<CalendarOption[] | null>(null);
  const [calendarSearch, setCalendarSearch] = useState("");
  const [calendarPickerOpen, setCalendarPickerOpen] = useState(false);

  // Fetch calendars once when an appointment card mounts so the user can
  // change Scout's suggestion before pushing.
  useEffect(() => {
    if (action.type !== "appointment" || calendars !== null) return;
    let cancelled = false;
    apiFetch("/api/ghl/calendars")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load calendars"))))
      .then((data) => {
        if (!cancelled) setCalendars((data.calendars ?? []) as CalendarOption[]);
      })
      .catch(() => {
        if (!cancelled) setCalendars([]);
      });
    return () => {
      cancelled = true;
    };
  }, [action.type, calendars]);

  const isResolved = action.status === "confirmed" || action.status === "cancelled";

  return (
    <div className="bg-scout-action-bg border border-scout-bubble-border rounded-lg p-4 my-2">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <ActionIcon type={action.type} />
        <span className="text-overline text-scout-purple uppercase tracking-wider">
          Drafted Action
        </span>
        {action.status === "confirmed" && (
          <span className="badge-success ml-auto">Confirmed</span>
        )}
        {action.status === "cancelled" && (
          <span className="badge-danger ml-auto">Cancelled</span>
        )}
      </div>

      {/* Action label */}
      <div className="text-body font-medium text-text-primary mb-2">
        {actionLabel(action)}
      </div>

      {/* Content preview / edit area */}
      <div className="bg-bg-primary/50 rounded-md p-3 mb-3">
        {editing ? (
          <textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            className="input w-full min-h-[80px] resize-y"
            autoFocus
          />
        ) : (
          <div className="text-body text-text-secondary whitespace-pre-wrap">
            {getDisplayContent(action)}
          </div>
        )}
      </div>

      {/* Appointment-specific: searchable calendar picker */}
      {action.type === "appointment" && !isResolved && (
        <div className="mb-3">
          <label className="block text-caption text-text-tertiary mb-1">
            Calendar
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setCalendarPickerOpen((v) => !v)}
              className="w-full text-left bg-bg-primary/50 border border-border-glass rounded-md px-3 py-2 text-body-sm flex items-center justify-between"
            >
              <span className="truncate">
                {(action.payload as DraftedAppointmentPayload).calendarName ??
                  (action.payload as DraftedAppointmentPayload).calendarId ??
                  "Select calendar"}
              </span>
              <span className="text-text-tertiary text-caption ml-2">
                {calendarPickerOpen ? "▴" : "▾"}
              </span>
            </button>
            {calendarPickerOpen && (
              <div className="absolute z-10 mt-1 w-full bg-surface-glass border border-border-glass rounded-md shadow-lg max-h-64 overflow-hidden flex flex-col">
                <input
                  type="text"
                  value={calendarSearch}
                  onChange={(e) => setCalendarSearch(e.target.value)}
                  placeholder="Search calendars..."
                  className="px-3 py-2 text-body-sm border-b border-border-glass bg-transparent outline-none"
                  autoFocus
                />
                <div className="overflow-y-auto flex-1">
                  {calendars === null ? (
                    <div className="px-3 py-2 text-caption text-text-tertiary">Loading…</div>
                  ) : calendars.length === 0 ? (
                    <div className="px-3 py-2 text-caption text-text-tertiary">No calendars found</div>
                  ) : (
                    calendars
                      .filter((c) =>
                        !calendarSearch.trim()
                          ? true
                          : c.name.toLowerCase().includes(calendarSearch.toLowerCase().trim())
                      )
                      .map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            const p = action.payload as DraftedAppointmentPayload;
                            p.calendarId = c.id;
                            p.calendarName = c.name;
                            p.calendarReason = "selected by user";
                            setCalendarPickerOpen(false);
                            setCalendarSearch("");
                          }}
                          className="w-full text-left px-3 py-2 text-body-sm hover:bg-scout-bubble-bg"
                        >
                          <div className="font-medium">{c.name}</div>
                          {c.description && (
                            <div className="text-caption text-text-tertiary truncate">
                              {c.description}
                            </div>
                          )}
                        </button>
                      ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action buttons — only show if not already resolved */}
      {!isResolved && (
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button
                onClick={() => {
                  applyEdit(action, editedContent);
                  setEditing(false);
                  onConfirm(action);
                }}
                disabled={isExecuting}
                className="btn-scout text-body-sm py-1.5 px-3 flex items-center gap-1.5"
              >
                {isExecuting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Check size={14} />
                )}
                Save & Confirm
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setEditedContent(getEditableContent(action));
                }}
                className="btn-ghost text-body-sm py-1.5 px-3 flex items-center gap-1.5"
              >
                <X size={14} />
                Discard Edits
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditing(true)}
                className="btn-secondary text-body-sm py-1.5 px-3 flex items-center gap-1.5"
              >
                <Pencil size={14} />
                Edit
              </button>
              <button
                onClick={() => onConfirm(action)}
                disabled={isExecuting}
                className="btn-scout text-body-sm py-1.5 px-3 flex items-center gap-1.5"
              >
                {isExecuting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Check size={14} />
                )}
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
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Gets the editable text content from an action payload */
function getEditableContent(action: DraftedAction): string {
  switch (action.type) {
    case "message":
      return (action.payload as DraftedMessagePayload).content;
    case "task":
      return (action.payload as DraftedTaskPayload).title;
    case "stage_move":
      return (action.payload as DraftedStageMovePayload).reason ?? "";
    case "profile_update":
      return (action.payload as DraftedProfileUpdatePayload).fields
        .map((f) => `${f.fieldName}: ${f.value}`)
        .join("\n");
    case "note":
      return (action.payload as DraftedNotePayload).body;
    case "appointment":
      return (action.payload as DraftedAppointmentPayload).title;
    default:
      return "";
  }
}

/** Gets a human-readable display of the action content */
function getDisplayContent(action: DraftedAction): string {
  switch (action.type) {
    case "message": {
      const p = action.payload as DraftedMessagePayload;
      const lines = [];
      if (p.subject) lines.push(`Subject: ${p.subject}`);
      lines.push(p.content);
      return lines.join("\n");
    }
    case "task": {
      const p = action.payload as DraftedTaskPayload;
      const lines = [`Title: ${p.title}`];
      if (p.description) lines.push(`Description: ${p.description}`);
      lines.push(`Due: ${new Date(p.dueDate).toLocaleDateString()}`);
      return lines.join("\n");
    }
    case "stage_move": {
      const p = action.payload as DraftedStageMovePayload;
      const lines = [`From: ${p.currentStage}`, `To: ${p.newStage}`];
      if (p.reason) lines.push(`Reason: ${p.reason}`);
      return lines.join("\n");
    }
    case "profile_update": {
      const p = action.payload as DraftedProfileUpdatePayload;
      return p.fields
        .map((f) => `${f.fieldName}: ${f.value}\n  (${f.reason})`)
        .join("\n\n");
    }
    case "journey_action": {
      const p = action.payload as DraftedJourneyActionPayload;
      const lines: string[] = [`Kind: ${p.kind}`];
      if (p.workflowName ?? p.workflowId) lines.push(`Workflow: ${p.workflowName ?? p.workflowId}`);
      if (p.enrollmentId) lines.push(`Enrollment: ${p.enrollmentId}`);
      if (p.reason) lines.push(`Reason: ${p.reason}`);
      return lines.join("\n");
    }
    case "appointment": {
      const p = action.payload as DraftedAppointmentPayload;
      const lines = [
        `Title: ${p.title}`,
        `Calendar: ${p.calendarName ?? p.calendarId}${p.calendarReason ? ` (${p.calendarReason})` : ""}`,
        `Start: ${new Date(p.startTime).toLocaleString()}`,
        `End: ${new Date(p.endTime).toLocaleString()}`,
      ];
      if (p.assignedUserId) lines.push(`Assigned to: ${p.assignedUserId}`);
      return lines.join("\n");
    }
    case "note": {
      const p = action.payload as DraftedNotePayload;
      return p.body;
    }
    case "trigger_workflow": {
      const p = action.payload as DraftedTriggerWorkflowPayload;
      return `Workflow: ${p.workflowName ?? p.workflowId}\nID: ${p.workflowId}`;
    }
    default:
      return JSON.stringify(action.payload, null, 2);
  }
}

/** Applies the user's edits back into the action payload */
function applyEdit(action: DraftedAction, newContent: string): void {
  switch (action.type) {
    case "message":
      (action.payload as DraftedMessagePayload).content = newContent;
      break;
    case "task":
      (action.payload as DraftedTaskPayload).title = newContent;
      break;
    case "stage_move":
      (action.payload as DraftedStageMovePayload).reason = newContent;
      break;
    case "profile_update": {
      // Parse edited lines back into field updates
      const lines = newContent.split("\n").filter((l) => l.includes(":"));
      const p = action.payload as DraftedProfileUpdatePayload;
      for (const line of lines) {
        const colonIdx = line.indexOf(":");
        const fieldName = line.slice(0, colonIdx).trim();
        const value = line.slice(colonIdx + 1).trim();
        const existing = p.fields.find((f) => f.fieldName === fieldName);
        if (existing) {
          existing.value = value;
        }
      }
      break;
    }
    case "note":
      (action.payload as DraftedNotePayload).body = newContent;
      break;
    case "appointment":
      (action.payload as DraftedAppointmentPayload).title = newContent;
      break;
  }
}
