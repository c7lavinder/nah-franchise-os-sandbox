"use client";

/**
 * /workflows/new — Conversational Workflow Builder
 *
 * Split-panel: chat (left) + live preview (right).
 * User describes what they need, Scout designs it, user confirms.
 * Also supports edit mode via ?workflowId=xyz query param.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { apiFetch } from "@/lib/auth/api-fetch";
import WorkflowBuilderChat from "@/components/workflows/WorkflowBuilderChat";
import WorkflowPreviewPanel from "@/components/workflows/WorkflowPreviewPanel";
import type { BuilderMessage, WorkflowDraft } from "@/types/workflow-builder";
import type Anthropic from "@anthropic-ai/sdk";

export default function WorkflowBuilderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const workflowId = searchParams.get("workflowId");

  const [messages, setMessages] = useState<BuilderMessage[]>([]);
  const [currentDraft, setCurrentDraft] = useState<WorkflowDraft | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(Boolean(workflowId));
  const [error, setError] = useState<string | null>(null);

  const apiHistoryRef = useRef<Anthropic.Messages.MessageParam[]>([]);

  useEffect(() => {
    if (!workflowId) {
      setLoadingExisting(false);
      return;
    }

    async function loadExistingWorkflow() {
      setError(null);
      setLoadingExisting(true);

      try {
        const [workflowRes, stepsRes] = await Promise.all([
          apiFetch(`/api/workflows/${workflowId}`),
          apiFetch(`/api/workflows/${workflowId}/steps`),
        ]);

        if (!workflowRes.ok) {
          const data = await workflowRes.json().catch(() => ({ error: "Failed to load workflow" }));
          throw new Error(data.error ?? "Failed to load workflow");
        }
        if (!stepsRes.ok) {
          const data = await stepsRes.json().catch(() => ({ error: "Failed to load workflow steps" }));
          throw new Error(data.error ?? "Failed to load workflow steps");
        }

        const workflowData = await workflowRes.json();
        const stepsData = await stepsRes.json();
        const workflow = workflowData.workflow as {
          name: string;
          description: string | null;
          workflow_type: string;
          trigger_type: string;
          trigger_config: WorkflowDraft["triggerConfig"] | null;
          exit_conditions: WorkflowDraft["exitConditions"] | null;
          primary_metric_name: string | null;
        };
        const steps = (stepsData.steps ?? []) as Array<{
          id: string;
          day_number: number;
          step_number: number;
          step_type: WorkflowDraft["steps"][number]["stepType"];
          content: string | null;
          subject: string | null;
          send_time: string | null;
          requires_confirmation: boolean;
          condition_config: Record<string, unknown> | null;
        }>;

        const draft: WorkflowDraft = {
          name: workflow.name,
          description: workflow.description ?? "",
          workflowType: workflow.workflow_type,
          triggerConfig: workflow.trigger_config ?? {
            event: workflow.trigger_type,
            conditions: [],
            description: workflow.trigger_type,
          },
          exitConditions: workflow.exit_conditions ?? {
            maxDays: 30,
            goalConditions: [],
            description: "No exit condition configured",
          },
          primaryMetric: workflow.primary_metric_name ?? "Goal achievement",
          steps: steps.map((step, index) => {
            const conditionConfig = step.condition_config ?? {};
            const { senderName, senderEmail, assignedTo, dueTime, ...actionParams } = conditionConfig;
            return {
              id: step.id,
              dayNumber: step.day_number,
              stepNumber: step.step_number ?? index + 1,
              stepType: step.step_type,
              content: step.content,
              subject: step.subject,
              sendTime: step.send_time,
              senderName: typeof senderName === "string" ? senderName : null,
              senderEmail: typeof senderEmail === "string" ? senderEmail : null,
              assignedTo: typeof assignedTo === "string" ? assignedTo : null,
              dueTime: typeof dueTime === "string" ? dueTime : null,
              requiresConfirmation: step.requires_confirmation,
              actionParams,
            };
          }),
        };

        setCurrentDraft(draft);
        setMessages([
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `Loaded "${draft.name}" for editing. Tell me what to change, or save the current draft.`,
            workflowDraft: draft,
          },
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load workflow");
      } finally {
        setLoadingExisting(false);
      }
    }

    void loadExistingWorkflow();
  }, [workflowId]);

  const handleSend = useCallback(
    async (message: string) => {
      setError(null);
      setIsThinking(true);

      // Add user message to UI
      const userMsg: BuilderMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: message,
      };
      setMessages((prev) => [...prev, userMsg]);

      try {
        const response = await apiFetch("/api/workflows/build", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            history: apiHistoryRef.current,
            workflowId: workflowId ?? undefined,
            currentDraft: currentDraft ?? undefined,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error ?? "Failed to get response");
        }

        const data = await response.json();

        // Update API history for next turn
        apiHistoryRef.current = data.history;

        // Update draft if one was returned
        if (data.workflowDraft) {
          setCurrentDraft(data.workflowDraft);
        }

        // Add Scout's response to UI
        const scoutMsg: BuilderMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.message,
          workflowDraft: data.workflowDraft ?? undefined,
        };
        setMessages((prev) => [...prev, scoutMsg]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Something went wrong";
        setError(msg);
        const errorMsg: BuilderMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Sorry, I hit an error: ${msg}. Please try again.`,
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsThinking(false);
      }
    },
    [currentDraft, workflowId]
  );

  const handleConfirm = useCallback(async () => {
    if (!currentDraft) return;
    setIsConfirming(true);
    setError(null);

    try {
      let savedWorkflowId = workflowId;

      if (workflowId) {
        const updateRes = await apiFetch(`/api/workflows/${workflowId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: currentDraft.name,
            description: currentDraft.description,
            workflow_type: currentDraft.workflowType,
            trigger_type: currentDraft.triggerConfig.event,
            trigger_config: currentDraft.triggerConfig,
            exit_conditions: currentDraft.exitConditions,
            primary_metric_name: currentDraft.primaryMetric,
          }),
        });

        if (!updateRes.ok) {
          const data = await updateRes.json().catch(() => ({ error: "Failed to update workflow" }));
          throw new Error(data.error ?? "Failed to update workflow");
        }
      } else {
        // Step 1: Create the workflow
        const createRes = await apiFetch("/api/workflows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: currentDraft.name,
            description: currentDraft.description,
            workflowType: currentDraft.workflowType,
            triggerType: currentDraft.triggerConfig.event,
            triggerConfig: currentDraft.triggerConfig,
            exitConditions: currentDraft.exitConditions,
            primaryMetric: currentDraft.primaryMetric,
          }),
        });

        if (!createRes.ok) {
          const data = await createRes.json();
          throw new Error(data.error ?? "Failed to create workflow");
        }

        const { workflow: created } = await createRes.json();
        savedWorkflowId = created.id;
      }

      if (!savedWorkflowId) {
        throw new Error("No workflow ID found");
      }

      // Step 2: Get the version ID that was auto-created or already attached
      const stepsRes = await apiFetch(`/api/workflows/${savedWorkflowId}/steps`);
      const stepsData = await stepsRes.json();
      let versionId = stepsData.versionId;

      // Fallback: if no version found, the API may not have returned one
      if (!versionId) {
        // The workflow POST creates a version — fetch it directly
        const vRes = await apiFetch(`/api/workflows/${savedWorkflowId}`);
        const vData = await vRes.json();
        versionId = vData.workflow?.current_version_id;
      }

      if (!versionId) {
        throw new Error("No version ID found — workflow may not have been created properly");
      }

      if (workflowId) {
        for (const existingStep of stepsData.steps ?? []) {
          await apiFetch(`/api/workflows/${savedWorkflowId}/steps/${existingStep.id}`, {
            method: "DELETE",
          });
        }
      }

      // Step 3: Create each step with the version ID
      for (const step of currentDraft.steps) {
        const stepRes = await apiFetch(`/api/workflows/${savedWorkflowId}/steps`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            versionId,
            dayNumber: step.dayNumber,
            stepNumber: step.stepNumber,
            stepType: step.stepType,
            content: step.content,
            subject: step.subject,
            sendTime: step.sendTime,
            requiresConfirmation: step.requiresConfirmation,
            conditionConfig: {
              ...(step.actionParams ?? {}),
              ...(step.senderName ? { senderName: step.senderName } : {}),
              ...(step.senderEmail ? { senderEmail: step.senderEmail } : {}),
              ...(step.assignedTo ? { assignedTo: step.assignedTo } : {}),
              ...(step.dueTime ? { dueTime: step.dueTime } : {}),
            },
          }),
        });

        if (!stepRes.ok) {
          const errData = await stepRes.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(
            `Failed to create step ${step.stepNumber} on day ${step.dayNumber}: ${errData.error ?? "Unknown error"}`
          );
        }
      }

      // Navigate to workflows list
      router.push("/workflows");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create workflow";
      setError(msg);
      const errorMsg: BuilderMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Failed to create the workflow: ${msg}. You can try again.`,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsConfirming(false);
    }
  }, [currentDraft, router, workflowId]);

  const handleKeepEditing = useCallback(() => {
    // Focus the chat input — user can describe changes
  }, []);

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border-default bg-bg-primary">
        <button
          onClick={() => router.push("/workflows")}
          className="flex items-center gap-1.5 text-body-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Workflows
        </button>
        <div className="h-4 w-px bg-border-default" />
        <h1 className="text-heading-sm text-text-primary">{workflowId ? "Edit Workflow" : "New Workflow"}</h1>
        {loadingExisting && <span className="text-body-sm text-text-tertiary">Loading workflow...</span>}
        {error && <span className="ml-auto text-body-sm text-red-400">{error}</span>}
      </div>

      {/* Split panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat panel (left — 60%) */}
        <div className="w-[60%] border-r border-border-default">
          <WorkflowBuilderChat messages={messages} isThinking={isThinking} onSend={handleSend} />
        </div>

        {/* Preview panel (right — 40%) */}
        <div className="w-[40%] bg-bg-primary">
          <WorkflowPreviewPanel
            draft={currentDraft}
            onConfirm={handleConfirm}
            onKeepEditing={handleKeepEditing}
            isConfirming={isConfirming}
            confirmLabel={workflowId ? "Save Changes" : "Confirm & Create"}
            confirmingLabel={workflowId ? "Saving..." : "Creating..."}
          />
        </div>
      </div>
    </div>
  );
}
