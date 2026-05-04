"use client";

/**
 * WorkflowPreviewPanel — right panel in the builder showing the live draft.
 * Renders the WorkflowDraft as a visual day timeline with step cards.
 */

import {
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
  Zap,
  Clock,
  Target,
  CheckCircle,
  Pencil,
} from "lucide-react";
import type { WorkflowDraft, WorkflowStepDraft } from "@/types/workflow-builder";
import type { WorkflowStepType } from "@/lib/workflows/types";

const STEP_ICONS: Record<WorkflowStepType, React.ComponentType<{ size?: number; className?: string }>> = {
  sms: MessageSquare,
  email: Mail,
  chad_call_task: PhoneCall,
  team_notify: Bell,
  ai_agent_action: Bot,
  condition_check: GitBranch,
  stage_move_suggestion: ArrowRight,
  trainual_check: BookOpen,
  appointment: CalendarPlus,
  send_reminder: AlarmClock,
  internal_note: StickyNote,
  add_tag: Tag,
  remove_tag: XCircle,
  update_contact: UserCog,
  pipeline_move: ArrowRightLeft,
  trigger_workflow: WorkflowIcon,
};

const STEP_LABELS: Record<WorkflowStepType, string> = {
  sms: "SMS",
  email: "Email",
  chad_call_task: "Call Task",
  team_notify: "Notify Team",
  ai_agent_action: "Scout AI",
  condition_check: "Condition",
  stage_move_suggestion: "Stage Move",
  trainual_check: "Trainual",
  appointment: "Appointment",
  send_reminder: "Reminder",
  internal_note: "Note",
  add_tag: "Add Tag",
  remove_tag: "Remove Tag",
  update_contact: "Update Contact",
  pipeline_move: "Pipeline Move",
  trigger_workflow: "Trigger Workflow",
};

interface WorkflowPreviewPanelProps {
  draft: WorkflowDraft | null;
  onConfirm: () => void;
  onKeepEditing: () => void;
  isConfirming: boolean;
}

export default function WorkflowPreviewPanel({
  draft,
  onConfirm,
  onKeepEditing,
  isConfirming,
}: WorkflowPreviewPanelProps) {
  if (!draft) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-6">
        <div className="w-16 h-16 rounded-full bg-bg-tertiary border border-border-default flex items-center justify-center mb-4">
          <WorkflowIcon size={28} className="text-text-tertiary" />
        </div>
        <h3 className="text-heading-sm text-text-primary mb-2">Workflow Preview</h3>
        <p className="text-body-sm text-text-secondary max-w-[280px]">
          Describe what you need and Scout will design a workflow for you here.
        </p>
      </div>
    );
  }

  // Group steps by day
  const dayGroups = new Map<number, WorkflowStepDraft[]>();
  for (const step of draft.steps) {
    const existing = dayGroups.get(step.dayNumber) ?? [];
    existing.push(step);
    dayGroups.set(step.dayNumber, existing);
  }
  const sortedDays = [...dayGroups.entries()].sort(([a], [b]) => a - b);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border-default">
        <h3 className="text-heading-sm text-text-primary truncate">{draft.name}</h3>
        <p className="text-body-sm text-text-secondary mt-1 line-clamp-2">{draft.description}</p>

        {/* Trigger + Exit badges */}
        <div className="flex flex-wrap gap-2 mt-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-scout-bubble-bg border border-scout-bubble-border text-caption text-scout-purple">
            <Zap size={12} />
            {draft.triggerConfig.description}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-bg-tertiary border border-border-default text-caption text-text-secondary">
            <Target size={12} />
            {draft.exitConditions.description}
          </span>
        </div>
      </div>

      {/* Day timeline */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {sortedDays.map(([dayNum, steps]) => (
          <div key={dayNum}>
            {/* Day badge */}
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-nah-blue/10 text-caption text-nah-blue font-semibold">
                <Clock size={10} />
                Day {dayNum}
              </span>
              <div className="flex-1 h-px bg-border-default" />
            </div>

            {/* Steps for this day */}
            <div className="space-y-2 pl-4 border-l-2 border-border-default ml-3">
              {steps.map((step, i) => {
                const Icon = STEP_ICONS[step.stepType] ?? WorkflowIcon;
                const label = STEP_LABELS[step.stepType] ?? step.stepType;

                return (
                  <div
                    key={`${dayNum}-${i}`}
                    className="flex items-start gap-3 p-3 rounded-lg bg-bg-secondary border border-border-default"
                  >
                    <div className="flex-shrink-0 w-7 h-7 rounded-md bg-bg-tertiary flex items-center justify-center">
                      <Icon size={14} className="text-text-secondary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {/* Type, time, approval */}
                      <div className="flex items-center gap-2">
                        <span className="text-body-sm font-medium text-text-primary">{label}</span>
                        {step.sendTime && <span className="text-caption text-text-tertiary">@ {step.sendTime}</span>}
                        {step.requiresConfirmation && (
                          <span className="text-caption text-amber-500">Needs approval</span>
                        )}
                      </div>

                      {/* Sender / Assigned / Due */}
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                        {step.senderName && (
                          <span className="text-caption text-text-tertiary">
                            From: <span className="text-text-secondary">{step.senderName}</span>
                            {step.senderEmail && <span className="text-text-tertiary"> ({step.senderEmail})</span>}
                          </span>
                        )}
                        {step.assignedTo && (
                          <span className="text-caption text-text-tertiary">
                            Assigned: <span className="text-text-secondary">{step.assignedTo}</span>
                          </span>
                        )}
                        {step.dueTime && (
                          <span className="text-caption text-text-tertiary">
                            Due: <span className="text-text-secondary">{step.dueTime}</span>
                          </span>
                        )}
                      </div>

                      {/* Subject line */}
                      {step.subject && (
                        <p className="text-caption text-text-tertiary mt-1">
                          Subject: <span className="text-text-secondary">{step.subject}</span>
                        </p>
                      )}

                      {/* Content */}
                      {step.content && (
                        <p className="text-body-sm text-text-secondary mt-1 line-clamp-3 whitespace-pre-wrap">
                          {step.content}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Confirm / Keep Editing buttons */}
      <div className="p-4 border-t border-border-default flex gap-3">
        <button
          onClick={onConfirm}
          disabled={isConfirming}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-scout-purple text-white font-medium text-body-sm hover:bg-scout-purple/90 disabled:opacity-50 transition-colors"
        >
          <CheckCircle size={16} />
          {isConfirming ? "Creating..." : "Confirm & Create"}
        </button>
        <button
          onClick={onKeepEditing}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-bg-tertiary border border-border-default text-text-primary font-medium text-body-sm hover:bg-bg-secondary transition-colors"
        >
          <Pencil size={16} />
          Edit
        </button>
      </div>
    </div>
  );
}
