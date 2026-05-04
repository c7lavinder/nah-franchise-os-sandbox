"use client";

/**
 * /workflows/new — Conversational Workflow Builder
 *
 * Split-panel: chat (left) + live preview (right).
 * User describes what they need, Scout designs it, user confirms.
 * Also supports edit mode via ?workflowId=xyz query param.
 */

import { useState, useRef, useCallback } from "react";
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
  const [error, setError] = useState<string | null>(null);

  const apiHistoryRef = useRef<Anthropic.Messages.MessageParam[]>([]);

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

      // Step 2: Get the version ID that was auto-created
      const stepsRes = await apiFetch(`/api/workflows/${created.id}/steps`);
      const stepsData = await stepsRes.json();
      let versionId = stepsData.versionId;

      // Fallback: if no version found, the API may not have returned one
      if (!versionId) {
        // The workflow POST creates a version — fetch it directly
        const vRes = await apiFetch(`/api/workflows/${created.id}`);
        const vData = await vRes.json();
        versionId = vData.workflow?.current_version_id;
      }

      if (!versionId) {
        throw new Error("No version ID found — workflow may not have been created properly");
      }

      // Step 3: Create each step with the version ID
      for (const step of currentDraft.steps) {
        const stepRes = await apiFetch(`/api/workflows/${created.id}/steps`, {
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
            conditionConfig: step.actionParams ?? null,
          }),
        });

        if (!stepRes.ok) {
          console.error(`Failed to create step ${step.stepNumber} on day ${step.dayNumber}`);
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
  }, [currentDraft, router]);

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
          />
        </div>
      </div>
    </div>
  );
}
