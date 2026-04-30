"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

/**
 * WorkflowDetail — right panel showing the full workflow at a glance:
 * trigger, every step with content, day/time, type, and enrollments.
 */

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Calendar,
  Target,
  Clock,
  AlertTriangle,
  UserPlus,
  Zap,
  MessageSquare,
  Mail,
  PhoneCall,
  Bell,
  Bot,
  GitBranch,
  ArrowRight,
  BookOpen,
} from "lucide-react";
import ReenrollContactModal from "./ReenrollContactModal";
import type { Workflow, WorkflowEnrollment, WorkflowStep, WorkflowStepType } from "@/lib/workflows/types";

/** Trigger type → human-readable label */
const TRIGGER_LABELS: Record<string, string> = {
  "stage_entry:new_lead": "New Prospect enters pipeline",
  "stage_entry:qualified": "Prospect qualified",
  "stage_entry:fdd_delivered": "FDD delivered",
  "stage_entry:funds_received": "Funds received (closed won)",
  appointment_created: "Appointment created",
  call_completed: "Call completed",
  trainual_access_granted: "Trainual access granted",
  manual_enrollment: "Manual enrollment",
  tag_added: "Tag added to contact",
};

/** Step type config for icons and labels */
const STEP_TYPE_CONFIG: Record<
  WorkflowStepType,
  {
    icon: React.ComponentType<{ size?: number; className?: string }>;
    label: string;
    color: string;
  }
> = {
  sms: { icon: MessageSquare, label: "SMS", color: "#059669" },
  email: { icon: Mail, label: "Email", color: "#00a1e1" },
  chad_call_task: { icon: PhoneCall, label: "Chad Call", color: "#f5a800" },
  team_notify: { icon: Bell, label: "Notify Team", color: "#8b5cf6" },
  ai_agent_action: { icon: Bot, label: "Scout AI", color: "#00a1e1" },
  condition_check: { icon: GitBranch, label: "Condition", color: "#64748b" },
  stage_move_suggestion: { icon: ArrowRight, label: "Stage Move", color: "#ef4444" },
  trainual_check: { icon: BookOpen, label: "Trainual Check", color: "#059669" },
};

/** Health score descriptions */
const HEALTH_DESCRIPTIONS: Record<string, string> = {
  A: "Performing above benchmark on all metrics.",
  B: "Meeting expectations. Monitor for changes.",
  C: "Average performance. May need improvement.",
  D: "Underperforming. Scout has flagged issues.",
  F: "Needs immediate attention.",
};

interface WorkflowDetailProps {
  workflow: Workflow;
}

export default function WorkflowDetail({ workflow }: WorkflowDetailProps) {
  const [enrollments, setEnrollments] = useState<WorkflowEnrollment[]>([]);
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [loadingEnrollments, setLoadingEnrollments] = useState(true);
  const [loadingSteps, setLoadingSteps] = useState(true);
  const [reenrollOpen, setReenrollOpen] = useState(false);

  const fetchEnrollments = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/workflows/enrollments?workflowId=${workflow.id}&status=active,paused`);
      if (res.ok) {
        const data = await res.json();
        setEnrollments(data.enrollments ?? []);
      }
    } catch {
      /* silent */
    }
    setLoadingEnrollments(false);
  }, [workflow.id]);

  const fetchSteps = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/workflows/${workflow.id}/steps`);
      if (res.ok) {
        const data = await res.json();
        setSteps(data.steps ?? []);
      }
    } catch {
      /* silent */
    }
    setLoadingSteps(false);
  }, [workflow.id]);

  useEffect(() => {
    setLoadingEnrollments(true);
    setLoadingSteps(true);
    void fetchEnrollments();
    void fetchSteps();
  }, [fetchEnrollments, fetchSteps]);

  const triggerLabel = TRIGGER_LABELS[workflow.trigger_type] ?? workflow.trigger_type;
  const healthDesc = HEALTH_DESCRIPTIONS[workflow.health_score] ?? HEALTH_DESCRIPTIONS.C;
  const exitConditions = (workflow.exit_conditions ?? {}) as { maxDays?: number; goal?: string };

  // Group steps by day
  const dayGroups = new Map<number, WorkflowStep[]>();
  for (const step of steps) {
    if (!dayGroups.has(step.day_number)) dayGroups.set(step.day_number, []);
    dayGroups.get(step.day_number)!.push(step);
  }
  const sortedDays = Array.from(dayGroups.keys()).sort((a, b) => a - b);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-border-default">
        <h2 className="font-headline text-section-title text-text-primary mb-1">{workflow.name}</h2>
        {workflow.description && <p className="text-body text-text-secondary mb-3">{workflow.description}</p>}

        {/* Trigger */}
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-md bg-[rgba(245,168,0,0.06)] border border-[rgba(245,168,0,0.15)]">
          <Zap size={14} className="text-warning flex-shrink-0" />
          <span className="text-body-sm text-text-secondary">Trigger:</span>
          <span className="text-body-sm font-medium text-text-primary">{triggerLabel}</span>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          <StatCard icon={Users} label="Enrolled" value={String(workflow.active_enrollee_count)} />
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
          {exitConditions.maxDays && <StatCard icon={Calendar} label="Duration" value={`${exitConditions.maxDays}d`} />}
        </div>
      </div>

      {/* Health note (compact) */}
      {(workflow.health_score === "D" || workflow.health_score === "F") && (
        <div className="px-5 py-3 border-b border-border-default">
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="text-danger mt-0.5 flex-shrink-0" />
            <p className="text-caption text-text-secondary">{healthDesc}</p>
          </div>
        </div>
      )}

      {/* Step timeline — the main event */}
      <div className="px-5 py-4 border-b border-border-default">
        <p className="text-label-caps text-text-tertiary mb-3">
          SEQUENCE ({steps.length} steps across {sortedDays.length} days)
        </p>

        {loadingSteps ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-bg-tertiary rounded-md animate-pulse" />
            ))}
          </div>
        ) : steps.length === 0 ? (
          <p className="text-body-sm text-text-tertiary py-4 text-center">
            No steps defined yet. Open the builder to add steps.
          </p>
        ) : (
          <div className="space-y-1">
            {sortedDays.map((day) => {
              const daySteps = dayGroups.get(day) ?? [];
              return (
                <div key={day}>
                  {/* Day header */}
                  <div className="flex items-center gap-2 mb-1.5 mt-2 first:mt-0">
                    <div className="w-7 h-7 rounded-full bg-nah-blue/10 border border-nah-blue/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-[11px] font-bold text-nah-blue">{day}</span>
                    </div>
                    <span className="text-caption font-medium text-text-secondary">Day {day}</span>
                    <div className="flex-1 border-t border-border-default" />
                  </div>

                  {/* Steps for this day */}
                  <div className="ml-9 space-y-1.5 mb-2">
                    {daySteps.map((step) => {
                      const config = STEP_TYPE_CONFIG[step.step_type] ?? STEP_TYPE_CONFIG.sms;
                      const Icon = config.icon;
                      return (
                        <div
                          key={step.id}
                          className="px-3 py-2.5 rounded-lg border border-border-default bg-surface-glass"
                        >
                          {/* Type + time row */}
                          <div className="flex items-center gap-2 mb-1">
                            <div
                              className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                              style={{ background: `${config.color}15`, color: config.color }}
                            >
                              <Icon size={12} />
                            </div>
                            <span className="text-badge font-semibold" style={{ color: config.color }}>
                              {config.label}
                            </span>
                            {step.send_time && (
                              <span className="text-caption text-text-tertiary flex items-center gap-0.5">
                                <Clock size={10} /> {step.send_time}
                              </span>
                            )}
                            {step.requires_confirmation && (
                              <span className="text-[10px] text-warning bg-warning/10 px-1.5 py-0.5 rounded-sm ml-auto">
                                Needs confirm
                              </span>
                            )}
                          </div>

                          {/* Subject (email) */}
                          {step.subject && (
                            <p className="text-caption font-medium text-text-primary mb-0.5">Subject: {step.subject}</p>
                          )}

                          {/* Content */}
                          {step.content ? (
                            <p className="text-body-sm text-text-secondary whitespace-pre-wrap">{step.content}</p>
                          ) : (
                            <p className="text-caption text-text-tertiary italic">No content yet</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Active enrollments */}
      <div className="px-5 py-4 flex-1">
        <div className="flex items-center justify-between mb-3">
          <p className="text-label-caps text-text-tertiary">ACTIVE ENROLLMENTS ({enrollments.length})</p>
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

        {loadingEnrollments ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-bg-tertiary rounded-md animate-pulse" />
            ))}
          </div>
        ) : enrollments.length === 0 ? (
          <p className="text-body-sm text-text-tertiary py-4 text-center">No contacts currently enrolled</p>
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

/** Small stat card */
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
    <div className="rounded-lg bg-bg-tertiary border border-border-default p-2.5">
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon size={12} className="text-text-tertiary" />
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
        isPaused ? "border-warning/20 bg-warning/5" : "border-border-default bg-surface-glass"
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
          {isPaused && <span className="text-badge text-warning">Paused</span>}
        </div>
      </div>
      {enrollment.goal_achieved && (
        <span className="text-badge text-success bg-success/10 px-2 py-0.5 rounded-sm">Goal Met</span>
      )}
    </div>
  );
}
