"use client";

import { Activity } from "lucide-react";
import ActivityItem from "./ActivityItem";

interface ActivityEvent {
  id: string;
  type: "stage_move" | "message" | "task" | "note" | "alert" | "call_grading";
  status: string;
  description: string;
  contactId: string | null;
  contactName: string | null;
  timestamp: string;
}

interface ActivityFeedProps {
  events: ActivityEvent[];
  filter: "all" | "moves" | "messages" | "alerts";
  onFilterChange: (filter: "all" | "moves" | "messages" | "alerts") => void;
}

export default function ActivityFeed({ events, filter, onFilterChange }: ActivityFeedProps) {
  const filtered = events.filter((e) => {
    if (filter === "all") return true;
    if (filter === "moves") return e.type === "stage_move";
    if (filter === "messages") return e.type === "message" || e.type === "note" || e.type === "call_grading";
    if (filter === "alerts") return e.type === "alert";
    return true;
  });

  return (
    <div>
      {/* Filters */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border-default">
        {([
          { key: "all" as const, label: "All" },
          { key: "moves" as const, label: "Stage Moves" },
          { key: "messages" as const, label: "Comms" },
          { key: "alerts" as const, label: "Alerts" },
        ]).map((f) => (
          <button
            key={f.key}
            onClick={() => onFilterChange(f.key)}
            className={`px-2.5 py-1 rounded-md text-caption font-medium transition-colors ${
              filter === f.key
                ? "bg-nah-orange text-white"
                : "text-text-tertiary hover:text-text-primary"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Events */}
      <div>
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <Activity size={32} className="text-text-tertiary mb-3" />
            <p className="text-body-sm text-text-tertiary">No activity yet</p>
            <p className="text-caption text-text-tertiary mt-1">
              Activity will appear as Scout takes actions, leads move, and alerts fire
            </p>
          </div>
        )}
        {filtered.map((event) => (
          <ActivityItem key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}
