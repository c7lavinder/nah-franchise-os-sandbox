"use client";

/**
 * CronCalendar — weekly grid showing scheduled cron job executions.
 * Reads from cron_job_log table for recent executions.
 */

import { useState, useEffect } from "react";
import { Loader2, Clock, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

interface CronJob {
  id: string;
  job_name: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "success" | "failed";
  error: string | null;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const STATUS_COLORS: Record<string, string> = {
  success: "bg-success/20 border-success/40 text-success",
  failed: "bg-danger/20 border-danger/40 text-danger",
  running: "bg-info/20 border-info/40 text-info",
};

export default function CronCalendar() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<CronJob | null>(null);

  useEffect(() => {
    fetch("/api/settings/cron-jobs")
      .then((r) => (r.ok ? r.json() : { jobs: [] }))
      .then((d) => setJobs(d.jobs ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-text-tertiary" />
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Clock size={32} className="text-text-tertiary mb-3" />
        <p className="text-body-sm text-text-tertiary">No scheduled jobs configured</p>
        <p className="text-caption text-text-tertiary mt-1">
          Cron jobs will appear here once they are set up in vercel.json or the database.
        </p>
      </div>
    );
  }

  // Group jobs by day-of-week and hour
  const grid: Map<string, CronJob[]> = new Map();
  for (const job of jobs) {
    const d = new Date(job.started_at);
    const dayIdx = (d.getDay() + 6) % 7; // Mon=0
    const hour = d.getHours();
    const key = `${dayIdx}-${hour}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key)!.push(job);
  }

  return (
    <div>
      {/* Grid */}
      <div className="overflow-x-auto">
        <div className="grid grid-cols-[60px_repeat(7,1fr)] gap-px bg-border-default/50 rounded-lg overflow-hidden min-w-[700px]">
          {/* Header row */}
          <div className="bg-bg-secondary p-2" />
          {DAYS.map((d) => (
            <div key={d} className="bg-bg-secondary p-2 text-center text-caption font-medium text-text-secondary">
              {d}
            </div>
          ))}

          {/* Hour rows (show every 3 hours for compactness) */}
          {HOURS.filter((h) => h % 3 === 0).map((hour) => (
            <>
              <div key={`h-${hour}`} className="bg-bg-primary p-2 text-[10px] text-text-tertiary text-right">
                {hour.toString().padStart(2, "0")}:00
              </div>
              {Array.from({ length: 7 }, (_, dayIdx) => {
                // Collect jobs in this 3-hour block
                const blockJobs: CronJob[] = [];
                for (let h = hour; h < hour + 3; h++) {
                  blockJobs.push(...(grid.get(`${dayIdx}-${h}`) ?? []));
                }
                return (
                  <div key={`${dayIdx}-${hour}`} className="bg-bg-primary p-1 min-h-[40px]">
                    {blockJobs.map((job) => (
                      <button
                        key={job.id}
                        onClick={() => setSelectedJob(job)}
                        className={`w-full text-left text-[10px] px-1.5 py-0.5 rounded border mb-0.5 truncate ${STATUS_COLORS[job.status] ?? ""}`}
                      >
                        {job.job_name}
                      </button>
                    ))}
                  </div>
                );
              })}
            </>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4">
        <div className="flex items-center gap-1 text-caption text-text-tertiary">
          <CheckCircle2 size={12} className="text-success" /> Success
        </div>
        <div className="flex items-center gap-1 text-caption text-text-tertiary">
          <XCircle size={12} className="text-danger" /> Failed
        </div>
        <div className="flex items-center gap-1 text-caption text-text-tertiary">
          <AlertTriangle size={12} className="text-info" /> Running
        </div>
      </div>

      {/* Job detail panel */}
      {selectedJob && (
        <div className="mt-4 p-4 bg-bg-secondary border border-border-default rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-body-sm font-medium text-text-primary">{selectedJob.job_name}</h3>
            <button onClick={() => setSelectedJob(null)} className="text-text-tertiary hover:text-text-primary text-caption">Close</button>
          </div>
          <div className="space-y-1 text-caption text-text-secondary">
            <p>Status: <span className={selectedJob.status === "success" ? "text-success" : selectedJob.status === "failed" ? "text-danger" : "text-info"}>{selectedJob.status}</span></p>
            <p>Started: {new Date(selectedJob.started_at).toLocaleString()}</p>
            {selectedJob.finished_at && (
              <p>Finished: {new Date(selectedJob.finished_at).toLocaleString()}</p>
            )}
            {selectedJob.finished_at && selectedJob.started_at && (
              <p>Duration: {Math.round((new Date(selectedJob.finished_at).getTime() - new Date(selectedJob.started_at).getTime()) / 1000)}s</p>
            )}
            {selectedJob.error && (
              <p className="text-danger mt-1">Error: {selectedJob.error}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
