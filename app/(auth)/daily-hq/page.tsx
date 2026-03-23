"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  AlertTriangle,
  CheckSquare,
  BarChart3,
  Calendar,
  Phone,
  MessageSquare,
  Mail,
  ArrowRightLeft,
  UserPlus,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import type { AlertSeverity } from "@/types/database";

/** Shape of the /api/daily-hq response */
interface DailyHQData {
  scorecard: {
    calls: number;
    texts: number;
    emails: number;
    stageMoves: number;
    newContacted: number;
  };
  alerts: {
    id: string;
    alert_type: string;
    severity: AlertSeverity;
    message: string;
    pipeline_stage: string | null;
    created_at: string;
  }[];
  tasks: {
    id: string;
    title: string;
    contactId: string;
    completed: boolean;
  }[];
  pipeline: { stage: string; count: number }[];
  upcoming: { title: string; time: string; contactId: string }[];
}

/** Auto-refresh interval: 5 minutes */
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

/** Daily HQ page — personalized daily dashboard with real data */
export default function DailyHQPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DailyHQData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const response = await fetch(`/api/daily-hq?userId=${user.id}`);
      if (!response.ok) throw new Error("Failed to fetch dashboard data");
      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Initial load + auto-refresh every 5 minutes
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  const scorecard = data?.scorecard;
  const totalActive = data?.pipeline?.reduce((sum, s) => sum + s.count, 0) ?? 0;
  const maxStageCount = Math.max(...(data?.pipeline?.map((s) => s.count) ?? [1]), 1);

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center gap-2 mb-6">
        <LayoutDashboard size={20} className="text-nah-orange" />
        <h1 className="text-h1 text-text-primary">Daily HQ</h1>
        <span className="text-body text-text-secondary ml-2">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </span>
        <button
          onClick={() => { setLoading(true); fetchData(); }}
          className="btn-ghost ml-auto p-2"
          title="Refresh data"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/20 text-danger text-body-sm rounded-md px-3 py-2 mb-4">
          {error}
        </div>
      )}

      {/* Rep Scorecard — full width */}
      <div className="card mb-6">
        <h2 className="text-overline text-text-secondary uppercase tracking-wider mb-3">
          Rep Scorecard — Today
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {[
            { label: "Calls", value: scorecard?.calls ?? 0, icon: Phone },
            { label: "Texts", value: scorecard?.texts ?? 0, icon: MessageSquare },
            { label: "Emails", value: scorecard?.emails ?? 0, icon: Mail },
            { label: "Stage Moves", value: scorecard?.stageMoves ?? 0, icon: ArrowRightLeft },
            { label: "New Contacted", value: scorecard?.newContacted ?? 0, icon: UserPlus },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <stat.icon size={18} className="text-text-tertiary mx-auto mb-1" />
              <div className="text-h1 text-text-primary">{stat.value}</div>
              <div className="text-caption text-text-secondary">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Alerts + Tasks — side by side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Alerts Panel */}
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-danger" />
            <h2 className="text-overline text-text-secondary uppercase tracking-wider">
              Alerts
            </h2>
            <span className={`ml-auto ${(data?.alerts?.length ?? 0) > 0 ? "badge-danger" : "badge-info"}`}>
              {data?.alerts?.length ?? 0}
            </span>
          </div>
          {(data?.alerts?.length ?? 0) === 0 ? (
            <div className="flex items-center justify-center py-8 text-text-tertiary text-body-sm">
              No active alerts. You&apos;re on track.
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {data?.alerts?.map((alert) => (
                <button
                  key={alert.id}
                  onClick={() => router.push("/scout")}
                  className="w-full text-left p-2.5 rounded-md bg-bg-primary/50 border border-border-default hover:bg-bg-hover transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <SeverityDot severity={alert.severity} />
                    <div className="flex-1 min-w-0">
                      <p className="text-body-sm text-text-primary truncate">{alert.message}</p>
                      {alert.pipeline_stage && (
                        <p className="text-caption text-text-tertiary mt-0.5">{alert.pipeline_stage}</p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tasks Panel */}
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <CheckSquare size={16} className="text-info" />
            <h2 className="text-overline text-text-secondary uppercase tracking-wider">
              Today&apos;s Tasks
            </h2>
            <span className="badge-info ml-auto">{data?.tasks?.length ?? 0}</span>
          </div>
          {(data?.tasks?.length ?? 0) === 0 ? (
            <div className="flex items-center justify-center py-8 text-text-tertiary text-body-sm">
              No tasks for today. Connect GHL to pull your task list.
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {data?.tasks?.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-2 p-2 rounded-md bg-bg-primary/50 border border-border-default"
                >
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={() => {}}
                    className="w-4 h-4 rounded border-border-default"
                  />
                  <span className={`text-body-sm ${task.completed ? "text-text-tertiary line-through" : "text-text-primary"}`}>
                    {task.title}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pipeline Snapshot — full width */}
      <div className="card mb-6">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 size={16} className="text-scout-purple" />
          <h2 className="text-overline text-text-secondary uppercase tracking-wider">
            Pipeline Snapshot
          </h2>
          <span className="text-caption text-text-tertiary ml-auto">
            Total Active: {totalActive}
          </span>
        </div>
        {(data?.pipeline?.length ?? 0) === 0 ? (
          <div className="flex items-center justify-center py-8 text-text-tertiary text-body-sm">
            Pipeline data will appear once GHL is connected.
          </div>
        ) : (
          <div className="space-y-2">
            {data?.pipeline?.map((stage) => (
              <div key={stage.stage} className="flex items-center gap-3">
                <span className="text-body-sm text-text-secondary w-36 truncate flex-shrink-0">
                  {stage.stage}
                </span>
                <div className="flex-1 h-6 bg-bg-primary rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-scout-purple/30 rounded-sm transition-all duration-300"
                    style={{ width: `${(stage.count / maxStageCount) * 100}%` }}
                  />
                </div>
                <span className="text-body-sm text-text-primary font-medium w-8 text-right">
                  {stage.count}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming — full width */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <Calendar size={16} className="text-success" />
          <h2 className="text-overline text-text-secondary uppercase tracking-wider">
            Upcoming (Next 48 Hours)
          </h2>
        </div>
        {(data?.upcoming?.length ?? 0) === 0 ? (
          <div className="flex items-center justify-center py-8 text-text-tertiary text-body-sm">
            No upcoming events. Connect GHL to see your schedule.
          </div>
        ) : (
          <div className="space-y-2">
            {data?.upcoming?.map((event, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-2 rounded-md bg-bg-primary/50 border border-border-default"
              >
                <span className="text-body-sm text-text-secondary w-32 flex-shrink-0">
                  {new Date(event.time).toLocaleString([], {
                    weekday: "short",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
                <span className="text-body-sm text-text-primary">{event.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Severity indicator dot */
function SeverityDot({ severity }: { severity: AlertSeverity }) {
  const colors: Record<AlertSeverity, string> = {
    critical: "bg-danger",
    high: "bg-danger",
    medium: "bg-warning",
    low: "bg-info",
  };
  return <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${colors[severity]}`} />;
}
