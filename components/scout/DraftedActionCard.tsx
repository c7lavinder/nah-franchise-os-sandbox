"use client";

import { useState } from "react";
import {
  MessageSquare,
  CheckSquare,
  ArrowRightLeft,
  Pencil,
  Check,
  X,
  Loader2,
} from "lucide-react";
import type {
  DraftedAction,
  DraftedMessagePayload,
  DraftedTaskPayload,
  DraftedStageMovePayload,
} from "@/types/scout";

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
  }
}
