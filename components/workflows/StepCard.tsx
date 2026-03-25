"use client";

/**
 * StepCard — single step displayed on the workflow builder canvas.
 * Shows step type icon, content preview, and performance indicator.
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
  GripVertical,
} from "lucide-react";
import type { WorkflowStep, WorkflowStepType } from "@/lib/workflows/types";

/** Icon and label for each step type */
const STEP_TYPE_CONFIG: Record<WorkflowStepType, {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  color: string;
}> = {
  sms: { icon: MessageSquare, label: "SMS", color: "#059669" },
  email: { icon: Mail, label: "Email", color: "#00a1e1" },
  chad_call_task: { icon: PhoneCall, label: "Chad Call", color: "#f5a800" },
  team_notify: { icon: Bell, label: "Notify", color: "#8b5cf6" },
  ai_agent_action: { icon: Bot, label: "Scout AI", color: "#00a1e1" },
  condition_check: { icon: GitBranch, label: "Condition", color: "#64748b" },
  stage_move_suggestion: { icon: ArrowRight, label: "Stage Move", color: "#ef4444" },
  trainual_check: { icon: BookOpen, label: "Trainual", color: "#059669" },
};

/** Performance status color */
const PERF_COLORS: Record<string, string> = {
  green: "#059669",
  yellow: "#f5a800",
  red: "#ef4444",
  neutral: "#94a3b8",
};

interface StepCardProps {
  step: WorkflowStep;
  isSelected: boolean;
  onSelect: (step: WorkflowStep) => void;
}

export default function StepCard({ step, isSelected, onSelect }: StepCardProps) {
  const config = STEP_TYPE_CONFIG[step.step_type] ?? STEP_TYPE_CONFIG.sms;
  const Icon = config.icon;
  const perfColor = PERF_COLORS[step.performance_status] ?? PERF_COLORS.neutral;

  // Content preview — truncated
  const preview = step.content
    ? step.content.length > 80
      ? step.content.slice(0, 80) + "..."
      : step.content
    : "No content";

  return (
    <button
      onClick={() => onSelect(step)}
      className={`w-full text-left flex items-start gap-3 px-3 py-3 rounded-lg border transition-all duration-150 group ${
        isSelected
          ? "border-nah-blue bg-[rgba(0,161,225,0.06)] shadow-sm"
          : "border-border-default bg-surface-glass hover:border-border-hover"
      }`}
    >
      {/* Drag handle */}
      <GripVertical size={14} className="text-text-tertiary mt-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />

      {/* Step type icon */}
      <div
        className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
        style={{ background: `${config.color}12`, border: `1px solid ${config.color}25`, color: config.color }}
      >
        <Icon size={15} className="flex-shrink-0" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-badge font-semibold" style={{ color: config.color }}>
            {config.label}
          </span>
          {step.send_time && (
            <span className="text-caption text-text-tertiary">@ {step.send_time}</span>
          )}
          {step.requires_confirmation && (
            <span className="text-[10px] text-warning bg-warning/10 px-1.5 py-0.5 rounded-sm">
              Confirm
            </span>
          )}
        </div>
        <p className="text-body-sm text-text-secondary truncate">{preview}</p>
        {step.subject && (
          <p className="text-caption text-text-tertiary truncate mt-0.5">
            Subject: {step.subject}
          </p>
        )}
      </div>

      {/* Performance dot */}
      <div
        className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-2"
        style={{ background: perfColor }}
        title={`Performance: ${step.performance_status}`}
      />
    </button>
  );
}
