"use client";

import {
  ArrowRight, MessageSquare, ClipboardList, FileText,
  AlertTriangle, Phone, CheckCircle2,
} from "lucide-react";

interface ActivityEvent {
  id: string;
  type: "stage_move" | "message" | "task" | "note" | "alert" | "call_grading";
  status: string;
  description: string;
  contactId: string | null;
  contactName: string | null;
  timestamp: string;
}

interface ActivityItemProps {
  event: ActivityEvent;
}

function typeIcon(type: string, status: string) {
  switch (type) {
    case "stage_move": return <ArrowRight size={14} className="text-nah-orange" />;
    case "message": return <MessageSquare size={14} className="text-success" />;
    case "task": return <ClipboardList size={14} className="text-info" />;
    case "note": return <FileText size={14} className="text-warning" />;
    case "call_grading": return <Phone size={14} className="text-scout-purple" />;
    case "alert": return status === "resolved"
      ? <CheckCircle2 size={14} className="text-success" />
      : <AlertTriangle size={14} className={status === "critical" ? "text-danger" : status === "high" ? "text-warning" : "text-info"} />;
    default: return <FileText size={14} className="text-text-tertiary" />;
  }
}

function typeLabel(type: string): string {
  switch (type) {
    case "stage_move": return "Stage Move";
    case "message": return "Message";
    case "task": return "Task";
    case "note": return "Note";
    case "call_grading": return "Call Graded";
    case "alert": return "Alert";
    default: return "Activity";
  }
}

function typeBadgeColor(type: string): string {
  switch (type) {
    case "stage_move": return "bg-nah-orange/15 text-nah-orange";
    case "message": return "bg-success/15 text-success";
    case "task": return "bg-info/15 text-info";
    case "note": return "bg-warning/15 text-warning";
    case "call_grading": return "bg-scout-purple/15 text-scout-purple";
    case "alert": return "bg-danger/15 text-danger";
    default: return "bg-bg-tertiary text-text-tertiary";
  }
}

function formatTime(timestamp: string): string {
  const d = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / (1000 * 60));
  const diffHr = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function ActivityItem({ event }: ActivityItemProps) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-border-default hover:bg-bg-hover transition-colors">
      {/* Icon */}
      <div className="w-8 h-8 rounded-full bg-bg-tertiary flex items-center justify-center flex-shrink-0 mt-0.5">
        {typeIcon(event.type, event.status)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          {event.contactName && (
            <span className="text-body-sm font-medium text-text-primary truncate">
              {event.contactName}
            </span>
          )}
          <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${typeBadgeColor(event.type)}`}>
            {typeLabel(event.type)}
          </span>
        </div>
        <p className="text-body-sm text-text-secondary">{event.description}</p>
      </div>

      {/* Time */}
      <span className="text-caption text-text-tertiary flex-shrink-0 mt-0.5">
        {formatTime(event.timestamp)}
      </span>
    </div>
  );
}
