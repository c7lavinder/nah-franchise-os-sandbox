"use client";

import { useState, useEffect, useCallback } from "react";
import type { GHLOpportunity } from "@/types/ghl";
import { OwnershipPath, PipelineFilters, LeadList, ContactDetail } from "@/components/pipeline";

interface StageData {
  id: string;
  name: string;
  position: number;
  opportunities: GHLOpportunity[];
}

interface PipelineData {
  id: string;
  name: string;
  stages: StageData[];
}

/**
 * Pipeline Page — Hybrid View
 *
 * Top: Compact funnel showing all stages with lead counts (no scrolling)
 * Bottom: Filterable lead list showing individual leads sorted by urgency
 *
 * Click a stage in the funnel to filter the list to just that stage.
 */
export default function PipelinePage() {
  const [pipelines, setPipelines] = useState<PipelineData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("open");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [selectedStageName, setSelectedStageName] = useState<string | null>(null);
  const [moveModal, setMoveModal] = useState<{
    opportunity: GHLOpportunity;
    fromStage: string;
  } | null>(null);
  const [contactDetail, setContactDetail] = useState<GHLOpportunity | null>(null);

  const fetchBoard = useCallback(async (statusFilter: string) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);

      const response = await fetch(`/api/pipeline/board?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch pipeline board");

      const data = await response.json();
      setPipelines(data.pipelines);
    } catch {
      setError("Failed to load pipeline — GHL may be unavailable");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBoard(status);
  }, [fetchBoard, status]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      void fetchBoard(status);
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchBoard, status]);

  function handleRefresh() {
    void fetchBoard(status);
  }

  function handleStageClick(stageId: string, stageName: string) {
    if (selectedStage === stageId) {
      // Deselect — show all
      setSelectedStage(null);
      setSelectedStageName(null);
    } else {
      setSelectedStage(stageId);
      setSelectedStageName(stageName);
    }
  }

  // Build stage name lookup
  const stageNameMap = new Map<string, string>();
  for (const pipeline of pipelines) {
    for (const stage of pipeline.stages) {
      stageNameMap.set(stage.id, stage.name);
    }
  }

  // Get leads for the list — either all or filtered by selected stage
  function getListOpportunities(): GHLOpportunity[] {
    const all: GHLOpportunity[] = [];
    for (const pipeline of pipelines) {
      for (const stage of pipeline.stages) {
        if (selectedStage && stage.id !== selectedStage) continue;
        all.push(...stage.opportunities);
      }
    }
    return all;
  }

  function handleMoveClick(opportunity: GHLOpportunity) {
    const fromStageName = stageNameMap.get(opportunity.pipelineStageId) ?? "Unknown";
    setMoveModal({ opportunity, fromStage: fromStageName });
  }

  // For the move modal, build a list of available target stages
  const allStages = pipelines.flatMap((p) =>
    p.stages.map((s) => ({ id: s.id, name: s.name }))
  );

  // Count total leads
  const totalLeads = pipelines.reduce(
    (sum, p) => sum + p.stages.reduce((s, st) => s + st.opportunities.length, 0),
    0
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <h1 className="font-headline text-page-title text-text-primary">Path to Ownership</h1>
        {!loading && (
          <span className="text-caption text-text-tertiary ml-2">
            {totalLeads} {totalLeads === 1 ? "lead" : "leads"}
          </span>
        )}
      </div>

      {/* Filters */}
      <PipelineFilters
        onSearchChange={setSearchQuery}
        onStatusChange={setStatus}
        onRefresh={handleRefresh}
        loading={loading}
        currentStatus={status}
      />

      {/* Error banner */}
      {error && (
        <div className="mb-4 px-3 py-2 bg-warning/10 border border-warning/20 rounded-lg">
          <p className="text-body-sm text-warning">{error}</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && pipelines.length === 0 && (
        <div className="space-y-3 mb-6">
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 11 }).map((_, i) => (
              <div key={i} className="w-20 h-14 bg-bg-secondary border border-border-default rounded-lg animate-pulse" />
            ))}
          </div>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 bg-bg-secondary border border-border-default rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      )}

      {/* Path to Ownership — visual journey map */}
      {pipelines.length > 0 && (
        <OwnershipPath
          pipelines={pipelines}
          selectedStage={selectedStage}
          onStageClick={handleStageClick}
        />
      )}

      {/* Lead list — sorted by urgency */}
      {pipelines.length > 0 && (
        <LeadList
          opportunities={getListOpportunities()}
          stageName={selectedStageName}
          stageNameMap={stageNameMap}
          onContactClick={(opp) => setContactDetail(opp)}
          searchQuery={searchQuery}
        />
      )}

      {/* Contact Detail Panel */}
      {contactDetail && (
        <ContactDetail
          opportunity={contactDetail}
          stageName={stageNameMap.get(contactDetail.pipelineStageId) ?? "Unknown"}
          onClose={() => setContactDetail(null)}
          onMoveClick={(opp) => {
            setContactDetail(null);
            handleMoveClick(opp);
          }}
        />
      )}

      {/* Stage Move Modal */}
      {moveModal && (
        <StageMovePicker
          leadName={moveModal.opportunity.name}
          fromStage={moveModal.fromStage}
          stages={allStages}
          currentStageId={moveModal.opportunity.pipelineStageId}
          onConfirm={async (targetStageId, reason) => {
            const response = await fetch("/api/pipeline/move", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                opportunityId: moveModal.opportunity.id,
                targetStageId,
                reason,
              }),
            });
            if (!response.ok) {
              const data = await response.json();
              throw new Error(data.error ?? "Failed to move lead");
            }
            setMoveModal(null);
            handleRefresh();
          }}
          onCancel={() => setMoveModal(null)}
        />
      )}
    </div>
  );
}

/**
 * Stage Move Picker — lets user select which stage to move to
 * Used from the lead list (vs drag-and-drop which already knows the target)
 */
function StageMovePicker({
  leadName,
  fromStage,
  stages,
  currentStageId,
  onConfirm,
  onCancel,
}: {
  leadName: string;
  fromStage: string;
  stages: { id: string; name: string }[];
  currentStageId: string;
  onConfirm: (targetStageId: string, reason?: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableStages = stages.filter((s) => s.id !== currentStageId);
  const targetName = stages.find((s) => s.id === selectedTarget)?.name ?? "";

  async function handleConfirm() {
    if (!selectedTarget) return;
    setLoading(true);
    setError(null);
    try {
      await onConfirm(selectedTarget, reason || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move lead");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative bg-bg-tertiary border border-border-default rounded-lg w-full max-w-md mx-4 p-5">
        <h2 className="text-h2 text-text-primary mb-1">Move Lead</h2>
        <p className="text-body-sm text-text-secondary mb-4">
          {leadName} — currently in <span className="font-medium text-text-primary">{fromStage}</span>
        </p>

        {/* Target stage selector */}
        <label className="block mb-1 text-caption text-text-tertiary">Move to:</label>
        <div className="grid grid-cols-2 gap-2 mb-4 max-h-[240px] overflow-y-auto">
          {availableStages.map((stage) => (
            <button
              key={stage.id}
              onClick={() => setSelectedTarget(stage.id)}
              className={`
                px-3 py-2 rounded-md border text-body-sm text-left transition-colors
                ${selectedTarget === stage.id
                  ? "border-nah-orange bg-nah-orange/10 text-nah-orange"
                  : "border-border-default bg-bg-secondary text-text-secondary hover:border-border-hover"
                }
              `}
            >
              {stage.name}
            </button>
          ))}
        </div>

        {/* Reason */}
        {selectedTarget && (
          <>
            <label className="block mb-1 text-caption text-text-tertiary">Reason (optional)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Add a note..."
              className="w-full bg-bg-secondary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-nah-orange focus:outline-none resize-none mb-4"
              rows={2}
              disabled={loading}
            />
          </>
        )}

        {error && <p className="mb-2 text-body-sm text-danger">{error}</p>}

        <div className="flex gap-2">
          <button onClick={onCancel} className="btn-ghost px-4 py-2 text-body-sm" disabled={loading}>
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="btn-primary px-4 py-2 text-body-sm ml-auto"
            disabled={!selectedTarget || loading}
          >
            {loading ? "Moving..." : `Move to ${targetName || "..."}`}
          </button>
        </div>
      </div>
    </div>
  );
}
