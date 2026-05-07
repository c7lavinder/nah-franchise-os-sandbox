"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

/**
 * SubTaskLogHistory — expanded log list for a sub-task inside StageDrilldown.
 * Shows each log with source, content preview, attachments, logger, timestamp.
 * Edit + delete actions per log.
 */

import { useState } from "react";
import { Trash2, Loader2, Pencil, Paperclip, ExternalLink } from "lucide-react";
import { titleCase } from "@/lib/format/contact";
import type { SubTaskLog } from "@/lib/contacts/pipeline-state";

interface SubTaskLogHistoryProps {
  logs: SubTaskLog[];
  onRefresh?: () => void;
  onEdit?: (log: SubTaskLog) => void;
}

const SOURCE_BADGE: Record<string, { label: string; color: string }> = {
  manual: { label: "Manual", color: "bg-nah-blue/10 text-nah-blue" },
  api: { label: "API", color: "bg-success/10 text-success" },
  ai: { label: "AI", color: "bg-scout-purple/10 text-scout-purple" },
};

function formatLogDate(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString([], { month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  );
}

export default function SubTaskLogHistory({ logs, onRefresh, onEdit }: SubTaskLogHistoryProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (logs.length === 0) return null;

  async function handleDelete(logId: string) {
    if (!confirm("Delete this log? This cannot be undone from the UI.")) return;
    setDeletingId(logId);
    try {
      const res = await apiFetch(`/api/sub-task-logs/${logId}`, { method: "DELETE" });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Unknown error" }));
        alert(`Failed to delete log: ${error}`);
        return;
      }
      onRefresh?.();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="ml-10 pl-3 border-l-2 border-border-default space-y-1.5 py-2">
      {logs.map((log) => {
        const source = SOURCE_BADGE[log.source] ?? SOURCE_BADGE.manual;
        const stateLabel = log.state_advance === "first" ? "1st" : log.state_advance === "second" ? "2nd" : "";
        const isDeleting = deletingId === log.id;
        const hasAttachment = !!log.content_file_url || !!log.content_link_url;

        return (
          <div key={log.id} className="bg-bg-tertiary border border-border-default rounded-md px-3 py-2">
            {/* Top row: badges + actions */}
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${source.color}`}>{source.label}</span>
              {stateLabel && (
                <span className="px-1 py-0.5 rounded text-[10px] font-bold bg-bg-secondary text-text-tertiary">
                  {stateLabel}
                </span>
              )}
              {hasAttachment && <Paperclip size={10} className="text-text-tertiary" />}
              <span className="flex-1" />
              <span className="text-[10px] text-text-tertiary">
                {log.logger_name ? `${log.logger_name} · ` : ""}
                {formatLogDate(log.created_at)}
              </span>
              {onEdit && (
                <button
                  onClick={() => onEdit(log)}
                  className="p-0.5 rounded text-text-tertiary hover:text-nah-blue hover:bg-nah-blue/10 transition-colors"
                  title="Edit log"
                  aria-label="Edit log"
                >
                  <Pencil size={12} />
                </button>
              )}
              {onRefresh && (
                <button
                  onClick={() => handleDelete(log.id)}
                  disabled={isDeleting}
                  className="p-0.5 rounded text-text-tertiary hover:text-danger hover:bg-danger/10 transition-colors disabled:opacity-50"
                  title="Delete log"
                  aria-label="Delete log"
                >
                  {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                </button>
              )}
            </div>

            {/* Content */}
            {log.content_text && <p className="text-body-sm text-text-primary leading-snug">{log.content_text}</p>}
            {!log.content_text && log.content_type !== "note" && (
              <p className="text-body-sm text-text-tertiary italic">{titleCase(log.content_type)}</p>
            )}

            {/* Attachments */}
            {log.content_file_url && (
              <a
                href={log.content_file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 mt-1 text-[11px] text-nah-blue hover:underline"
              >
                <Paperclip size={10} /> Attachment
              </a>
            )}
            {log.content_link_url && (
              <a
                href={log.content_link_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 mt-1 text-[11px] text-nah-blue hover:underline"
              >
                <ExternalLink size={10} /> {log.content_link_url}
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}
