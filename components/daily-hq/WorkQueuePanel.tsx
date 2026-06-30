"use client";

import Link from "next/link";
import { ClipboardList } from "lucide-react";

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

const PRIORITY_DOT: Record<WorkQueueItem["priority"], string> = {
  critical: "#EB5757",
  high: "#EB5757",
  medium: "#F5A623",
  low: "#1FB6A8",
};

function formatDue(value: string | null): string {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";

  const now = new Date();
  const diffDays = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < -1) return `${Math.abs(diffDays)}d ago`;
  if (diffDays < 0) return "Yesterday";
  if (diffDays === 0) return "Today";
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
    <section className="hub-card p-4 flex-1 basis-60 min-w-60">
      <header className="flex items-center gap-2 mb-1">
        <ClipboardList size={17} className="text-[#0E96D8]" />
        <h2 className="text-[15px] font-bold text-[#1c2430]">Work Queue</h2>
        <span className="ml-auto text-xs text-[#9aa3b0]">{items.length} to clear</span>
      </header>

      {visibleItems.length === 0 ? (
        <p className="py-3 text-[13px] text-[#9aa3b0]">No queue items due right now.</p>
      ) : (
        <div>
          {visibleItems.map((item) => {
            const href = targetHref(item);
            const content = (
              <div className="flex items-start gap-2.5 py-2 border-t border-[#f2f4f7] first:border-t-0">
                <span
                  className="mt-[5px] w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: PRIORITY_DOT[item.priority] }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold text-[#1c2430]">{item.title}</p>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[#9aa3b0]">
                    <span>{item.statusLabel}</span>
                    <span>·</span>
                    <span>{formatDue(item.dueAt)}</span>
                  </div>
                </div>
              </div>
            );

            return href ? (
              <Link key={item.id} href={href} className="block rounded-lg hover:bg-[#f7f9fc] -mx-1 px-1">
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
