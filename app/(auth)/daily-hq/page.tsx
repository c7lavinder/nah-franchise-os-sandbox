"use client";

import { useState, useEffect, useCallback } from "react";
import { LayoutDashboard } from "lucide-react";
import type { GHLConversation, GHLAppointment, GHLTask } from "@/types/ghl";
import { ConversationList, ConversationThread, InboxFilters } from "@/components/inbox";
import { TodayCalendar, TaskPanel, PriorityLeads } from "@/components/daily-hq";
import { QuickAsk } from "@/components/scout";

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
  // Inbox state
  const [conversations, setConversations] = useState<GHLConversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<GHLConversation | null>(null);
  const [inboxFilter, setInboxFilter] = useState<"all" | "unread">("all");
  const [inboxLoading, setInboxLoading] = useState(true);
  const [inboxSearch, setInboxSearch] = useState("");

  // Calendar state
  const [appointments, setAppointments] = useState<GHLAppointment[]>([]);

  // Task state
  const [tasks, setTasks] = useState<GHLTask[]>([]);

  // Fetch inbox
  const fetchInbox = useCallback(async () => {
    setInboxLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (inboxFilter === "unread") params.set("unread", "true");
      const res = await fetch(`/api/inbox?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations ?? []);
      }
    } catch {
      // Continue with empty
    } finally {
      setInboxLoading(false);
    }
  }, [inboxFilter]);

  // Fetch calendar + tasks
  const fetchSidebar = useCallback(async () => {
    try {
      const res = await fetch("/api/daily-hq");
      if (res.ok) {
        const data = await res.json();
        setAppointments(data.upcoming ?? []);
        setTasks(data.tasks ?? []);
      }
    } catch {
      // Continue with empty
    }
  }, []);

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
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-1 py-3 flex-shrink-0">
        <LayoutDashboard size={20} className="text-nah-orange flex-shrink-0" />
        <h1 className="text-h1 text-text-primary flex-shrink-0">Daily HQ</h1>
        {unreadCount > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-nah-orange text-white text-caption font-bold flex-shrink-0">
            {unreadCount} unread
          </span>
        )}
        <div className="flex-1 min-w-0">
          <QuickAsk />
        </div>
      </div>

      {/* Main content: Inbox (2/3) + Calendar (1/3) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-0 border border-border-default rounded-lg overflow-hidden min-h-0">
        {/* INBOX — 2/3 width */}
        <div className="lg:col-span-2 flex min-h-0 border-r border-border-default">
          {/* Conversation list */}
          <div className="w-[280px] flex-shrink-0 border-r border-border-default flex flex-col min-h-0 bg-bg-secondary">
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
          <div className="flex-1 flex flex-col min-h-0 bg-bg-primary">
            {selectedConv ? (
              <ConversationThread
                conversation={selectedConv}
                onMessageSent={fetchInbox}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-body-sm text-text-tertiary">Select a conversation to view messages</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL — Priority Leads + Calendar */}
        <div className="bg-bg-secondary min-h-0 overflow-y-auto flex flex-col">
          <PriorityLeads />
          <div className="flex-1">
            <TodayCalendar appointments={appointments} />
          </div>
        </div>
      </div>

      {/* TASKS — bottom */}
      <div className="mt-4 flex-shrink-0">
        <TaskPanel tasks={tasks} onTaskUpdated={fetchSidebar} />
      </div>
    </div>
  );
}
