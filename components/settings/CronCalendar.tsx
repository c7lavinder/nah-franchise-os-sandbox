"use client";

/**
 * CronCalendar — shows all scheduled cron jobs with their frequency,
 * last run status, and recent execution history.
 */

import { useState, useEffect } from "react";
import {
  Loader2, CheckCircle2, XCircle, Clock, AlertCircle,
  Bot, FileText, Zap, ChevronDown, ChevronRight,
} from "lucide-react";

interface CronSchedule {
  path: string;
  name: string;
  schedule: string;
  description: string;
  category: string;
  frequency: string;
  lastRun: string | null;
  lastStatus: string;
  runsThisWeek: number;
}

interface CronLog {
  id: string;
  job_name: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  error: string | null;
}

const CATEGORY_META: Record<string, { icon: React.ComponentType<{ size?: number; className?: string }>; color: string; label: string }> = {
  agents: { icon: Bot, color: "text-scout-purple", label: "AI Agents" },
  reporting: { icon: FileText, color: "text-nah-blue", label: "Reporting" },
  pipeline: { icon: Zap, color: "text-nah-orange", label: "Pipeline" },
};

const STATUS_BADGE: Record<string, { color: string; label: string }> = {
  success: { color: "bg-success/10 text-success", label: "Healthy" },
  failed: { color: "bg-danger/10 text-danger", label: "Failed" },
  no_data: { color: "bg-bg-tertiary text-text-tertiary", label: "No runs" },
};

export default function CronCalendar() {
  const [schedules, setSchedules] = useState<CronSchedule[]>([]);
  const [logs, setLogs] = useState<CronLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/cron-jobs")
      .then((r) => r.ok ? r.json() : { schedules: [], logs: [] })
      .then((d) => {
        setSchedules(d.schedules ?? []);
        setLogs(d.logs ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 size={20} className="animate-spin text-text-tertiary" /></div>;
  }

  // Group by category
  const categories = ["agents", "pipeline", "reporting"];
  const grouped = categories.map((cat) => ({
    ...CATEGORY_META[cat],
    key: cat,
    jobs: schedules.filter((s) => s.category === cat),
  }));

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center gap-4 text-caption text-text-tertiary">
        <span>{schedules.length} scheduled jobs</span>
        <span>{schedules.filter((s) => s.lastStatus === "success").length} healthy</span>
        <span>{schedules.filter((s) => s.lastStatus === "failed").length} failed</span>
      </div>

      {/* Schedule list by category */}
      {grouped.map((group) => {
        if (group.jobs.length === 0) return null;
        const Icon = group.icon;
        return (
          <div key={group.key}>
            <div className="flex items-center gap-2 mb-2">
              <Icon size={14} className={group.color} />
              <span className="text-overline text-text-tertiary tracking-wider">{group.label}</span>
            </div>
            <div className="space-y-1">
              {group.jobs.map((job) => {
                const status = STATUS_BADGE[job.lastStatus] ?? STATUS_BADGE.no_data;
                const isExpanded = expandedJob === job.path;
                const jobLogs = logs.filter((l) => {
                  const slug = job.path.split("/").pop() ?? "";
                  return l.job_name === slug || l.job_name === job.name.toLowerCase().replace(/ /g, "-");
                });

                return (
                  <div key={job.path} className="border border-border-default rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedJob(isExpanded ? null : job.path)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-bg-hover transition-colors"
                    >
                      {isExpanded ? <ChevronDown size={12} className="text-text-tertiary" /> : <ChevronRight size={12} className="text-text-tertiary" />}
                      <div className="flex-1 text-left">
                        <span className="text-body-sm font-medium text-text-primary">{job.name}</span>
                        <span className="text-caption text-text-tertiary ml-2">{job.frequency}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {job.runsThisWeek > 0 && (
                          <span className="text-[10px] text-text-tertiary">{job.runsThisWeek} this week</span>
                        )}
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-3 pb-3 border-t border-border-default">
                        <p className="text-caption text-text-secondary mt-2 mb-2">{job.description}</p>
                        <div className="grid grid-cols-3 gap-2 text-caption mb-2">
                          <div>
                            <span className="text-text-tertiary block">Schedule</span>
                            <span className="text-text-primary font-mono">{job.schedule}</span>
                          </div>
                          <div>
                            <span className="text-text-tertiary block">Last Run</span>
                            <span className="text-text-primary">
                              {job.lastRun ? new Date(job.lastRun).toLocaleString() : "Never"}
                            </span>
                          </div>
                          <div>
                            <span className="text-text-tertiary block">Endpoint</span>
                            <span className="text-text-primary font-mono text-[10px]">{job.path}</span>
                          </div>
                        </div>

                        {/* Recent logs */}
                        {jobLogs.length > 0 && (
                          <div className="mt-2">
                            <span className="text-[10px] text-text-tertiary font-medium">Recent executions</span>
                            <div className="space-y-0.5 mt-1">
                              {jobLogs.slice(0, 5).map((log) => (
                                <div key={log.id} className="flex items-center gap-2 text-[10px]">
                                  {log.status === "success" ? (
                                    <CheckCircle2 size={10} className="text-success flex-shrink-0" />
                                  ) : (
                                    <XCircle size={10} className="text-danger flex-shrink-0" />
                                  )}
                                  <span className="text-text-tertiary">{new Date(log.started_at).toLocaleString()}</span>
                                  {log.error && <span className="text-danger truncate max-w-[200px]">{log.error}</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {jobLogs.length === 0 && (
                          <p className="text-[10px] text-text-tertiary mt-1">No execution logs in the last 7 days</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
