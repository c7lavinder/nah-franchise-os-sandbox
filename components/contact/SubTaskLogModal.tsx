"use client";

/**
 * SubTaskLogModal — form to create a sub-task log entry.
 * Per §1.5: content_type, content_text, state_advance, logger pre-fill per §1.8.
 */

import { useState } from "react";
import { X, Loader2 } from "lucide-react";

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
  onClose: () => void;
  onSuccess: () => void;
}

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
  onClose,
  onSuccess,
}: SubTaskLogModalProps) {
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

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/contacts/${contactId}/sub-tasks/${subTaskId}/logs`, {
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
