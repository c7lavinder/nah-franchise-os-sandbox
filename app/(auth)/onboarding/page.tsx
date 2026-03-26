"use client";

/**
 * Onboarding Pipeline — Phase 4
 *
 * Shows franchisees in their post-close journey:
 * - Onboarding track (first 90 days, 7 stages)
 * - Coaching track (ongoing quarterly, 6 stages)
 */

import { useState, useEffect, useCallback } from "react";
import { GraduationCap, RefreshCw, Plus, ChevronRight, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import type { OnboardingEnrollment } from "@/lib/intelligence/onboarding";
import { ONBOARDING_STAGES, COACHING_STAGES } from "@/lib/intelligence/onboarding";

type PipelineFilter = "onboarding" | "coaching" | "all";

export default function OnboardingPage() {
  const [enrollments, setEnrollments] = useState<OnboardingEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<PipelineFilter>("onboarding");

  const fetchData = useCallback(async () => {
    try {
      const typeParam = filter === "all" ? "" : `?type=${filter}`;
      const res = await fetch(`/api/intelligence/onboarding${typeParam}`);
      if (res.ok) {
        const data = await res.json();
        setEnrollments(data.enrollments ?? []);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const stages = filter === "coaching" ? COACHING_STAGES : ONBOARDING_STAGES;
  const activeCount = enrollments.filter((e) => e.status === "active").length;
  const interventionCount = enrollments.filter((e) => e.status === "intervention").length;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between px-1 py-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <GraduationCap size={20} className="text-nah-blue" />
          <h1 className="font-headline text-page-title text-text-primary">Onboarding</h1>
          <span className="text-caption text-text-tertiary ml-1">{enrollments.length} franchisees</span>
        </div>
        <button
          className="btn-ghost p-1.5"
          onClick={() => { setLoading(true); void fetchData(); }}
        >
          <RefreshCw size={16} className={loading ? "animate-spin text-nah-blue" : "text-text-secondary"} />
        </button>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 mb-4 flex-shrink-0">
        <StatBadge label="Active" value={activeCount} color="#059669" />
        {interventionCount > 0 && (
          <StatBadge label="Needs Help" value={interventionCount} color="#ef4444" />
        )}
      </div>

      {/* Pipeline filter */}
      <div className="flex items-center gap-1 mb-4 flex-shrink-0">
        {(["onboarding", "coaching", "all"] as PipelineFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-body-sm capitalize transition-colors ${
              filter === f
                ? "bg-nah-blue text-white"
                : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Stage pipeline visual */}
      <div className="border border-border-default rounded-lg overflow-hidden flex-1 min-h-0 overflow-y-auto">
        {/* Stage headers */}
        <div className="flex border-b border-border-default bg-bg-tertiary">
          {stages.map((stage) => {
            const count = enrollments.filter((e) => e.current_stage === stage.number).length;
            return (
              <div key={stage.number} className="flex-1 px-3 py-2 border-r border-border-default last:border-r-0 min-w-[140px]">
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-nah-blue/10 text-nah-blue text-[10px] font-bold flex items-center justify-center">
                    {stage.number}
                  </span>
                  <span className="text-caption font-semibold text-text-primary truncate">{stage.name}</span>
                </div>
                <p className="text-[10px] text-text-tertiary mt-0.5 truncate">{stage.description}</p>
                {count > 0 && (
                  <span className="text-badge text-nah-blue mt-1 block">{count}</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Enrollee cards in their stages */}
        <div className="flex min-h-[300px]">
          {stages.map((stage) => {
            const stageEnrollments = enrollments.filter((e) => e.current_stage === stage.number);
            return (
              <div key={stage.number} className="flex-1 p-2 border-r border-border-default last:border-r-0 min-w-[140px] space-y-2">
                {stageEnrollments.map((e) => (
                  <EnrollmentCard key={e.id} enrollment={e} />
                ))}
              </div>
            );
          })}
        </div>

        {/* Empty state */}
        {enrollments.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <GraduationCap size={40} className="text-text-tertiary mb-3" />
            <p className="text-body text-text-secondary mb-1">No franchisees in onboarding</p>
            <p className="text-body-sm text-text-tertiary">
              Franchisees appear here when they reach Closed Won in the sales pipeline.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Single franchisee card in the pipeline */
function EnrollmentCard({ enrollment }: { enrollment: OnboardingEnrollment }) {
  const isIntervention = enrollment.status === "intervention";
  const isComplete = enrollment.status === "complete";

  return (
    <div
      className={`px-3 py-2 rounded-md border text-left transition-colors ${
        isIntervention
          ? "border-danger/30 bg-danger/5"
          : isComplete
          ? "border-success/30 bg-success/5"
          : "border-border-default bg-surface-glass hover:border-border-hover"
      }`}
    >
      <p className="text-body-sm font-medium text-text-primary truncate">
        {enrollment.franchisee_name}
      </p>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-caption text-text-tertiary flex items-center gap-0.5">
          <Clock size={10} /> {enrollment.days_in_stage}d
        </span>
        {isIntervention && (
          <AlertTriangle size={12} className="text-danger" />
        )}
        {isComplete && (
          <CheckCircle2 size={12} className="text-success" />
        )}
      </div>
    </div>
  );
}

function StatBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-md border"
      style={{ background: `${color}08`, borderColor: `${color}20` }}
    >
      <span className="text-body-sm text-text-secondary">{label}:</span>
      <span className="text-body-sm font-semibold" style={{ color }}>{value}</span>
    </div>
  );
}
