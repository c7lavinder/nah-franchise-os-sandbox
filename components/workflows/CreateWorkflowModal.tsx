"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

/**
 * CreateWorkflowModal — modal for creating a new workflow.
 * Collects name, description, type, trigger, duration, and primary metric.
 */

import { useState } from "react";
import { X } from "lucide-react";
import { useScrollLock } from "@/lib/hooks/useScrollLock";

const WORKFLOW_TYPES = [
  { value: "new_lead_30day", label: "New Lead 30-Day Sequence" },
  { value: "pre_call_reminder", label: "Pre-Call Reminder" },
  { value: "post_call_followup", label: "Post-Call Follow-up" },
  { value: "trainual_nudge", label: "Trainual Nudge" },
  { value: "fdd_nurture", label: "FDD Nurture" },
  { value: "re_engagement", label: "Re-engagement" },
  { value: "long_term_nurture", label: "Long-term Nurture" },
  { value: "follow_up_cadence", label: "Follow-up Cadence" },
  { value: "onboarding_welcome", label: "Onboarding Welcome" },
  { value: "custom", label: "Custom Workflow" },
];

const TRIGGER_TYPES = [
  { value: "stage_entry:new_lead", label: "New Prospect enters pipeline" },
  { value: "stage_entry:qualified", label: "Prospect qualified" },
  { value: "stage_entry:fdd_delivered", label: "FDD delivered" },
  { value: "stage_entry:funds_received", label: "Funds received (closed won)" },
  { value: "appointment_created", label: "Appointment created" },
  { value: "call_completed", label: "Call completed" },
  { value: "trainual_access_granted", label: "Trainual access granted" },
  { value: "manual_enrollment", label: "Manual enrollment" },
  { value: "tag_added", label: "Tag added to contact" },
];

const METRICS = [
  "Call booking rate",
  "SMS response rate",
  "Email open rate",
  "Trainual open rate",
  "No-show rate",
  "Next step completion rate",
  "Response rate",
  "Re-engagement rate",
  "Content engagement rate",
  "Onboarding task completion rate",
];

interface CreateWorkflowModalProps {
  onClose: () => void;
  onCreate: (workflow: { id: string; name: string }) => void;
  userId: string;
}

export default function CreateWorkflowModal({ onClose, onCreate, userId }: CreateWorkflowModalProps) {
  useScrollLock(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [workflowType, setWorkflowType] = useState("custom");
  const [triggerType, setTriggerType] = useState("manual_enrollment");
  const [maxDays, setMaxDays] = useState(30);
  const [primaryMetric, setPrimaryMetric] = useState("Call booking rate");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const res = await apiFetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          workflowType,
          triggerType,
          exitConditions: { maxDays },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to create workflow");
      }

      const data = await res.json();

      // Update primary metric
      await apiFetch(`/api/workflows/${data.workflow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primary_metric_name: primaryMetric }),
      });

      onCreate({ id: data.workflow.id, name: data.workflow.name });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    }
    setCreating(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative w-full max-w-lg mx-4 rounded-xl overflow-hidden"
        style={{
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(0, 0, 0, 0.06)",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-default">
          <h2 className="font-headline text-section-title text-text-primary">New Workflow</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Name */}
          <div>
            <label className="text-caption text-text-secondary mb-1 block">Workflow Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., New Lead 30-Day Sequence"
              className="w-full px-3 py-2 rounded-md bg-bg-secondary border border-border-default text-body text-text-primary placeholder:text-text-tertiary focus:border-nah-blue focus:outline-none"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-caption text-text-secondary mb-1 block">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this workflow do?"
              rows={2}
              className="w-full px-3 py-2 rounded-md bg-bg-secondary border border-border-default text-body text-text-primary placeholder:text-text-tertiary focus:border-nah-blue focus:outline-none resize-none"
            />
          </div>

          {/* Type + Trigger row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-caption text-text-secondary mb-1 block">Type</label>
              <select
                value={workflowType}
                onChange={(e) => setWorkflowType(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-bg-secondary border border-border-default text-body text-text-primary focus:border-nah-blue focus:outline-none"
              >
                {WORKFLOW_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-caption text-text-secondary mb-1 block">Trigger</label>
              <select
                value={triggerType}
                onChange={(e) => setTriggerType(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-bg-secondary border border-border-default text-body text-text-primary focus:border-nah-blue focus:outline-none"
              >
                {TRIGGER_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Duration + Metric row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-caption text-text-secondary mb-1 block">Duration (days)</label>
              <input
                type="number"
                min={1}
                max={365}
                value={maxDays}
                onChange={(e) => setMaxDays(parseInt(e.target.value) || 30)}
                className="w-full px-3 py-2 rounded-md bg-bg-secondary border border-border-default text-body text-text-primary focus:border-nah-blue focus:outline-none"
              />
            </div>
            <div>
              <label className="text-caption text-text-secondary mb-1 block">Primary Metric</label>
              <select
                value={primaryMetric}
                onChange={(e) => setPrimaryMetric(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-bg-secondary border border-border-default text-body text-text-primary focus:border-nah-blue focus:outline-none"
              >
                {METRICS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && <p className="text-body-sm text-danger">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border-default">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-button text-text-secondary hover:bg-bg-hover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !name.trim()}
            className="px-4 py-2 rounded-md bg-nah-blue text-white text-button hover:bg-nah-blue-hover transition-colors disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create Workflow"}
          </button>
        </div>
      </div>
    </div>
  );
}
