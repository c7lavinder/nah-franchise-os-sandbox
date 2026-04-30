"use client";
import { apiFetch } from "@/lib/auth/api-fetch";
import Link from "next/link";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, User, Menu, Bell, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";

interface Alert {
  id: string;
  alert_type: string;
  severity: string;
  message: string;
  ghl_contact_id: string | null;
  created_at: string;
}

interface TopBarProps {
  pageTitle: string;
  userName: string;
  onMenuToggle?: () => void;
}

function severityColor(severity: string): string {
  switch (severity) {
    case "critical":
      return "text-danger";
    case "high":
      return "text-warning";
    case "medium":
      return "text-info";
    default:
      return "text-text-tertiary";
  }
}

function timeAgo(timestamp: string): string {
  const ms = Date.now() - new Date(timestamp).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

export default function TopBar({ pageTitle, userName, onMenuToggle }: TopBarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertCount, setAlertCount] = useState(0);
  const { logout } = useAuth();
  const router = useRouter();

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await apiFetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts ?? []);
        setAlertCount(data.count ?? 0);
      }
    } catch {
      // Silent fail
    }
  }, []);

  useEffect(() => {
    void fetchAlerts();
    const interval = setInterval(() => void fetchAlerts(), 60000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  async function dismissAlert(id: string) {
    try {
      await apiFetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      setAlertCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Silent fail
    }
  }

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <header className="fixed top-0 left-0 right-0 h-topbar bg-bg-secondary border-b border-border-default z-50 flex items-center px-4">
      {/* Mobile menu toggle */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden mr-3 p-1.5 rounded-md text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
        aria-label="Toggle menu"
      >
        <Menu size={20} />
      </button>

      {/* Logo */}
      <div className="flex items-center gap-2 mr-6">
        <div className="w-8 h-8 rounded-md bg-nah-orange flex items-center justify-center">
          <span className="text-white font-bold text-body-sm">NAH</span>
        </div>
        <span className="text-text-primary font-semibold text-body hidden sm:block">Franchise OS</span>
      </div>

      {/* Page title */}
      <h1 className="text-h2 text-text-primary flex-1">{pageTitle}</h1>

      {/* Notification bell */}
      <div className="relative mr-2">
        <button
          onClick={() => {
            setBellOpen(!bellOpen);
            setDropdownOpen(false);
          }}
          className="relative p-2 rounded-md text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
          aria-label="Notifications"
        >
          <Bell size={18} />
          {alertCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 min-w-[18px] bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {alertCount > 99 ? "99+" : alertCount}
            </span>
          )}
        </button>

        {/* Bell drawer */}
        {bellOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setBellOpen(false)} />
            <div className="absolute right-0 top-full mt-1 w-80 bg-bg-tertiary border border-border-default rounded-lg shadow-lg z-50 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border-default">
                <span className="text-body-sm font-medium text-text-primary">Notifications ({alertCount})</span>
                <button onClick={() => setBellOpen(false)} className="p-0.5 text-text-tertiary hover:text-text-primary">
                  <X size={14} />
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {alerts.length === 0 ? (
                  <div className="py-8 text-center">
                    <CheckCircle2 size={20} className="text-success mx-auto mb-2" />
                    <p className="text-caption text-text-tertiary">All clear — no alerts</p>
                  </div>
                ) : (
                  alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="flex items-start gap-2 px-3 py-2.5 border-b border-border-default hover:bg-bg-hover transition-colors"
                    >
                      <AlertTriangle size={14} className={`mt-0.5 flex-shrink-0 ${severityColor(alert.severity)}`} />
                      <a
                        href={alert.ghl_contact_id ? `/contacts/${alert.ghl_contact_id}` : "/activity"}
                        className="flex-1 min-w-0"
                        onClick={() => setBellOpen(false)}
                      >
                        <p className="text-caption text-text-primary leading-tight">{alert.message}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] font-medium uppercase ${severityColor(alert.severity)}`}>
                            {alert.severity}
                          </span>
                          <span className="text-[10px] text-text-tertiary">{timeAgo(alert.created_at)}</span>
                        </div>
                      </a>
                      <button
                        onClick={() => void dismissAlert(alert.id)}
                        className="p-0.5 text-text-tertiary hover:text-success flex-shrink-0"
                        title="Dismiss"
                      >
                        <CheckCircle2 size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>
              {alerts.length > 0 && (
                <div className="px-3 py-2 border-t border-border-default">
                  <Link
                    href="/activity"
                    className="text-caption text-nah-orange hover:underline"
                    onClick={() => setBellOpen(false)}
                  >
                    View all activity
                  </Link>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* User menu */}
      <div className="relative">
        <button
          onClick={() => {
            setDropdownOpen(!dropdownOpen);
            setBellOpen(false);
          }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-bg-hover transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-scout-purple flex items-center justify-center">
            <span className="text-white text-caption font-semibold">
              {userName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)}
            </span>
          </div>
          <span className="text-body text-text-primary hidden md:block">{userName}</span>
          <ChevronDown size={14} className="text-text-tertiary hidden md:block" />
        </button>

        {dropdownOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
            <div className="absolute right-0 top-full mt-1 w-48 bg-bg-tertiary border border-border-default rounded-lg shadow-lg z-50 py-1">
              <button
                onClick={() => {
                  setDropdownOpen(false);
                  router.push("/settings");
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-body text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
              >
                <User size={16} />
                Settings
              </button>
              <div className="border-t border-border-default my-1" />
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-body text-danger hover:bg-bg-hover transition-colors"
              >
                <LogOut size={16} />
                Log Out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
