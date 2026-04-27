"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

import { useState, useEffect, useCallback } from "react";
import { Activity, RefreshCw } from "lucide-react";
import { ActivityFeed } from "@/components/activity";

interface ActivityEvent {
  id: string;
  type: "stage_move" | "message" | "task" | "note" | "alert" | "call_grading";
  status: string;
  description: string;
  contactId: string | null;
  contactName: string | null;
  timestamp: string;
}

export default function ActivityPage() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "moves" | "messages" | "alerts">("all");

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/activity?limit=100");
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events ?? []);
      }
    } catch {
      // Continue with empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchActivity();
  }, [fetchActivity]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      void fetchActivity();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchActivity]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center gap-2 px-1 py-3 flex-shrink-0">
        <Activity size={20} className="text-nah-blue" />
        <h1 className="font-headline text-page-title text-text-primary">Activity</h1>
        <span className="text-caption text-text-tertiary ml-1">
          {events.length} {events.length === 1 ? "event" : "events"}
        </span>
        <button
          onClick={fetchActivity}
          className="btn-ghost p-1.5 ml-auto"
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Feed */}
      <div className="flex-1 border border-border-default rounded-lg overflow-hidden min-h-0">
        <div className="h-full overflow-y-auto">
          <ActivityFeed events={events} filter={filter} onFilterChange={setFilter} />
        </div>
      </div>
    </div>
  );
}
