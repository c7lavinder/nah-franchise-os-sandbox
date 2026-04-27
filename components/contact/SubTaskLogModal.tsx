"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

/**
 * SubTaskLogModal — form to create a sub-task log entry.
 * Per §1.5: content_type, content_text, state_advance, logger pre-fill per §1.8.
 */

import { useState } from "react";
import { X, Loader2, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import type { SubTaskLog } from "@/lib/contacts/pipeline-state";

interface SubTaskLogModalProps {
  contactId: string;
  subTaskId: string;
  subTaskName: string;
  stateType: "single" | "two_state";
  firstStateLabel: string | null;
  secondStateLabel: string | null;
  defaultLoggerUserId: string | null;
  defaultLoggerName: string | null;
  users: { id: string; name: string }[];
  existingLogs?: SubTaskLog[];
  onClose: () => void;
  onSuccess: () => void;
  onLogDeleted?: () => void;
}

const SOURCE_BADGE: Record<string, { label: string; color: string }> = {
  manual: { label: "Manual", color: "bg-nah-blue/10 text-nah-blue" },
  api: { label: "API", color: "bg-success/10 text-success" },
  ai: { label: "AI", color: "bg-scout-purple/10 text-scout-purple" },
};

const CONTENT_TYPES = [
  { value: "note", label: "Note" },
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "appointment", label: "Appointment" },
  { value: "file", label: "File" },
  { value: "link", label: "Link" },
  { value: "transcript", label: "Transcript" },
];

export default function SubTaskLogModal({
  contactId,
  subTaskId,
  subTaskName,
  stateType,
  firstStateLabel,
  secondStateLabel,
  defaultLoggerUserId,
  defaultLoggerName,
  users,
  existingLogs = [],
  onClose,
  onSuccess,
  onLogDeleted,
}: SubTaskLogModalProps) {
  const { toast } = useToast();
  const [stateAdvance, setStateAdvance] = useState<"first" | "second" | null>(
    stateType === "two_state" ? "first" : null
  );
  const [contentType, setContentType] = useState("note");
  const [contentText, setContentText] = useState("");
  const [contentLinkUrl, setContentLinkUrl] = useState("");
  const [contentFileUrl, setContentFileUrl] = useState("");
  const [loggerUserId, setLoggerUserId] = useState(defaultLoggerUserId ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(logId: string) {
    if (!confirm("Delete this log? This cannot be undone from the UI.")) return;
    setDeletingId(logId);
    try {
      const res = await apiFetch(`/api/sub-task-logs/${logId}`, { method: "DELETE" });
      if (!res.ok) {
        const { error: msg } = await res.json().catch(() => ({ error: "Delete failed" }));
        toast(`Couldn't delete: ${msg}`);
        return;
      }
      setDeletedIds((prev) => new Set(prev).add(logId));
      toast("Log deleted");
      onLogDeleted?.();
    } finally {
      setDeletingId(null);
    }
  }

  const visibleLogs = existingLogs.filter((l) => !l.deleted_at && !deletedIds.has(l.id));

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);

    try {
      const res = await apiFetch(`/api/contacts/${contactId}/sub-tasks/${subTaskId}/logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType,
          contentText: contentText || undefined,
          contentFileUrl: contentFileUrl || undefined,
          contentLinkUrl: contentLinkUrl || undefined,
          stateAdvance,
          loggerUserId: loggerUserId || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to create log");
      }

      toast("Log saved");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create log");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-bg-tertiary border border-border-default rounded-lg w-full max-w-md mx-4 p-5 max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-h2 text-text-primary">Log: {subTaskName}</h2>
          <button onClick={onClose} className="btn-ghost p-1"><X size={18} /></button>
        </div>

        {/* Existing logs — newest first, with delete */}
        {visibleLogs.length > 0 && (
          <div className="mb-5">
            <div className="text-caption text-text-tertiary mb-1.5">
              Existing logs ({visibleLogs.length})
            </div>
            <div className="border border-border-default rounded-md divide-y divide-border-default max-h-40 overflow-y-auto">
              {visibleLogs.map((log) => {
                const source = SOURCE_BADGE[log.source] ?? SOURCE_BADGE.manual;
                const stateLabel = log.state_advance === "first" ? "1st" : log.state_advance === "second" ? "2nd" : "";
                const isDeleting = deletingId === log.id;
                return (
                  <div key={log.id} className="flex items-start gap-2 px-2.5 py-2 text-caption">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${source.color}`}>
                      {source.label}
                    </span>
                    {stateLabel && (
                      <span className="px-1 py-0.5 rounded text-[10px] font-bold bg-bg-secondary text-text-tertiary flex-shrink-0">
                        {stateLabel}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      {log.content_text && <p className="text-text-secondary truncate">{log.content_text}</p>}
                      {!log.content_text && log.content_type !== "note" && (
                        <p className="text-text-tertiary italic">{log.content_type}</p>
                      )}
                      <p className="text-[10px] text-text-tertiary">
                        {log.logger_name && `${log.logger_name} · `}
                        {new Date(log.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => void handleDelete(log.id)}
                      disabled={isDeleting}
                      className="p-1 rounded text-danger hover:bg-danger/10 border border-transparent hover:border-danger/30 transition-colors flex-shrink-0 disabled:opacity-50"
                      title="Delete log"
                      aria-label="Delete log"
                    >
                      {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Create new — heading so it's clear this is the add form */}
        <div className="text-caption text-text-tertiary mb-2">Add new log</div>

        {/* State advance — two-state only */}
        {stateType === "two_state" && (
          <div className="mb-4">
            <label className="block text-caption text-text-tertiary mb-1.5">State advance</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStateAdvance("first")}
                className={`flex-1 px-3 py-2 rounded-md border text-body-sm transition-colors ${
                  stateAdvance === "first"
                    ? "border-warning bg-warning/10 text-warning font-medium"
                    : "border-border-default text-text-secondary hover:border-border-hover"
                }`}
              >
                {firstStateLabel ?? "First state"}
              </button>
              <button
                type="button"
                onClick={() => setStateAdvance("second")}
                className={`flex-1 px-3 py-2 rounded-md border text-body-sm transition-colors ${
                  stateAdvance === "second"
                    ? "border-success bg-success/10 text-success font-medium"
                    : "border-border-default text-text-secondary hover:border-border-hover"
                }`}
              >
                {secondStateLabel ?? "Second state"}
              </button>
            </div>
          </div>
        )}

        {/* Content type */}
        <div className="mb-3">
          <label className="block text-caption text-text-tertiary mb-1">Type</label>
          <select
            value={contentType}
            onChange={(e) => setContentType(e.target.value)}
            className="w-full bg-bg-secondary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary"
          >
            {CONTENT_TYPES.map((ct) => (
              <option key={ct.value} value={ct.value}>{ct.label}</option>
            ))}
          </select>
        </div>

        {/* Content text */}
        <div className="mb-3">
          <label className="block text-caption text-text-tertiary mb-1">Notes</label>
          <textarea
            value={contentText}
            onChange={(e) => setContentText(e.target.value)}
            placeholder="What happened?"
            className="w-full bg-bg-secondary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary resize-none"
            rows={3}
          />
        </div>

        {/* Conditional URL fields */}
        {contentType === "link" && (
          <div className="mb-3">
            <label className="block text-caption text-text-tertiary mb-1">Link URL</label>
            <input
              type="url"
              value={contentLinkUrl}
              onChange={(e) => setContentLinkUrl(e.target.value)}
              placeholder="https://..."
              className="w-full bg-bg-secondary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary"
            />
          </div>
        )}
        {contentType === "file" && (
          <div className="mb-3">
            <label className="block text-caption text-text-tertiary mb-1">File URL</label>
            <input
              type="url"
              value={contentFileUrl}
              onChange={(e) => setContentFileUrl(e.target.value)}
              placeholder="https://..."
              className="w-full bg-bg-secondary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary"
            />
          </div>
        )}

        {/* Logger select per §1.8 */}
        <div className="mb-4">
          <label className="block text-caption text-text-tertiary mb-1">Logged by</label>
          <select
            value={loggerUserId}
            onChange={(e) => setLoggerUserId(e.target.value)}
            className="w-full bg-bg-secondary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary"
          >
            <option value="">
              {defaultLoggerName ? `${defaultLoggerName} (default)` : "Select user..."}
            </option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>

        {/* Error */}
        {error && <p className="mb-3 text-body-sm text-danger">{error}</p>}

        {/* Actions */}
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-body-sm">Cancel</button>
          <button
            onClick={() => void handleSubmit()}
            disabled={submitting}
            className="btn-primary px-4 py-2 text-body-sm ml-auto flex items-center gap-1"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {submitting ? "Saving..." : "Save Log"}
          </button>
        </div>
      </div>
    </div>
  );
}
