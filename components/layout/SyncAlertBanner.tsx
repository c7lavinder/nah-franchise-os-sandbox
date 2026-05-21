"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { apiFetch } from "@/lib/auth/api-fetch";

interface FailingJob {
  job: string;
  since: string;
  consecutiveFailures: number;
  error: string;
}

export default function SyncAlertBanner() {
  const [failing, setFailing] = useState<FailingJob[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function check() {
      try {
        const res = await apiFetch("/api/admin/sync-status");
        if (!res.ok) return;
        const data = await res.json();
        if (mounted && !data.healthy) {
          setFailing(data.failing);
        }
      } catch {
        // Silently fail — this is a nice-to-have banner
      }
    }

    check();
    // Re-check every 15 minutes
    const interval = setInterval(check, 15 * 60 * 1000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (dismissed || failing.length === 0) return null;

  const jobNames = failing.map((f) => f.job).join(", ");

  return (
    <div className="bg-status-danger/10 border border-status-danger/30 rounded-xl px-4 py-3 mb-4 flex items-start gap-3">
      <AlertTriangle size={18} className="text-status-danger mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-status-danger">MasterSuite sync failing: {jobNames}</p>
        <p className="text-xs text-text-secondary mt-0.5">{failing[0].error.slice(0, 120)}</p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-text-tertiary hover:text-text-primary shrink-0"
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  );
}
