"use client";

/**
 * SubTaskLogHistory — expandable log history for a sub-task.
 * Per §1.15: collapsed default, shows latest log + count badge. Click to expand.
 */

import type { SubTaskLog } from "@/lib/contacts/pipeline-state";

interface SubTaskLogHistoryProps {
  logs: SubTaskLog[];
}

const SOURCE_BADGE: Record<string, { label: string; color: string }> = {
  manual: { label: "Manual", color: "bg-nah-blue/10 text-nah-blue" },
  api: { label: "API", color: "bg-success/10 text-success" },
  ai: { label: "AI", color: "bg-scout-purple/10 text-scout-purple" },
};

export default function SubTaskLogHistory({ logs }: SubTaskLogHistoryProps) {
  if (logs.length === 0) return null;

  return (
    <div className="ml-10 pl-3 border-l-2 border-border-default space-y-2 py-2">
      {logs.map((log) => {
        const source = SOURCE_BADGE[log.source] ?? SOURCE_BADGE.manual;
        const stateLabel = log.state_advance === "first" ? "1st" : log.state_advance === "second" ? "2nd" : "";

        return (
          <div key={log.id} className="flex items-start gap-2 text-caption">
            {/* Source badge */}
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${source.color}`}>
              {source.label}
            </span>

            {/* State advance indicator */}
            {stateLabel && (
              <span className="px-1 py-0.5 rounded text-[10px] font-bold bg-bg-tertiary text-text-tertiary flex-shrink-0">
                {stateLabel}
              </span>
            )}

            {/* Content */}
            <div className="flex-1 min-w-0">
              {log.content_text && (
                <p className="text-text-secondary truncate">{log.content_text}</p>
              )}
              {!log.content_text && log.content_type !== "note" && (
                <p className="text-text-tertiary italic">{log.content_type}</p>
              )}
            </div>

            {/* Logger + timestamp */}
            <div className="flex items-center gap-1.5 flex-shrink-0 text-text-tertiary">
              {log.logger_name && <span>{log.logger_name}</span>}
              <span>{new Date(log.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
