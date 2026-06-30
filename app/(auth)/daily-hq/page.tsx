"use client";
import { apiFetch } from "@/lib/auth/api-fetch";
import Link from "next/link";

import { useState, useEffect, useCallback } from "react";
import { Bot, AlertTriangle } from "lucide-react";
import type { GHLConversation, GHLAppointment, GHLTask } from "@/types/ghl";
import { ConversationList, ConversationThread, InboxFilters } from "@/components/inbox";
import { TodayCalendar, TaskPanel, WorkQueuePanel } from "@/components/daily-hq";
import ScoreCardRow from "@/components/scorecards/ScoreCardRow";
import { useAuth } from "@/lib/auth/AuthContext";

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
  const [availableNumbers, setAvailableNumbers] = useState<string[]>([]);

  // Calendar state
  const [appointments, setAppointments] = useState<GHLAppointment[]>([]);

  // Task state
  const [tasks, setTasks] = useState<GHLTask[]>([]);
  const [workQueue, setWorkQueue] = useState<WorkQueueItem[]>([]);
  const [sidebarError, setSidebarError] = useState<string | null>(null);

  // Fetch inbox
  const fetchInbox = useCallback(async () => {
    setInboxLoading(true);
    setInboxError(null);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (inboxFilter === "unread") params.set("unread", "true");
      const res = await apiFetch(`/api/inbox?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations ?? []);
        setAvailableNumbers(data.availableNumbers ?? []);
        setInboxError(data.setupRequired ? (data.error ?? "Assign a SignalHouse number in Settings.") : null);
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
      const res = await apiFetch("/api/daily-hq");
      if (res.ok) {
        const data = await res.json();
        setAppointments(data.upcoming ?? []);
        setTasks(data.tasks ?? []);
        setWorkQueue(data.workQueue ?? []);
      } else {
        const errBody = await res.json().catch(() => ({}));
        setSidebarError(`Failed to load calendar and tasks (${res.status})`);
      }
    } catch (err) {
      setSidebarError(err instanceof Error ? err.message : "Failed to load calendar and tasks");
    }
  }, []);

  useEffect(() => {
    void fetchInbox();
  }, [fetchInbox]);

  useEffect(() => {
    if (selectedConv && !conversations.some((conversation) => conversation.id === selectedConv.id)) {
      setSelectedConv(null);
    }
  }, [conversations, selectedConv]);

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

  // Unmatched contacts from Read.ai calls
  const [needsReviewCount, setNeedsReviewCount] = useState(0);
  useEffect(() => {
    apiFetch("/api/contacts/batch?needs_review=true&count_only=true")
      .then((r) => (r.ok ? r.json() : { count: 0 }))
      .then((d) => setNeedsReviewCount(d.count ?? 0))
      .catch(() => {});
  }, []);

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
    <div className="pb-6">
      {/* Header: unread pill + KPI row + needs-review banner */}
      <div className="py-2 space-y-3">
        {unreadCount > 0 && (
          <span className="inline-flex items-center rounded-full bg-[#F5A623] px-3.5 py-1.5 text-[13px] font-bold text-white shadow-[0_3px_8px_rgba(245,166,35,0.32)]">
            {unreadCount} unread
          </span>
        )}
        <ScoreCardRow page="daily-hq" />
        {needsReviewCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertTriangle size={14} className="text-amber-600 flex-shrink-0" />
            <span className="text-body-sm text-amber-800">
              <strong>{needsReviewCount}</strong> contact{needsReviewCount !== 1 ? "s" : ""} from calls need to be
              reviewed
            </span>
            <Link href="/pipeline?needs_review=true" className="text-caption text-amber-700 hover:underline ml-auto">
              Review &rarr;
            </Link>
          </div>
        )}
      </div>

      {/* Messaging center: list · thread (full width) */}
      <div className="flex flex-wrap items-start gap-[18px]">
        {/* Conversation list */}
        <div className="hub-panel flex flex-col flex-[0_0_300px] h-[600px] max-md:flex-[1_1_100%]">
          <InboxFilters
            filter={inboxFilter}
            onFilterChange={setInboxFilter}
            onRefresh={fetchInbox}
            loading={inboxLoading}
            unreadCount={unreadCount}
            searchQuery={inboxSearch}
            onSearchChange={setInboxSearch}
          />
          {inboxError && <p className="px-3.5 py-2 text-xs text-[#EB5757]">{inboxError}</p>}
          <ConversationList
            conversations={filteredConversations}
            selectedId={selectedConv?.id ?? null}
            onSelect={(conv) => setSelectedConv(conv)}
            hasMore={conversations.length >= 50}
          />
        </div>

        {/* Thread */}
        <div className="hub-panel flex flex-col flex-[1_1_460px] min-w-[360px] h-[600px] max-md:flex-[1_1_100%]">
          {selectedConv ? (
            <ConversationThread
              conversation={selectedConv}
              availableNumbers={availableNumbers}
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

      {/* Work rail — a row of three cards underneath the messaging center */}
      <div className="mt-[18px] flex flex-wrap items-start gap-3.5">
        {sidebarError && <p className="basis-full text-xs text-[#EB5757]">{sidebarError}</p>}
        <WorkQueuePanel items={workQueue} />
        <TodayCalendar appointments={appointments} />
        <TaskPanel tasks={tasks} onTaskUpdated={fetchSidebar} />
      </div>
    </div>
  );
}
