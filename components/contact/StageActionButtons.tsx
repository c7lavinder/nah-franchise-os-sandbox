"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

/**
 * StageActionButtons — Advance, Skip, Revert, Drop actions.
 * Per §1.6 + §1.7: advance button pulses when all sub-tasks complete.
 */

import { useState } from "react";
import { ArrowRight, SkipForward, RotateCcw, Loader2, ArrowDownRight } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

interface StageActionButtonsProps {
  contactId: string;
  pipelineId: string;
  pipelineSlug?: string;
  currentStageName: string;
  nextStageName: string | null;
  prevStageName: string | null;
  allSubTasksComplete: boolean;
  isFirstStage: boolean;
  isLastStage: boolean;
  territoryMsSlug?: string | null;
  onRefresh: () => void;
}

export default function StageActionButtons({
  contactId,
  pipelineId,
  pipelineSlug,
  currentStageName,
  nextStageName,
  prevStageName,
  allSubTasksComplete,
  isFirstStage,
  isLastStage,
  territoryMsSlug,
  onRefresh,
}: StageActionButtonsProps) {
  const isFollowupPipeline = pipelineSlug === "followup";
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<"skip" | "revert" | "drop_followup" | "drop_nurture" | null>(null);
  const [reason, setReason] = useState("");

  async function handleAdvance(force: boolean) {
    setLoading(force ? "skip" : "advance");
    setError(null);
    try {
      const res = await apiFetch(`/api/contacts/${contactId}/pipelines/${pipelineId}/advance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force, reason: reason || undefined, TerritorySlug: territoryMsSlug ?? undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to advance");
      }
      setConfirmAction(null);
      setReason("");
      toast(force ? "Stage skipped" : "Stage advanced");
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(null);
    }
  }

  async function handleRevert() {
    if (!reason.trim()) {
      setError("Reason is required for revert");
      return;
    }
    setLoading("revert");
    setError(null);
    try {
      const res = await apiFetch(`/api/contacts/${contactId}/pipelines/${pipelineId}/revert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, TerritorySlug: territoryMsSlug ?? undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to revert");
      }
      setConfirmAction(null);
      setReason("");
      toast("Stage reverted");
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(null);
    }
  }

  async function handleDrop(destination: "followup" | "nurture") {
    if (destination === "followup" && !reason.trim()) {
      setError("Reason is required for Follow-up");
      return;
    }
    setLoading(`drop_${destination}`);
    setError(null);
    try {
      const res = await apiFetch(`/api/contacts/${contactId}/pipelines/${pipelineId}/drop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination, reason: reason || undefined, TerritorySlug: territoryMsSlug ?? undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to drop");
      }
      setConfirmAction(null);
      setReason("");
      toast(`Dropped to ${destination === "followup" ? "Follow-up" : "Nurture"}`);
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(null);
    }
  }

  // Confirm dialog for skip / revert / drop
  if (confirmAction) {
    const isRevert = confirmAction === "revert";
    const isDrop = confirmAction === "drop_followup" || confirmAction === "drop_nurture";
    const title = isRevert
      ? `Revert to ${prevStageName}`
      : isDrop
        ? `Drop to ${confirmAction === "drop_followup" ? "Follow-up" : "Nurture"}`
        : `Skip to ${nextStageName}`;
    const actionLabel = isRevert ? "Revert" : isDrop ? "Drop" : "Skip Forward";

    return (
      <div className="mt-3 p-3 bg-bg-secondary border border-border-default rounded-lg">
        <h4 className="text-body-sm font-medium text-text-primary mb-2">{title}</h4>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={isRevert ? "Why are we reverting? (required)" : "Reason for skipping (optional)"}
          className="w-full bg-bg-tertiary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary resize-none mb-2"
          rows={2}
        />
        {error && <p className="text-caption text-danger mb-2">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={() => {
              setConfirmAction(null);
              setReason("");
              setError(null);
            }}
            className="btn-ghost px-3 py-1.5 text-caption"
          >
            Cancel
          </button>
          <button
            onClick={() =>
              isRevert
                ? handleRevert()
                : confirmAction === "drop_followup"
                  ? handleDrop("followup")
                  : confirmAction === "drop_nurture"
                    ? handleDrop("nurture")
                    : handleAdvance(true)
            }
            disabled={!!loading}
            className={`px-3 py-1.5 text-caption font-medium rounded-md ml-auto flex items-center gap-1 ${
              isRevert || isDrop
                ? "bg-danger/10 text-danger hover:bg-danger/20"
                : "bg-warning/10 text-warning hover:bg-warning/20"
            }`}
          >
            {loading && <Loader2 size={12} className="animate-spin" />}
            {actionLabel}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      {/* Advance — pulses when ready per §1.7 */}
      {!isLastStage && nextStageName && (
        <button
          onClick={() => handleAdvance(false)}
          disabled={!allSubTasksComplete || !!loading}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-caption font-medium transition-all ${
            allSubTasksComplete
              ? "bg-success text-white hover:bg-success/90 shadow-md animate-pulse"
              : "bg-bg-tertiary text-text-tertiary border border-border-default cursor-not-allowed"
          }`}
        >
          {loading === "advance" ? <Loader2 size={12} className="animate-spin" /> : <ArrowRight size={12} />}
          Advance to {nextStageName}
        </button>
      )}

      {/* Skip forward */}
      {!isLastStage && nextStageName && (
        <button
          onClick={() => setConfirmAction("skip")}
          disabled={!!loading}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-caption text-warning bg-warning/10 hover:bg-warning/20 transition-colors"
        >
          <SkipForward size={12} /> Skip
        </button>
      )}

      {/* Revert */}
      {!isFirstStage && prevStageName && (
        <button
          onClick={() => setConfirmAction("revert")}
          disabled={!!loading}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-caption text-danger bg-danger/10 hover:bg-danger/20 transition-colors"
        >
          <RotateCcw size={12} /> Revert
        </button>
      )}

      {/* Actions — "Move to Sales" for follow-up pipeline, drop buttons for sales pipeline */}
      <div className="ml-auto flex items-center gap-1.5">
        {isFollowupPipeline ? (
          <button
            onClick={() => setConfirmAction("drop_followup")}
            disabled={!!loading}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md text-caption font-medium text-nah-blue bg-nah-blue/10 hover:bg-nah-blue/20 border border-nah-blue/20 transition-colors"
          >
            <ArrowRight size={12} /> Move to Sales
          </button>
        ) : (
          <>
            <button
              onClick={() => setConfirmAction("drop_followup")}
              disabled={!!loading}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-caption text-text-tertiary bg-bg-tertiary hover:bg-bg-hover border border-border-default transition-colors"
            >
              <ArrowDownRight size={12} /> Follow-up
            </button>
            <button
              onClick={() => setConfirmAction("drop_nurture")}
              disabled={!!loading}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-caption text-text-tertiary bg-bg-tertiary hover:bg-bg-hover border border-border-default transition-colors"
            >
              <ArrowDownRight size={12} /> Nurture
            </button>
          </>
        )}
      </div>

      {error && !confirmAction && <span className="text-caption text-danger">{error}</span>}
    </div>
  );
}
