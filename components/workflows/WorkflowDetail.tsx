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
  CalendarPlus,
  AlarmClock,
  StickyNote,
  Tag,
  XCircle,
  UserCog,
  ArrowRightLeft,
  Workflow as WorkflowIcon,
  Send,
  ChevronDown,
  ChevronUp,
  Shield,
  Play,
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
  chad_call_task: { icon: PhoneCall, label: "Task", color: "#f5a800" },
  team_notify: { icon: Bell, label: "Notify Team", color: "#8b5cf6" },
  ai_agent_action: { icon: Bot, label: "Scout AI", color: "#00a1e1" },
  condition_check: { icon: GitBranch, label: "Condition", color: "#64748b" },
  stage_move_suggestion: { icon: ArrowRight, label: "Stage Move", color: "#ef4444" },
  trainual_check: { icon: BookOpen, label: "Trainual Check", color: "#059669" },
  appointment: { icon: CalendarPlus, label: "Appointment", color: "#7c3aed" },
  send_reminder: { icon: AlarmClock, label: "Reminder", color: "#f5a800" },
  internal_note: { icon: StickyNote, label: "Note", color: "#64748b" },
  add_tag: { icon: Tag, label: "Add Tag", color: "#059669" },
  remove_tag: { icon: XCircle, label: "Remove Tag", color: "#ef4444" },
  update_contact: { icon: UserCog, label: "Update Contact", color: "#00a1e1" },
  pipeline_move: { icon: ArrowRightLeft, label: "Pipeline Move", color: "#8b5cf6" },
  trigger_workflow: { icon: WorkflowIcon, label: "Trigger Workflow", color: "#f97316" },
};

/** Health score descriptions */
const HEALTH_DESCRIPTIONS: Record<string, string> = {
  A: "Performing above benchmark on all metrics.",
  B: "Meeting expectations. Monitor for changes.",
  C: "Average performance. May need improvement.",
  D: "Underperforming. Scout has flagged issues.",
  F: "Needs immediate attention.",
};

interface DryRunStep {
  stepType: string;
  sendTime: string | null;
  from: string | null;
  to: string | null;
  subject: string | null;
  content: string;
  needsApproval: boolean;
  executionMode: string;
}

interface DryRunResult {
  workflowName: string;
  contactName: string;
  trigger: string;
  exitCondition: string;
  totalDays: number;
  totalSteps: number;
  timeline: { day: number; steps: DryRunStep[] }[];
}

interface ActivityEntry {
  id: string;
  contactName: string;
  stepType: string;
  subject: string | null;
  content: string | null;
  sendTime: string | null;
  status: "executed" | "queued" | "rejected" | "failed";
  delivered: boolean;
  opened: boolean;
  responded: boolean;
  executedAt: string | null;
  createdAt: string;
  error?: string;
}

interface WorkflowDetailProps {
  workflow: Workflow;
  onStatusChange?: (workflowId: string, newStatus: string) => Promise<void>;
}

export default function WorkflowDetail({ workflow, onStatusChange }: WorkflowDetailProps) {
  const [changingStatus, setChangingStatus] = useState(false);
  const [enrollments, setEnrollments] = useState<WorkflowEnrollment[]>([]);
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [loadingEnrollments, setLoadingEnrollments] = useState(true);
  const [loadingSteps, setLoadingSteps] = useState(true);
  const [stepsError, setStepsError] = useState(false);
  const [reenrollOpen, setReenrollOpen] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [dryRunLoading, setDryRunLoading] = useState(false);
  const [showDryRun, setShowDryRun] = useState(false);

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
    setStepsError(false);
    try {
      const res = await apiFetch(`/api/workflows/${workflow.id}/steps`);
      if (res.ok) {
        const data = await res.json();
        setSteps(data.steps ?? []);
      } else {
        setStepsError(true);
      }
    } catch {
      setStepsError(true);
    }
    setLoadingSteps(false);
  }, [workflow.id]);

  const fetchActivity = useCallback(async () => {
    setLoadingActivity(true);
    try {
      const res = await apiFetch(`/api/workflows/${workflow.id}/activity`);
      if (res.ok) {
        const data = await res.json();
        setActivity(data.activity ?? []);
      }
    } catch {
      /* silent */
    }
    setLoadingActivity(false);
  }, [workflow.id]);

  useEffect(() => {
    setLoadingEnrollments(true);
    setLoadingSteps(true);
    void fetchEnrollments();
    void fetchSteps();
  }, [fetchEnrollments, fetchSteps]);

  const triggerConfig = (workflow.trigger_config ?? {}) as { event?: string; description?: string };
  const triggerLabel = triggerConfig.description ?? TRIGGER_LABELS[workflow.trigger_type] ?? workflow.trigger_type;
  const healthDesc = HEALTH_DESCRIPTIONS[workflow.health_score] ?? HEALTH_DESCRIPTIONS.C;
  const exitConditions = (workflow.exit_conditions ?? {}) as { maxDays?: number; description?: string; goal?: string };

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

        {/* Exit conditions */}
        {exitConditions.description && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-md bg-bg-tertiary border border-border-default">
            <Target size={14} className="text-text-tertiary flex-shrink-0" />
            <span className="text-body-sm text-text-secondary">Exit:</span>
            <span className="text-body-sm text-text-primary">{exitConditions.description}</span>
          </div>
        )}

        {/* Status controls */}
        {onStatusChange && (
          <div className="flex items-center gap-2 mb-3">
            {workflow.status === "draft" && (
              <button
                disabled={changingStatus || steps.length === 0}
                onClick={async () => {
                  setChangingStatus(true);
                  await onStatusChange(workflow.id, "live");
                  setChangingStatus(false);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-success text-white text-button hover:bg-success/90 transition-colors disabled:opacity-50"
              >
                <Zap size={14} />
                {changingStatus ? "Going Live..." : "Go Live"}
              </button>
            )}
            {workflow.status === "live" && (
              <button
                disabled={changingStatus}
                onClick={async () => {
                  setChangingStatus(true);
                  await onStatusChange(workflow.id, "paused");
                  setChangingStatus(false);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-warning/10 border border-warning/30 text-warning text-button hover:bg-warning/20 transition-colors disabled:opacity-50"
              >
                Pause
              </button>
            )}
            {workflow.status === "paused" && (
              <button
                disabled={changingStatus}
                onClick={async () => {
                  setChangingStatus(true);
                  await onStatusChange(workflow.id, "live");
                  setChangingStatus(false);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-success text-white text-button hover:bg-success/90 transition-colors disabled:opacity-50"
              >
                <Zap size={14} />
                {changingStatus ? "Resuming..." : "Resume"}
              </button>
            )}
            <span className="text-caption text-text-tertiary capitalize px-2 py-1 bg-bg-tertiary rounded">
              {workflow.status}
            </span>
            {steps.length > 0 && (
              <button
                disabled={dryRunLoading}
                onClick={async () => {
                  if (showDryRun) {
                    setShowDryRun(false);
                    return;
                  }
                  setDryRunLoading(true);
                  try {
                    const res = await apiFetch(`/api/workflows/${workflow.id}/dry-run`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ contactName: "John Smith" }),
                    });
                    if (res.ok) {
                      const data = await res.json();
                      setDryRunResult(data);
                      setShowDryRun(true);
                    }
                  } catch {
                    /* silent */
                  }
                  setDryRunLoading(false);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-bg-tertiary border border-border-default text-text-secondary text-button hover:bg-bg-secondary transition-colors disabled:opacity-50 ml-auto"
              >
                <Play size={13} />
                {dryRunLoading ? "Simulating..." : showDryRun ? "Hide Test" : "Test Run"}
              </button>
            )}
          </div>
        )}

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

      {/* Dry Run Results */}
      {showDryRun && dryRunResult && (
        <div className="px-5 py-4 border-b border-border-default bg-nah-blue/[0.02]">
          <div className="flex items-center gap-2 mb-3">
            <Play size={14} className="text-nah-blue" />
            <p className="text-label-caps text-nah-blue">TEST RUN: {dryRunResult.contactName}</p>
            <span className="text-caption text-text-tertiary ml-auto">
              {dryRunResult.totalSteps} steps across {dryRunResult.totalDays} days
            </span>
          </div>

          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {dryRunResult.timeline.map((day) => (
              <div key={day.day}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-caption font-semibold text-nah-blue bg-nah-blue/10 px-2 py-0.5 rounded-full">
                    Day {day.day}
                  </span>
                  <div className="flex-1 h-px bg-border-default" />
                </div>
                <div className="space-y-1.5 ml-4">
                  {day.steps.map((step, i) => {
                    const config = STEP_TYPE_CONFIG[step.stepType as WorkflowStepType] ?? STEP_TYPE_CONFIG.sms;
                    const StepIcon = config.icon;
                    return (
                      <div key={i} className="px-3 py-2 rounded-md border border-border-default bg-bg-primary">
                        <div className="flex items-center gap-2 mb-1">
                          <span style={{ color: config.color }}>
                            <StepIcon size={12} />
                          </span>
                          <span className="text-body-sm font-medium text-text-primary">{config.label}</span>
                          {step.sendTime && <span className="text-caption text-text-tertiary">@ {step.sendTime}</span>}
                          <span
                            className={`text-[10px] ml-auto ${step.needsApproval ? "text-warning" : "text-success"}`}
                          >
                            {step.needsApproval ? "Needs your approval" : "Auto-fires"}
                          </span>
                        </div>
                        {step.from && (
                          <div className="text-caption text-text-secondary mb-0.5">
                            <span className="font-medium text-text-primary">{step.from}</span>
                            {" \u2192 "}
                            <span>{step.to}</span>
                          </div>
                        )}
                        {!step.from && step.to && (
                          <div className="text-caption text-text-secondary mb-0.5">{step.to}</div>
                        )}
                        {step.subject && <p className="text-caption text-text-tertiary">Subject: {step.subject}</p>}
                        {step.content && (
                          <p className="text-body-sm text-text-secondary mt-0.5 whitespace-pre-wrap">{step.content}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <p className="text-caption text-text-tertiary mt-3 text-center">Exit: {dryRunResult.exitCondition}</p>
        </div>
      )}

      {/* Health note (compact) */}
      {(workflow.health_score === "D" || workflow.health_score === "F") && (
        <div className="px-5 py-3 border-b border-border-default">
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="text-danger mt-0.5 flex-shrink-0" />
            <p className="text-caption text-text-secondary">{healthDesc}</p>
          </div>
        </div>
      )}

      {/* Execution Blueprint */}
      <div className="px-5 py-4 border-b border-border-default">
        <p className="text-label-caps text-text-tertiary mb-3">
          EXECUTION BLUEPRINT ({steps.length} steps across {sortedDays.length} days)
        </p>

        {loadingSteps ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-bg-tertiary rounded-md animate-pulse" />
            ))}
          </div>
        ) : stepsError ? (
          <div className="flex items-center gap-2 py-4 px-3 rounded-md bg-danger/5 border border-danger/20">
            <AlertTriangle size={14} className="text-danger flex-shrink-0" />
            <p className="text-body-sm text-danger">Failed to load steps. Try refreshing.</p>
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
                    {daySteps.map((step) => (
                      <BlueprintStepCard key={step.id} step={step} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Activity Log */}
      <div className="px-5 py-3 border-b border-border-default">
        <button
          onClick={() => {
            if (!showActivity) void fetchActivity();
            setShowActivity(!showActivity);
          }}
          className="flex items-center gap-2 w-full text-left"
        >
          {showActivity ? (
            <ChevronUp size={14} className="text-text-tertiary" />
          ) : (
            <ChevronDown size={14} className="text-text-tertiary" />
          )}
          <p className="text-label-caps text-text-tertiary">
            RECENT ACTIVITY {activity.length > 0 ? `(${activity.length})` : ""}
          </p>
        </button>

        {showActivity && (
          <div className="mt-3">
            {loadingActivity ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 bg-bg-tertiary rounded-md animate-pulse" />
                ))}
              </div>
            ) : activity.length === 0 ? (
              <p className="text-body-sm text-text-tertiary py-3 text-center">
                No activity yet. Steps will appear here once the workflow is live and enrollments are active.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                {activity.map((entry) => (
                  <ActivityRow key={entry.id} entry={entry} />
                ))}
              </div>
            )}
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

/** Auto-execute step types (no human confirmation needed) */
const AUTO_EXECUTE_TYPES: WorkflowStepType[] = [
  "chad_call_task",
  "team_notify",
  "ai_agent_action",
  "condition_check",
  "trainual_check",
  "appointment",
  "send_reminder",
  "internal_note",
  "add_tag",
  "remove_tag",
  "update_contact",
  "pipeline_move",
  "trigger_workflow",
];

/** Extract sender/recipient info from a step for the blueprint display */
function getStepRouting(step: WorkflowStep): { from: string | null; to: string } {
  const config = (step.condition_config ?? {}) as Record<string, unknown>;
  const senderName = config.senderName as string | undefined;
  const fromNumber = config.fromNumber as string | undefined;
  const senderEmail = config.senderEmail as string | undefined;
  const assignedTo = config.assignedTo as string | undefined;
  const assignedToName = config.assignedToName as string | undefined;

  switch (step.step_type) {
    case "sms":
      return {
        from: fromNumber ? `${senderName ?? "NAH"} (${fromNumber})` : (senderName ?? "NAH"),
        to: "[Contact Phone]",
      };
    case "email":
      return {
        from: senderEmail ? `${senderName ?? "NAH"} (${senderEmail})` : (senderName ?? "NAH"),
        to: "[Contact Email]",
      };
    case "chad_call_task":
      return { from: null, to: `Assigned to ${assignedToName ?? assignedTo ?? "Chad"}` };
    case "team_notify":
      return { from: "System", to: "Team" };
    case "appointment":
      return { from: null, to: `Calendar: ${(config.calendarId as string) ?? "default"}` };
    case "add_tag":
    case "remove_tag":
      return { from: null, to: `Tag: ${step.content ?? ""}` };
    case "pipeline_move":
      return { from: null, to: "[Contact] pipeline stage" };
    default:
      return { from: null, to: "[Contact]" };
  }
}

/** Enhanced step card showing FROM → TO, timing, and execution mode */
function BlueprintStepCard({ step }: { step: WorkflowStep }) {
  const [expanded, setExpanded] = useState(false);
  const config = STEP_TYPE_CONFIG[step.step_type] ?? STEP_TYPE_CONFIG.sms;
  const Icon = config.icon;
  const routing = getStepRouting(step);
  const needsApproval = step.requires_confirmation && !AUTO_EXECUTE_TYPES.includes(step.step_type);
  const hasContent = !!step.content;
  const contentLong = (step.content?.length ?? 0) > 120;

  return (
    <div className="px-3 py-2.5 rounded-lg border border-border-default bg-surface-glass">
      {/* Row 1: Type + Time + Execution Mode */}
      <div className="flex items-center gap-2 mb-1.5">
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
        {needsApproval ? (
          <span className="text-[10px] text-warning bg-warning/10 border border-warning/20 px-1.5 py-0.5 rounded-sm ml-auto flex items-center gap-1">
            <Shield size={9} /> Needs your approval
          </span>
        ) : (
          <span className="text-[10px] text-success bg-success/10 border border-success/20 px-1.5 py-0.5 rounded-sm ml-auto flex items-center gap-1">
            <Play size={9} /> Auto-fires
          </span>
        )}
      </div>

      {/* Row 2: FROM → TO routing */}
      {routing.from ? (
        <div className="flex items-center gap-1.5 mb-1.5 text-caption">
          <span className="font-medium text-text-primary">{routing.from}</span>
          <Send size={10} className="text-text-tertiary" />
          <span className="text-text-secondary">{routing.to}</span>
        </div>
      ) : routing.to !== "[Contact]" ? (
        <div className="flex items-center gap-1.5 mb-1.5 text-caption">
          <ArrowRight size={10} className="text-text-tertiary" />
          <span className="text-text-secondary">{routing.to}</span>
        </div>
      ) : null}

      {/* Subject (email) */}
      {step.subject && <p className="text-caption font-medium text-text-primary mb-0.5">Subject: {step.subject}</p>}

      {/* Content — expandable */}
      {hasContent ? (
        <div>
          <p
            className={`text-body-sm text-text-secondary whitespace-pre-wrap ${!expanded && contentLong ? "line-clamp-2" : ""}`}
          >
            {step.content}
          </p>
          {contentLong && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-caption text-nah-blue hover:text-nah-blue-hover flex items-center gap-0.5 mt-0.5"
            >
              {expanded ? (
                <>
                  <ChevronUp size={12} /> Less
                </>
              ) : (
                <>
                  <ChevronDown size={12} /> Full message
                </>
              )}
            </button>
          )}
        </div>
      ) : (
        <p className="text-caption text-text-tertiary italic">No content yet</p>
      )}
    </div>
  );
}

/** Activity log row */
const ACTIVITY_STATUS: Record<string, { color: string; label: string }> = {
  executed: { color: "text-success", label: "Sent" },
  queued: { color: "text-warning", label: "Awaiting approval" },
  rejected: { color: "text-text-tertiary", label: "Rejected" },
  failed: { color: "text-danger", label: "Failed" },
};

function ActivityRow({ entry }: { entry: ActivityEntry }) {
  const config = STEP_TYPE_CONFIG[entry.stepType as WorkflowStepType] ?? STEP_TYPE_CONFIG.sms;
  const Icon = config.icon;
  const status = ACTIVITY_STATUS[entry.status] ?? ACTIVITY_STATUS.executed;
  const timeStr = entry.executedAt ?? entry.createdAt;
  const timeAgo = getTimeAgo(timeStr);

  return (
    <div className="flex items-start gap-2.5 px-3 py-2 rounded-md border border-border-default bg-surface-glass">
      <div
        className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: `${config.color}15`, color: config.color }}
      >
        <Icon size={11} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-body-sm font-medium text-text-primary truncate">{entry.contactName}</span>
          <span className={`text-[10px] font-medium ${status.color}`}>{status.label}</span>
          <span className="text-caption text-text-tertiary ml-auto flex-shrink-0">{timeAgo}</span>
        </div>
        {/* Delivery indicators */}
        {entry.status === "executed" && (
          <div className="flex items-center gap-2 mt-0.5">
            {entry.delivered && <span className="text-[10px] text-success">Delivered</span>}
            {entry.opened && <span className="text-[10px] text-nah-blue">Opened</span>}
            {entry.responded && <span className="text-[10px] text-scout-purple">Responded</span>}
            {!entry.delivered && !entry.opened && !entry.responded && (
              <span className="text-[10px] text-text-tertiary">Pending delivery</span>
            )}
          </div>
        )}
        {entry.error && <p className="text-[10px] text-danger mt-0.5 truncate">{entry.error}</p>}
      </div>
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
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
