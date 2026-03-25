"use client";

/**
 * Visual Workflow Builder — View 2
 *
 * Vertical day timeline with steps. Click to edit in right panel.
 * Add steps via the "+" button on any day row.
 * Steps grouped by day, ordered by step_number within each day.
 */

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Plus, RefreshCw, Eye, Send } from "lucide-react";
import type { Workflow, WorkflowStep, WorkflowStepType } from "@/lib/workflows/types";
import StepCard from "@/components/workflows/StepCard";
import StepEditor from "@/components/workflows/StepEditor";

export default function WorkflowBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const workflowId = params.workflowId as string;

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [selectedStep, setSelectedStep] = useState<WorkflowStep | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingDay, setAddingDay] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [wfRes, stepsRes] = await Promise.all([
        fetch(`/api/workflows/${workflowId}`),
        fetch(`/api/workflows/${workflowId}/steps`),
      ]);

      if (wfRes.ok) {
        const wfData = await wfRes.json();
        setWorkflow(wfData.workflow);
      }
      if (stepsRes.ok) {
        const stepsData = await stepsRes.json();
        setSteps(stepsData.steps ?? []);
        setVersionId(stepsData.versionId);
      }
    } catch {
      // silent
    }
    setLoading(false);
  }, [workflowId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Group steps by day
  const dayGroups = new Map<number, WorkflowStep[]>();
  for (const step of steps) {
    const day = step.day_number;
    if (!dayGroups.has(day)) dayGroups.set(day, []);
    dayGroups.get(day)!.push(step);
  }

  // Get all day numbers + fill gaps for empty days
  const maxDay = steps.length > 0 ? Math.max(...steps.map((s) => s.day_number)) : 0;
  const dayNumbers: number[] = [];
  for (let d = 1; d <= Math.max(maxDay, 1); d++) {
    dayNumbers.push(d);
  }

  async function handleAddStep(dayNumber: number, stepType: WorkflowStepType) {
    if (!versionId) return;
    setAddingDay(null);

    try {
      const res = await fetch(`/api/workflows/${workflowId}/steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          versionId,
          dayNumber,
          stepType,
          requiresConfirmation: ["sms", "email", "stage_move_suggestion"].includes(stepType),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSteps((prev) => [...prev, data.step]);
        setSelectedStep(data.step);
      }
    } catch {
      // silent
    }
  }

  function handleStepSaved(updated: WorkflowStep) {
    setSteps((prev) => prev.map((s) => s.id === updated.id ? updated : s));
    setSelectedStep(updated);
  }

  function handleStepDeleted(stepId: string) {
    setSteps((prev) => prev.filter((s) => s.id !== stepId));
    setSelectedStep(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <RefreshCw size={24} className="animate-spin text-nah-blue" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between px-1 py-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/workflows")}
            className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="font-headline text-page-title text-text-primary">
              {workflow?.name ?? "Workflow Builder"}
            </h1>
            <p className="text-caption text-text-tertiary">
              {steps.length} steps across {dayGroups.size} days
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-text-secondary text-button border border-border-default hover:bg-bg-hover transition-colors">
            <Eye size={14} />
            Preview
          </button>
          {workflow?.status === "draft" && (
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-nah-blue text-white text-button hover:bg-nah-blue-hover transition-colors">
              <Send size={14} />
              Submit for Approval
            </button>
          )}
        </div>
      </div>

      {/* Builder content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-0 border border-border-default rounded-lg overflow-hidden min-h-0">
        {/* Timeline canvas — 3/5 */}
        <div className="lg:col-span-3 overflow-y-auto p-4 bg-bg-secondary/30">
          <div className="max-w-xl mx-auto space-y-1">
            {dayNumbers.map((day) => {
              const daySteps = dayGroups.get(day) ?? [];
              return (
                <DayRow
                  key={day}
                  dayNumber={day}
                  steps={daySteps}
                  selectedStepId={selectedStep?.id ?? null}
                  onSelectStep={setSelectedStep}
                  onAddStep={(type) => handleAddStep(day, type)}
                  isAdding={addingDay === day}
                  onToggleAdd={() => setAddingDay(addingDay === day ? null : day)}
                />
              );
            })}

            {/* Add new day button */}
            <button
              onClick={() => {
                const nextDay = maxDay + 1;
                dayNumbers.push(nextDay);
                setAddingDay(nextDay);
              }}
              className="w-full py-3 border-2 border-dashed border-border-default rounded-lg text-body-sm text-text-tertiary hover:border-nah-blue hover:text-nah-blue transition-colors"
            >
              + Add Day {maxDay + 1}
            </button>
          </div>
        </div>

        {/* Step editor — 2/5 */}
        <div className="lg:col-span-2 bg-bg-primary border-l border-border-default flex flex-col min-h-0">
          {selectedStep ? (
            <StepEditor
              step={selectedStep}
              workflowId={workflowId}
              onSave={handleStepSaved}
              onDelete={handleStepDeleted}
              onClose={() => setSelectedStep(null)}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <p className="text-body text-text-secondary mb-1">Select a step to edit</p>
              <p className="text-body-sm text-text-tertiary max-w-xs">
                Click any step on the timeline, or use the + button to add a new one.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Step type options for the add menu */
const ADD_STEP_OPTIONS: { type: WorkflowStepType; label: string; emoji: string }[] = [
  { type: "sms", label: "SMS", emoji: "💬" },
  { type: "email", label: "Email", emoji: "📧" },
  { type: "chad_call_task", label: "Chad Call", emoji: "📞" },
  { type: "team_notify", label: "Notify Team", emoji: "🔔" },
  { type: "condition_check", label: "Condition", emoji: "🔀" },
  { type: "trainual_check", label: "Trainual Check", emoji: "📖" },
];

/** Single day row in the timeline */
function DayRow({
  dayNumber,
  steps,
  selectedStepId,
  onSelectStep,
  onAddStep,
  isAdding,
  onToggleAdd,
}: {
  dayNumber: number;
  steps: WorkflowStep[];
  selectedStepId: string | null;
  onSelectStep: (step: WorkflowStep) => void;
  onAddStep: (type: WorkflowStepType) => void;
  isAdding: boolean;
  onToggleAdd: () => void;
}) {
  return (
    <div className="relative">
      {/* Day header */}
      <div className="flex items-center gap-3 mb-2">
        {/* Day badge */}
        <div className="w-10 h-10 rounded-full bg-nah-blue/10 border border-nah-blue/20 flex items-center justify-center flex-shrink-0">
          <span className="text-badge font-bold text-nah-blue">{dayNumber}</span>
        </div>
        <span className="text-body-sm font-medium text-text-primary">Day {dayNumber}</span>
        <div className="flex-1 border-t border-border-default" />
        <button
          onClick={onToggleAdd}
          className={`p-1 rounded-md transition-colors ${
            isAdding
              ? "bg-nah-blue text-white"
              : "text-text-tertiary hover:text-nah-blue hover:bg-[rgba(0,161,225,0.08)]"
          }`}
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Add step menu */}
      {isAdding && (
        <div className="ml-[52px] mb-2 p-2 rounded-lg border border-nah-blue/20 bg-[rgba(0,161,225,0.03)] flex flex-wrap gap-1.5">
          {ADD_STEP_OPTIONS.map((opt) => (
            <button
              key={opt.type}
              onClick={() => onAddStep(opt.type)}
              className="px-2.5 py-1.5 rounded-md text-body-sm text-text-primary bg-surface-glass border border-border-default hover:border-nah-blue hover:bg-[rgba(0,161,225,0.05)] transition-colors"
            >
              {opt.emoji} {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Steps */}
      <div className="ml-[52px] space-y-1.5 mb-4">
        {steps.length === 0 && !isAdding && (
          <p className="text-caption text-text-tertiary py-2 pl-1">No steps</p>
        )}
        {steps.map((step) => (
          <StepCard
            key={step.id}
            step={step}
            isSelected={selectedStepId === step.id}
            onSelect={onSelectStep}
          />
        ))}
      </div>

      {/* Connector line */}
      <div className="absolute left-[19px] top-[50px] bottom-0 w-px bg-border-default" />
    </div>
  );
}
