"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

/**
 * StepEditor — right panel editor for workflow step content.
 * Supports editing content, subject, type, timing, and confirmation settings.
 * Includes Scout assist buttons (Write, Improve, Shorten).
 */

import { useState } from "react";
import { Save, Trash2, Sparkles, X } from "lucide-react";
import type { WorkflowStep, WorkflowStepType } from "@/lib/workflows/types";

const STEP_TYPES: { value: WorkflowStepType; label: string }[] = [
  { value: "sms", label: "SMS" },
  { value: "email", label: "Email" },
  { value: "chad_call_task", label: "Chad Call Task" },
  { value: "team_notify", label: "Team Notification" },
  { value: "ai_agent_action", label: "Scout AI Action" },
  { value: "condition_check", label: "Condition Check" },
  { value: "stage_move_suggestion", label: "Stage Move" },
  { value: "trainual_check", label: "Trainual Check" },
];

interface StepEditorProps {
  step: WorkflowStep;
  workflowId: string;
  onSave: (updated: WorkflowStep) => void;
  onDelete: (stepId: string) => void;
  onClose: () => void;
}

export default function StepEditor({ step, workflowId, onSave, onDelete, onClose }: StepEditorProps) {
  const [stepType, setStepType] = useState<WorkflowStepType>(step.step_type);
  const [content, setContent] = useState(step.content ?? "");
  const [subject, setSubject] = useState(step.subject ?? "");
  const [sendTime, setSendTime] = useState(step.send_time ?? "");
  const [requiresConfirmation, setRequiresConfirmation] = useState(step.requires_confirmation);
  const [dayNumber, setDayNumber] = useState(step.day_number);
  const [saving, setSaving] = useState(false);
  const [rewriting, setRewriting] = useState(false);

  const hasContentField = ["sms", "email", "chad_call_task"].includes(stepType);
  const hasSubjectField = stepType === "email";
  const charCount = content.length;
  const isSms = stepType === "sms";

  async function handleSave() {
    setSaving(true);
    try {
      const res = await apiFetch(`/api/workflows/${workflowId}/steps/${step.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step_type: stepType,
          content: content || null,
          subject: subject || null,
          send_time: sendTime || null,
          requires_confirmation: requiresConfirmation,
          day_number: dayNumber,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        onSave(data.step);
      }
    } catch (err) {
      console.error("Save failed:", err);
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm("Delete this step? This cannot be undone.")) return;
    try {
      const res = await apiFetch(`/api/workflows/${workflowId}/steps/${step.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onDelete(step.id);
      }
    } catch (err) {
      console.error("Delete failed:", err);
    }
  }

  async function handleScoutAssist(action: "write" | "improve" | "shorten") {
    setRewriting(true);
    try {
      const res = await apiFetch(`/api/workflows/${workflowId}/rewrite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stepId: step.id,
          context: `Action: ${action}. ${action === "write" ? "Draft content from scratch." : action === "improve" ? "Rewrite to perform better." : "Condense while keeping the core intent."}`,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // Use the first variant's content
        if (data.variants && data.variants.length > 0) {
          setContent(data.variants[0].content);
          if (data.variants[0].subject && hasSubjectField) {
            setSubject(data.variants[0].subject);
          }
        }
      }
    } catch (err) {
      console.error("Scout assist failed:", err);
    }
    setRewriting(false);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border-default">
        <h3 className="font-headline text-card-title text-text-primary">Edit Step</h3>
        <button onClick={onClose} className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors">
          <X size={18} />
        </button>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Day + Type row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-caption text-text-secondary mb-1 block">Day</label>
            <input
              type="number"
              min={1}
              max={90}
              value={dayNumber}
              onChange={(e) => setDayNumber(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 rounded-md bg-bg-secondary border border-border-default text-body text-text-primary focus:border-nah-blue focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="text-caption text-text-secondary mb-1 block">Type</label>
            <select
              value={stepType}
              onChange={(e) => setStepType(e.target.value as WorkflowStepType)}
              className="w-full px-3 py-2 rounded-md bg-bg-secondary border border-border-default text-body text-text-primary focus:border-nah-blue focus:outline-none transition-colors"
            >
              {STEP_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Subject (email only) */}
        {hasSubjectField && (
          <div>
            <label className="text-caption text-text-secondary mb-1 block">Subject Line</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject..."
              className="w-full px-3 py-2 rounded-md bg-bg-secondary border border-border-default text-body text-text-primary placeholder:text-text-tertiary focus:border-nah-blue focus:outline-none transition-colors"
            />
          </div>
        )}

        {/* Content */}
        {hasContentField && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-caption text-text-secondary">Content</label>
              {isSms && (
                <span className={`text-caption ${charCount > 160 ? "text-danger" : "text-text-tertiary"}`}>
                  {charCount}/160
                </span>
              )}
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`Write your ${stepType === "email" ? "email body" : stepType === "sms" ? "SMS message" : "task description"}...`}
              rows={isSms ? 3 : 8}
              className="w-full px-3 py-2 rounded-md bg-bg-secondary border border-border-default text-body text-text-primary placeholder:text-text-tertiary focus:border-nah-blue focus:outline-none transition-colors resize-none"
            />

            {/* Scout assist buttons */}
            <div className="flex items-center gap-2 mt-2">
              <span className="text-caption text-text-tertiary mr-1">
                <Sparkles size={12} className="inline mr-1" />
                Scout:
              </span>
              {(["write", "improve", "shorten"] as const).map((action) => (
                <button
                  key={action}
                  onClick={() => handleScoutAssist(action)}
                  disabled={rewriting}
                  className="px-2.5 py-1 rounded-md text-caption text-nah-blue bg-[rgba(0,161,225,0.08)] hover:bg-[rgba(0,161,225,0.15)] transition-colors disabled:opacity-50 capitalize"
                >
                  {rewriting ? "..." : action}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Send time */}
        <div>
          <label className="text-caption text-text-secondary mb-1 block">Send Time (optional)</label>
          <input
            type="time"
            value={sendTime}
            onChange={(e) => setSendTime(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-bg-secondary border border-border-default text-body text-text-primary focus:border-nah-blue focus:outline-none transition-colors"
          />
        </div>

        {/* Requires confirmation toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-body-sm text-text-primary">Requires Confirmation</p>
            <p className="text-caption text-text-tertiary">Chad must confirm before sending</p>
          </div>
          <button
            onClick={() => setRequiresConfirmation(!requiresConfirmation)}
            className={`w-10 h-6 rounded-full transition-colors relative ${
              requiresConfirmation ? "bg-nah-blue" : "bg-border-hover"
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                requiresConfirmation ? "left-[18px]" : "left-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-border-default">
        <button
          onClick={handleDelete}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-danger text-button hover:bg-danger/10 transition-colors"
        >
          <Trash2 size={14} />
          Delete
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-nah-blue text-white text-button hover:bg-nah-blue-hover transition-colors disabled:opacity-50"
        >
          <Save size={14} />
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
