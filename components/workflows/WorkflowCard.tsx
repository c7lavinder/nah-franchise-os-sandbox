"use client";

/**
 * WorkflowCard — single workflow row in the dashboard list.
 * Shows name, health score badge, active enrollees, primary metric, and quick actions.
 */

import { useRouter } from "next/navigation";
import { Pause, Play, Copy, Archive, Users, Pencil, Zap } from "lucide-react";
import type { Workflow } from "@/lib/workflows/types";

/** Trigger type → short human-readable label */
const TRIGGER_LABELS: Record<string, string> = {
  "stage_entry:new_lead": "New prospect enters",
  "stage_entry:qualified": "Prospect qualified",
  "stage_entry:fdd_delivered": "FDD delivered",
  "stage_entry:funds_received": "Funds received",
  appointment_created: "Appointment created",
  call_completed: "Call completed",
  trainual_access_granted: "Trainual access",
  manual_enrollment: "Manual",
  tag_added: "Tag added",
};

/** Color mapping for health score badges */
const HEALTH_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  A: { bg: "rgba(5, 150, 105, 0.10)", text: "#059669", border: "rgba(5, 150, 105, 0.25)" },
  B: { bg: "rgba(0, 161, 225, 0.10)", text: "#00a1e1", border: "rgba(0, 161, 225, 0.25)" },
  C: { bg: "rgba(245, 168, 0, 0.10)", text: "#d97706", border: "rgba(245, 168, 0, 0.25)" },
  D: { bg: "rgba(239, 68, 68, 0.10)", text: "#ef4444", border: "rgba(239, 68, 68, 0.25)" },
  F: { bg: "rgba(239, 68, 68, 0.15)", text: "#dc2626", border: "rgba(239, 68, 68, 0.35)" },
};

/** Status badge colors */
const STATUS_STYLES: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "#94a3b8" },
  pending_approval: { label: "Pending", color: "#f5a800" },
  live: { label: "Live", color: "#059669" },
  paused: { label: "Paused", color: "#ef4444" },
  archived: { label: "Archived", color: "#64748b" },
};

interface WorkflowCardProps {
  workflow: Workflow;
  onSelect: (workflow: Workflow) => void;
  onAction: (workflowId: string, action: "pause" | "resume" | "clone" | "archive") => void;
  isSelected: boolean;
}

export default function WorkflowCard({ workflow, onSelect, onAction, isSelected }: WorkflowCardProps) {
  const router = useRouter();
  const health = HEALTH_COLORS[workflow.health_score] ?? HEALTH_COLORS.C;
  const status = STATUS_STYLES[workflow.status] ?? STATUS_STYLES.draft;

  return (
    <button
      onClick={() => onSelect(workflow)}
      className={`w-full text-left p-4 rounded-lg border transition-all duration-150 ${
        isSelected
          ? "border-nah-blue bg-[rgba(0,161,225,0.05)]"
          : "border-border-default bg-surface-glass hover:border-border-hover"
      }`}
      style={{ backdropFilter: "blur(8px)" }}
    >
      {/* Top row: name + health score */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-headline text-card-title text-text-primary truncate pr-3">{workflow.name}</h3>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Status badge */}
          <span
            className="text-badge px-2 py-0.5 rounded-sm"
            style={{ color: status.color, background: `${status.color}15` }}
          >
            {status.label}
          </span>
          {/* Health score */}
          <span
            className="w-7 h-7 rounded-md flex items-center justify-center text-badge font-bold"
            style={{
              background: health.bg,
              color: health.text,
              border: `1px solid ${health.border}`,
            }}
          >
            {workflow.health_score}
          </span>
        </div>
      </div>

      {/* Description */}
      {workflow.description && (
        <p className="text-body-sm text-text-secondary mb-2 line-clamp-1">{workflow.description}</p>
      )}

      {/* Trigger */}
      <div className="flex items-center gap-1.5 mb-3">
        <Zap size={11} className="text-warning" />
        <span className="text-caption text-text-tertiary">
          {TRIGGER_LABELS[workflow.trigger_type] ?? workflow.trigger_type}
        </span>
      </div>

      {/* Bottom row: enrollees + metric + actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Enrollee count */}
          <div className="flex items-center gap-1.5 text-body-sm text-text-secondary">
            <Users size={14} />
            <span>{workflow.active_enrollee_count} enrolled</span>
          </div>
          {/* Primary metric */}
          {workflow.primary_metric_name && workflow.primary_metric_value !== null && (
            <span className="text-body-sm text-text-secondary">
              {workflow.primary_metric_name}:{" "}
              <span className="font-semibold text-text-primary">{workflow.primary_metric_value}%</span>
            </span>
          )}
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => router.push(`/workflows/${workflow.id}`)}
            className="p-1.5 rounded-md text-text-tertiary hover:text-nah-blue hover:bg-[rgba(0,161,225,0.08)] transition-colors"
            title="Edit"
          >
            <Pencil size={14} />
          </button>
          {workflow.status === "live" ? (
            <button
              onClick={() => onAction(workflow.id, "pause")}
              className="p-1.5 rounded-md text-text-tertiary hover:text-warning hover:bg-[rgba(245,168,0,0.08)] transition-colors"
              title="Pause"
            >
              <Pause size={14} />
            </button>
          ) : workflow.status === "paused" ? (
            <button
              onClick={() => onAction(workflow.id, "resume")}
              className="p-1.5 rounded-md text-text-tertiary hover:text-success hover:bg-[rgba(5,150,105,0.08)] transition-colors"
              title="Resume"
            >
              <Play size={14} />
            </button>
          ) : null}
          <button
            onClick={() => onAction(workflow.id, "clone")}
            className="p-1.5 rounded-md text-text-tertiary hover:text-nah-blue hover:bg-[rgba(0,161,225,0.08)] transition-colors"
            title="Clone"
          >
            <Copy size={14} />
          </button>
          {workflow.status !== "archived" && (
            <button
              onClick={() => onAction(workflow.id, "archive")}
              className="p-1.5 rounded-md text-text-tertiary hover:text-danger hover:bg-[rgba(239,68,68,0.08)] transition-colors"
              title="Archive"
            >
              <Archive size={14} />
            </button>
          )}
        </div>
      </div>
    </button>
  );
}
