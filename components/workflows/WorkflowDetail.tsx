"use client";

/**
 * WorkflowDetail — right panel showing selected workflow details,
 * enrollment list, and Scout intelligence summary.
 */

import { useState, useEffect, useCallback } from "react";
import { Users, Calendar, Target, TrendingUp, Clock, AlertTriangle, UserPlus } from "lucide-react";
import ReenrollContactModal from "./ReenrollContactModal";
import type { Workflow, WorkflowEnrollment } from "@/lib/workflows/types";

/** Health score descriptions for plain-language display */
const HEALTH_DESCRIPTIONS: Record<string, string> = {
  A: "Performing above benchmark on all metrics. No action needed.",
  B: "Meeting expectations. Monitor for any changes.",
  C: "Average performance. Scout may suggest improvements soon.",
  D: "Underperforming. Scout has flagged issues and drafted rewrites.",
  F: "Needs immediate attention. Critical metrics are below threshold.",
};

interface WorkflowDetailProps {
  workflow: Workflow;
}

export default function WorkflowDetail({ workflow }: WorkflowDetailProps) {
  const [enrollments, setEnrollments] = useState<WorkflowEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [reenrollOpen, setReenrollOpen] = useState(false);

  const fetchEnrollments = useCallback(async () => {
    try {
      const res = await fetch(`/api/workflows/enrollments?workflowId=${workflow.id}&status=active,paused`);
      if (res.ok) {
        const data = await res.json();
        setEnrollments(data.enrollments ?? []);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [workflow.id]);

  useEffect(() => {
    setLoading(true);
    void fetchEnrollments();
  }, [fetchEnrollments]);

  const healthDesc = HEALTH_DESCRIPTIONS[workflow.health_score] ?? HEALTH_DESCRIPTIONS.C;
  const exitConditions = (workflow.exit_conditions ?? {}) as { maxDays?: number; goal?: string };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-border-default">
        <h2 className="font-headline text-section-title text-text-primary mb-1">
          {workflow.name}
        </h2>
        {workflow.description && (
          <p className="text-body text-text-secondary mb-3">{workflow.description}</p>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={Users} label="Active" value={String(workflow.active_enrollee_count)} />
          <StatCard
            icon={Target}
            label="Health"
            value={workflow.health_score}
            valueColor={
              workflow.health_score === "A" || workflow.health_score === "B"
                ? "#059669"
                : workflow.health_score === "C"
                ? "#d97706"
                : "#ef4444"
            }
          />
          {workflow.primary_metric_name && (
            <StatCard
              icon={TrendingUp}
              label={workflow.primary_metric_name}
              value={workflow.primary_metric_value !== null ? `${workflow.primary_metric_value}%` : "—"}
            />
          )}
          {exitConditions.maxDays && (
            <StatCard icon={Calendar} label="Duration" value={`${exitConditions.maxDays} days`} />
          )}
        </div>
      </div>

      {/* Health assessment */}
      <div className="px-5 py-4 border-b border-border-default">
        <div className="flex items-start gap-2">
          {(workflow.health_score === "D" || workflow.health_score === "F") ? (
            <AlertTriangle size={16} className="text-danger mt-0.5 flex-shrink-0" />
          ) : (
            <Target size={16} className="text-nah-blue mt-0.5 flex-shrink-0" />
          )}
          <div>
            <p className="text-body-sm font-semibold text-text-primary mb-0.5">Scout Assessment</p>
            <p className="text-body-sm text-text-secondary">{healthDesc}</p>
          </div>
        </div>
      </div>

      {/* Active enrollments */}
      <div className="px-5 py-4 flex-1">
        <div className="flex items-center justify-between mb-3">
          <p className="text-label-caps text-text-tertiary">
            ACTIVE ENROLLMENTS ({enrollments.length})
          </p>
          {workflow.current_version_id && (
            <button
              onClick={() => setReenrollOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-caption text-nah-blue hover:bg-nah-blue/5 transition-colors"
            >
              <UserPlus size={12} />
              Enroll contact
            </button>
          )}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-bg-tertiary rounded-md animate-pulse" />
            ))}
          </div>
        ) : enrollments.length === 0 ? (
          <p className="text-body-sm text-text-tertiary py-4 text-center">
            No contacts currently enrolled
          </p>
        ) : (
          <div className="space-y-2">
            {enrollments.map((enrollment) => (
              <EnrollmentRow key={enrollment.id} enrollment={enrollment} />
            ))}
          </div>
        )}
      </div>

      {reenrollOpen && workflow.current_version_id && (
        <ReenrollContactModal
          workflowId={workflow.id}
          workflowVersionId={workflow.current_version_id}
          workflowName={workflow.name}
          onClose={() => setReenrollOpen(false)}
          onEnrolled={() => {
            setReenrollOpen(false);
            void fetchEnrollments();
          }}
        />
      )}
    </div>
  );
}

/** Small stat card used in the detail header */
function StatCard({
  icon: Icon,
  label,
  value,
  valueColor,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="rounded-lg bg-bg-tertiary border border-border-default p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={13} className="text-text-tertiary" />
        <span className="text-caption text-text-tertiary">{label}</span>
      </div>
      <p className="text-metric-sm" style={{ color: valueColor ?? "#1e293b" }}>
        {value}
      </p>
    </div>
  );
}

/** Single enrollment row */
function EnrollmentRow({ enrollment }: { enrollment: WorkflowEnrollment }) {
  const isPaused = enrollment.status === "paused";

  return (
    <div
      className={`flex items-center justify-between px-3 py-2.5 rounded-md border transition-colors ${
        isPaused
          ? "border-warning/20 bg-warning/5"
          : "border-border-default bg-surface-glass"
      }`}
    >
      <div>
        <p className="text-body-sm font-medium text-text-primary">
          {enrollment.contact_name ?? enrollment.ghl_contact_id}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-caption text-text-tertiary flex items-center gap-1">
            <Clock size={11} /> Day {enrollment.current_day}
          </span>
          {isPaused && (
            <span className="text-badge text-warning">Paused</span>
          )}
        </div>
      </div>
      {enrollment.goal_achieved && (
        <span className="text-badge text-success bg-success/10 px-2 py-0.5 rounded-sm">
          Goal Met
        </span>
      )}
    </div>
  );
}
