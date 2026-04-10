"use client";

import { useState, useEffect, useCallback } from "react";
import { Bot } from "lucide-react";
import type { GHLConversation, GHLAppointment, GHLTask } from "@/types/ghl";
import { ConversationList, ConversationThread, InboxFilters } from "@/components/inbox";
import { TodayCalendar, TaskPanel } from "@/components/daily-hq";
import { QuickAsk } from "@/components/scout";
import ScoreCardRow from "@/components/scorecards/ScoreCardRow";
import { useAuth } from "@/lib/auth/AuthContext";

/**
 * Daily HQ — Chad's Command Center
 *
 * Layout:
 * ┌──────────────────────────┬─────────────┐
 * │        INBOX (2/3)       │ CALENDAR 1/3│
 * │  List  │  Thread         │             │
 * ├──────────────────────────┴─────────────┤
 * │                TASKS                    │
 * └─────────────────────────────────────────┘
 */
export default function DailyHQPage() {
  const { user } = useAuth();
  // Inbox state
  const [conversations, setConversations] = useState<GHLConversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<GHLConversation | null>(null);
  const [inboxFilter, setInboxFilter] = useState<"all" | "unread">("all");
  const [inboxLoading, setInboxLoading] = useState(true);
  const [inboxSearch, setInboxSearch] = useState("");
  const [inboxError, setInboxError] = useState<string | null>(null);

  // Calendar state
  const [appointments, setAppointments] = useState<GHLAppointment[]>([]);

  // Task state
  const [tasks, setTasks] = useState<GHLTask[]>([]);
  const [sidebarError, setSidebarError] = useState<string | null>(null);

  // Fetch inbox
  const fetchInbox = useCallback(async () => {
    setInboxLoading(true);
    setInboxError(null);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (inboxFilter === "unread") params.set("unread", "true");
      const res = await fetch(`/api/inbox?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations ?? []);
      } else {
        setInboxError("Failed to load inbox");
      }
    } catch (err) {
      setInboxError(err instanceof Error ? err.message : "Failed to load inbox");
    } finally {
      setInboxLoading(false);
    }
  }, [inboxFilter]);

  // Fetch calendar + tasks
  const fetchSidebar = useCallback(async () => {
    setSidebarError(null);
    try {
      const params = user?.id ? `?userId=${user.id}` : "";
      const res = await fetch(`/api/daily-hq${params}`);
      if (res.ok) {
        const data = await res.json();
        setAppointments(data.upcoming ?? []);
        setTasks(data.tasks ?? []);
      } else {
        setSidebarError("Failed to load calendar and tasks");
      }
    } catch (err) {
      setSidebarError(err instanceof Error ? err.message : "Failed to load calendar and tasks");
    }
  }, [user?.id]);

  useEffect(() => {
    void fetchInbox();
  }, [fetchInbox]);

  useEffect(() => {
    void fetchSidebar();
  }, [fetchSidebar]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      void fetchInbox();
      void fetchSidebar();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchInbox, fetchSidebar]);

  const unreadCount = conversations.filter((c) => (c.unreadCount ?? 0) > 0).length;

  // Client-side search filter
  const filteredConversations = inboxSearch.trim()
    ? conversations.filter((c) => {
        const q = inboxSearch.toLowerCase();
        const name = (c.contactName || c.fullName || "").toLowerCase();
        const phone = (c.phone || "").toLowerCase();
        const email = (c.email || "").toLowerCase();
        return name.includes(q) || phone.includes(q) || email.includes(q);
      })
    : conversations;

  return (
    <div className="flex flex-col h-[calc(100vh-48px)]">
      {/* Scout bar + Scorecards */}
      <div className="py-4 flex-shrink-0 space-y-3">
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <span className="badge badge-hot flex-shrink-0">
              {unreadCount} unread
            </span>
          )}
          <div className="flex-1 min-w-0">
            <QuickAsk />
          </div>
        </div>
        <ScoreCardRow page="daily-hq" />
      </div>

      {/* Main content: Inbox (60%) + Right Panel (40%) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-4 min-h-0">
        {/* INBOX — 3/5 width */}
        <div className="lg:col-span-3 card-glass !p-0 flex min-h-0 overflow-hidden">
          {/* Conversation list */}
          <div className="w-[280px] flex-shrink-0 flex flex-col min-h-0" style={{ borderRight: "1px solid rgba(0,0,0,0.06)" }}>
            <InboxFilters
              filter={inboxFilter}
              onFilterChange={setInboxFilter}
              onRefresh={fetchInbox}
              loading={inboxLoading}
              unreadCount={unreadCount}
              searchQuery={inboxSearch}
              onSearchChange={setInboxSearch}
            />
            <ConversationList
              conversations={filteredConversations}
              selectedId={selectedConv?.id ?? null}
              onSelect={(conv) => setSelectedConv(conv)}
              hasMore={conversations.length >= 50}
            />
          </div>

          {/* Thread */}
          <div className="flex-1 flex flex-col min-h-0">
            {selectedConv ? (
              <ConversationThread
                conversation={selectedConv}
                onMessageSent={fetchInbox}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="empty-state">
                  <Bot size={48} className="empty-state-icon" />
                  <p className="empty-state-title">No conversation selected</p>
                  <p className="empty-state-text">Choose a conversation from the list</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL — Priority Leads + Calendar + Tasks */}
        <div className="lg:col-span-2 flex flex-col gap-4 min-h-0 overflow-y-auto">
          {sidebarError && <p className="text-caption text-danger">{sidebarError}</p>}
          <TodayCalendar appointments={appointments} />
          <TaskPanel tasks={tasks} onTaskUpdated={fetchSidebar} />
        </div>
      </div>

      {/* Removed bottom tasks — moved to right panel */}
      <div className="mt-4 flex-shrink-0 lg:hidden">
        <TaskPanel tasks={tasks} onTaskUpdated={fetchSidebar} />
      </div>
    </div>
  );
}
