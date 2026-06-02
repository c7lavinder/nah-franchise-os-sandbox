"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

/**
 * NotificationBell — shows @-mention notification count + dropdown panel.
 * Per §1.14: bell shows ONLY notifications table rows (activity_mention).
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";

import { capitalizeName } from "@/lib/format/contact";

interface Notification {
  id: string;
  type: string;
  sourceType: string;
  sourceId: string;
  contactId: string | null;
  contactName: string;
  title: string;
  authorName: string;
  preview: string;
  metadata?: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

interface NotificationBellProps {
  onNavClick?: () => void;
  forceClose?: boolean;
}

export default function NotificationBell({ onNavClick, forceClose }: NotificationBellProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await apiFetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications ?? []);
        setUnreadCount(data.count ?? 0);
      }
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    void fetchNotifications();
    const interval = setInterval(() => void fetchNotifications(), 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close when sidebar collapses
  useEffect(() => {
    if (forceClose) setOpen(false);
  }, [forceClose]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function markAsRead(ids: string[]) {
    if (ids.length === 0) return;
    await apiFetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    await fetchNotifications();
  }

  function handleNotificationClick(n: Notification) {
    setOpen(false);
    onNavClick?.();
    void markAsRead([n.id]);

    // Route based on notification type
    if (n.type === "daily_brief") {
      router.push("/daily-hq");
    } else if (n.type === "new_lead" && n.contactId) {
      router.push(`/contacts/${n.contactId}`);
    } else if (n.contactId && n.sourceId) {
      router.push(`/contacts/${n.contactId}?message=${n.sourceId}`);
    } else if (n.contactId) {
      router.push(`/contacts/${n.contactId}`);
    } else {
      router.push("/pipeline");
    }
  }

  function handleMarkAllRead() {
    const unreadIds = notifications.filter((n) => !n.readAt).map((n) => n.id);
    void markAsRead(unreadIds);
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative flex items-center gap-3 h-12 pl-3 rounded-xl text-text-secondary hover:bg-[rgba(0,161,225,0.08)] hover:text-nah-blue transition-all duration-200 w-full"
      >
        <Bell size={20} className="flex-shrink-0" />
        {unreadCount > 0 && (
          <span className="absolute top-2 left-8 min-w-[16px] h-4 px-1 rounded-full bg-[#f5a800] text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
        <span className="text-nav opacity-100 transition-opacity duration-200 delay-100 whitespace-nowrap lg:opacity-0 lg:group-hover:opacity-100">
          Notifications {unreadCount > 0 ? `(${unreadCount})` : ""}
        </span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute bottom-full left-0 mb-2 w-full max-h-[400px] rounded-xl overflow-hidden flex flex-col"
          style={{
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(0, 0, 0, 0.08)",
            boxShadow: "0 8px 30px rgba(0, 0, 0, 0.12)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-default">
            <span className="text-body-sm font-medium text-text-primary">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="text-caption text-nah-blue hover:underline">
                Mark all as read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-caption text-text-tertiary">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`w-full text-left px-4 py-3 border-b border-border-default/50 hover:bg-bg-hover transition-colors ${
                    !n.readAt ? "bg-nah-blue/5" : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.readAt && <div className="w-2 h-2 rounded-full bg-nah-blue flex-shrink-0 mt-1.5" />}
                    <div className={`flex-1 min-w-0 ${n.readAt ? "ml-4" : ""}`}>
                      {n.type === "activity_mention" ? (
                        <p className="text-caption text-text-primary">
                          <span className="font-medium">{capitalizeName(n.authorName)}</span>
                          {" mentioned you on "}
                          <span className="font-medium">{capitalizeName(n.contactName)}</span>
                        </p>
                      ) : (
                        <p className="text-caption text-text-primary font-medium">{n.title}</p>
                      )}
                      <p className="text-[11px] text-text-tertiary mt-0.5 truncate">{n.preview}</p>
                      <p className="text-[10px] text-text-tertiary mt-0.5">
                        {new Date(n.createdAt).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
