"use client";

import Link from "next/link";
import { AlertTriangle, ClipboardList, ExternalLink } from "lucide-react";

interface WorkQueueItem {
  id: string;
  status: string;
  statusLabel: string;
  priority: "low" | "medium" | "high" | "critical";
  title: string;
  description: string | null;
  contactId: string | null;
  ghlContactId: string | null;
  sourceType: string;
  dueAt: string | null;
}

interface WorkQueuePanelProps {
  items: WorkQueueItem[];
}

const PRIORITY_STYLE: Record<WorkQueueItem["priority"], string> = {
  critical: "border-l-[#DC2626] bg-[#FEF2F2]",
  high: "border-l-[#EF4444] bg-[#FEF2F2]",
  medium: "border-l-[#F59E0B] bg-[#FFFBEB]",
  low: "border-l-[#6B7280] bg-bg-secondary",
};

function formatDue(value: string | null): string {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";

  const now = new Date();
  const diffDays = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < -1) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays < 0) return "Overdue";
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Tomorrow";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function targetHref(item: WorkQueueItem): string | null {
  if (item.contactId) return `/contacts/${item.contactId}`;
  if (item.ghlContactId) return `/pipeline?contact=${encodeURIComponent(item.ghlContactId)}`;
  if (item.sourceType === "ghl_action_draft") return "/activity";
  return null;
}

export default function WorkQueuePanel({ items }: WorkQueuePanelProps) {
  const visibleItems = items.slice(0, 8);

  return (
    <section className="card-glass !p-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-default">
        <div className="flex items-center gap-2">
          <ClipboardList size={16} className="text-text-secondary" />
          <h2 className="text-label-caps text-text-secondary">Work Queue</h2>
        </div>
        {items.length > 0 && <span className="badge badge-warm">{items.length}</span>}
      </div>

      {visibleItems.length === 0 ? (
        <div className="px-4 py-5 text-body-sm text-text-tertiary">No queue items due right now.</div>
      ) : (
        <div className="divide-y divide-border-default/50">
          {visibleItems.map((item) => {
            const href = targetHref(item);
            const content = (
              <div className={`border-l-[3px] px-3 py-2.5 ${PRIORITY_STYLE[item.priority]}`}>
                <div className="flex items-start gap-2">
                  {(item.priority === "critical" || item.priority === "high") && (
                    <AlertTriangle size={13} className="mt-0.5 flex-shrink-0 text-danger" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-sm font-medium text-text-primary">{item.title}</p>
                    <div className="mt-1 flex items-center gap-2 text-caption text-text-tertiary">
                      <span>{item.statusLabel}</span>
                      <span>·</span>
                      <span>{formatDue(item.dueAt)}</span>
                    </div>
                    {item.description && <p className="mt-1 line-clamp-2 text-caption text-text-secondary">{item.description}</p>}
                  </div>
                  {href && <ExternalLink size={12} className="mt-1 flex-shrink-0 text-text-tertiary" />}
                </div>
              </div>
            );

            return href ? (
              <Link key={item.id} href={href} className="block hover:bg-bg-secondary/60">
                {content}
              </Link>
            ) : (
              <div key={item.id}>{content}</div>
            );
          })}
        </div>
      )}
    </section>
  );
}
