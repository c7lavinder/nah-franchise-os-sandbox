"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

/**
 * SubTaskLogModal — view existing logs, create new, or edit an existing log.
 * Supports attachments (file URL + link URL).
 */

import { useState, useEffect } from "react";
import { X, Loader2, Trash2, Pencil, Paperclip, ExternalLink, ArrowLeft } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { titleCase } from "@/lib/format/contact";
import FileDropZone from "@/components/ui/FileDropZone";
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
  editingLog?: SubTaskLog | null;
  onClose: () => void;
  onSuccess: () => void;
  onLogDeleted?: () => void;
}

const SOURCE_BADGE: Record<string, { label: string; color: string }> = {
  manual: { label: "Manual", color: "bg-nah-blue/10 text-nah-blue" },
  api: { label: "API", color: "bg-success/10 text-success" },
  ai: { label: "AI", color: "bg-scout-purple/10 text-scout-purple" },
};

function formatLogDate(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) +
    " at " +
    d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  );
}

type ModalView = "list" | "create" | "detail" | "edit";

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
  editingLog: initialEditingLog = null,
  onClose,
  onSuccess,
  onLogDeleted,
}: SubTaskLogModalProps) {
  const { toast } = useToast();

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // View state
  const [view, setView] = useState<ModalView>(initialEditingLog ? "edit" : "list");
  const [selectedLog, setSelectedLog] = useState<SubTaskLog | null>(initialEditingLog);

  // Create form state
  const [stateAdvance, setStateAdvance] = useState<"first" | "second" | null>(
    stateType === "two_state" ? "first" : null
  );
  const [contentText, setContentText] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [loggerUserId, setLoggerUserId] = useState(defaultLoggerUserId ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit form state
  const [editText, setEditText] = useState("");
  const [editFileUrl, setEditFileUrl] = useState("");
  const [editLinkUrl, setEditLinkUrl] = useState("");

  // Delete tracking
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const visibleLogs = existingLogs.filter((l) => !l.deleted_at && !deletedIds.has(l.id));

  function openDetail(log: SubTaskLog) {
    setSelectedLog(log);
    setView("detail");
  }

  function openEdit(log: SubTaskLog) {
    setSelectedLog(log);
    setEditText(log.content_text ?? "");
    setEditFileUrl(log.content_file_url ?? "");
    setEditLinkUrl(log.content_link_url ?? "");
    setView("edit");
  }

  function openCreate() {
    setContentText("");
    setFileUrl("");
    setLinkUrl("");
    setError(null);
    setView("create");
  }

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
      if (view === "detail" || view === "edit") setView("list");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleCreate() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/contacts/${contactId}/sub-tasks/${subTaskId}/logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType: fileUrl ? "file" : linkUrl ? "link" : "note",
          contentText: contentText || undefined,
          contentFileUrl: fileUrl || undefined,
          contentLinkUrl: linkUrl || undefined,
          stateAdvance,
          loggerUserId: loggerUserId || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to create log");
      }
      const data = await res.json();
      toast(data.autoAdvanced ? "Log saved — stage advanced!" : "Log saved");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create log");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveEdit() {
    if (!selectedLog) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/sub-task-logs/${selectedLog.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentText: editText || null,
          contentFileUrl: editFileUrl || null,
          contentLinkUrl: editLinkUrl || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to update log");
      }
      toast("Log updated");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update log");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-bg-tertiary border border-border-default rounded-lg w-full max-w-lg mx-4 max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 px-5 pt-5 pb-3 border-b border-border-default">
          {(view === "detail" || view === "edit" || view === "create") && (
            <button onClick={() => setView("list")} className="btn-ghost p-1">
              <ArrowLeft size={16} />
            </button>
          )}
          <h2 className="text-h2 text-text-primary flex-1">
            {view === "list" && titleCase(subTaskName)}
            {view === "create" && "New Log"}
            {view === "detail" && "Log Details"}
            {view === "edit" && "Edit Log"}
          </h2>
          <button onClick={onClose} className="btn-ghost p-1">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* ═══ LIST VIEW ═══ */}
          {view === "list" && (
            <div className="space-y-2">
              {visibleLogs.length === 0 && (
                <p className="text-body-sm text-text-tertiary italic py-4 text-center">No logs yet</p>
              )}
              {visibleLogs.map((log) => {
                const source = SOURCE_BADGE[log.source] ?? SOURCE_BADGE.manual;
                const stateLabel = log.state_advance === "first" ? "1st" : log.state_advance === "second" ? "2nd" : "";
                const isDeleting = deletingId === log.id;
                const hasAttachment = !!log.content_file_url || !!log.content_link_url;

                return (
                  <div
                    key={log.id}
                    className="bg-bg-secondary border border-border-default rounded-md px-3 py-2.5 cursor-pointer hover:border-border-hover transition-colors"
                    onClick={() => openDetail(log)}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${source.color}`}>
                        {source.label}
                      </span>
                      {stateLabel && (
                        <span className="px-1 py-0.5 rounded text-[10px] font-bold bg-bg-tertiary text-text-tertiary">
                          {stateLabel}
                        </span>
                      )}
                      {hasAttachment && <Paperclip size={10} className="text-text-tertiary" />}
                      <span className="flex-1" />
                      <span className="text-[10px] text-text-tertiary">{formatLogDate(log.created_at)}</span>
                    </div>
                    {log.content_text && (
                      <p className="text-body-sm text-text-primary line-clamp-2 leading-snug">{log.content_text}</p>
                    )}
                    {!log.content_text && log.content_type !== "note" && (
                      <p className="text-body-sm text-text-tertiary italic">{titleCase(log.content_type)}</p>
                    )}
                    <p className="text-[10px] text-text-tertiary mt-1">{log.logger_name ?? "Unknown"}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* ═══ DETAIL VIEW ═══ */}
          {view === "detail" &&
            selectedLog &&
            (() => {
              const source = SOURCE_BADGE[selectedLog.source] ?? SOURCE_BADGE.manual;
              const stateLabel =
                selectedLog.state_advance === "first"
                  ? (firstStateLabel ?? "First State")
                  : selectedLog.state_advance === "second"
                    ? (secondStateLabel ?? "Second State")
                    : null;

              return (
                <div className="space-y-4">
                  {/* Meta row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${source.color}`}>
                      {source.label}
                    </span>
                    {stateLabel && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-bg-secondary text-text-secondary">
                        {titleCase(stateLabel)}
                      </span>
                    )}
                    <span className="text-[11px] text-text-tertiary">{titleCase(selectedLog.content_type)}</span>
                  </div>

                  {/* Content */}
                  <div>
                    <label className="block text-caption text-text-tertiary mb-1">Notes</label>
                    <div className="bg-bg-secondary border border-border-default rounded-md px-3 py-2.5 text-body-sm text-text-primary whitespace-pre-wrap min-h-[60px]">
                      {selectedLog.content_text || <span className="text-text-tertiary italic">No notes</span>}
                    </div>
                  </div>

                  {/* Attachments */}
                  {(selectedLog.content_file_url || selectedLog.content_link_url) && (
                    <div>
                      <label className="block text-caption text-text-tertiary mb-1">Attachments</label>
                      <div className="space-y-1">
                        {selectedLog.content_file_url && (
                          <a
                            href={selectedLog.content_file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-body-sm text-nah-blue hover:underline"
                          >
                            <Paperclip size={12} /> {selectedLog.content_file_url.split("/").pop() ?? "File"}
                          </a>
                        )}
                        {selectedLog.content_link_url && (
                          <a
                            href={selectedLog.content_link_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-body-sm text-nah-blue hover:underline"
                          >
                            <ExternalLink size={12} /> {selectedLog.content_link_url}
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Logger + date */}
                  <div className="flex items-center gap-4 text-caption text-text-tertiary pt-2 border-t border-border-default">
                    <span>Logged by: {selectedLog.logger_name ?? "Unknown"}</span>
                    <span>{formatLogDate(selectedLog.created_at)}</span>
                  </div>
                </div>
              );
            })()}

          {/* ═══ EDIT VIEW ═══ */}
          {view === "edit" && selectedLog && (
            <div className="space-y-3">
              <div>
                <label className="block text-caption text-text-tertiary mb-1">Notes</label>
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full bg-bg-secondary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary resize-none"
                  rows={4}
                  placeholder="What happened?"
                />
              </div>
              <FileDropZone value={editFileUrl} onChange={setEditFileUrl} label="Attachment" />
              <div>
                <label className="block text-caption text-text-tertiary mb-1">Link URL</label>
                <input
                  type="url"
                  value={editLinkUrl}
                  onChange={(e) => setEditLinkUrl(e.target.value)}
                  className="w-full bg-bg-secondary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary"
                  placeholder="https://..."
                />
              </div>
              {error && <p className="text-body-sm text-danger">{error}</p>}
            </div>
          )}

          {/* ═══ CREATE VIEW ═══ */}
          {view === "create" && (
            <div className="space-y-3">
              {/* State advance — two-state only */}
              {stateType === "two_state" && (
                <div>
                  <label className="block text-caption text-text-tertiary mb-1.5">State Advance</label>
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
                      {titleCase(firstStateLabel) || "First State"}
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
                      {titleCase(secondStateLabel) || "Second State"}
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-caption text-text-tertiary mb-1">Notes</label>
                <textarea
                  value={contentText}
                  onChange={(e) => setContentText(e.target.value)}
                  placeholder="What happened?"
                  className="w-full bg-bg-secondary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary resize-none"
                  rows={3}
                />
              </div>

              <FileDropZone value={fileUrl} onChange={setFileUrl} label="Attachment" />

              <div>
                <label className="block text-caption text-text-tertiary mb-1">Link URL</label>
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  className="w-full bg-bg-secondary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="block text-caption text-text-tertiary mb-1">Logged By</label>
                <select
                  value={loggerUserId}
                  onChange={(e) => setLoggerUserId(e.target.value)}
                  className="w-full bg-bg-secondary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary"
                >
                  <option value="">{defaultLoggerName ? `${defaultLoggerName} (default)` : "Select user..."}</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              {error && <p className="text-body-sm text-danger">{error}</p>}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center gap-2 px-5 py-3 border-t border-border-default">
          {view === "list" && (
            <>
              <button onClick={onClose} className="btn-ghost px-4 py-2 text-body-sm">
                Close
              </button>
              <button onClick={openCreate} className="btn-primary px-4 py-2 text-body-sm ml-auto">
                + New Log
              </button>
            </>
          )}
          {view === "detail" && selectedLog && (
            <>
              <button onClick={() => setView("list")} className="btn-ghost px-4 py-2 text-body-sm">
                Back
              </button>
              <span className="flex-1" />
              <button
                onClick={() => openEdit(selectedLog)}
                className="btn-ghost px-3 py-2 text-body-sm flex items-center gap-1 text-nah-blue"
              >
                <Pencil size={14} /> Edit
              </button>
              <button
                onClick={() => void handleDelete(selectedLog.id)}
                disabled={deletingId === selectedLog.id}
                className="btn-ghost px-3 py-2 text-body-sm flex items-center gap-1 text-danger"
              >
                <Trash2 size={14} /> Delete
              </button>
            </>
          )}
          {view === "edit" && (
            <>
              <button onClick={() => setView("list")} className="btn-ghost px-4 py-2 text-body-sm">
                Cancel
              </button>
              <button
                onClick={() => void handleSaveEdit()}
                disabled={submitting}
                className="btn-primary px-4 py-2 text-body-sm ml-auto flex items-center gap-1"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                {submitting ? "Saving..." : "Save Changes"}
              </button>
            </>
          )}
          {view === "create" && (
            <>
              <button onClick={() => setView("list")} className="btn-ghost px-4 py-2 text-body-sm">
                Cancel
              </button>
              <button
                onClick={() => void handleCreate()}
                disabled={submitting}
                className="btn-primary px-4 py-2 text-body-sm ml-auto flex items-center gap-1"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                {submitting ? "Saving..." : "Save Log"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
