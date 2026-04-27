"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { GHLOpportunity } from "@/types/ghl";
import StageColumn from "./StageColumn";
import DragOverlayCard from "./DragOverlayCard";
import StageMoveModal from "./StageMoveModal";

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

interface PipelineBoardProps {
  pipelines: PipelineData[];
  searchQuery: string;
  onDataChange: () => void;
}

export default function PipelineBoard({ pipelines, searchQuery, onDataChange }: PipelineBoardProps) {
  const [activeOpp, setActiveOpp] = useState<GHLOpportunity | null>(null);
  const [moveModal, setMoveModal] = useState<{
    opportunity: GHLOpportunity;
    fromStage: string;
    toStageId: string;
    toStageName: string;
  } | null>(null);

  // Require a minimum drag distance to avoid accidental drags
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Build a stageId → stageName lookup
  const stageNameMap = new Map<string, string>();
  for (const pipeline of pipelines) {
    for (const stage of pipeline.stages) {
      stageNameMap.set(stage.id, stage.name);
    }
  }

  function handleDragStart(event: DragStartEvent) {
    const opp = event.active.data.current?.opportunity as GHLOpportunity | undefined;
    setActiveOpp(opp ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveOpp(null);

    const { active, over } = event;
    if (!over) return;

    const opp = active.data.current?.opportunity as GHLOpportunity | undefined;
    if (!opp) return;

    const targetStageId = over.id as string;

    // Don't open modal if dropped on same stage
    if (targetStageId === opp.pipelineStageId) return;

    const fromStageName = stageNameMap.get(opp.pipelineStageId) ?? "Unknown";
    const toStageName = stageNameMap.get(targetStageId) ?? "Unknown";

    setMoveModal({
      opportunity: opp,
      fromStage: fromStageName,
      toStageId: targetStageId,
      toStageName,
    });
  }

  /** Called when user clicks "Move to..." on mobile */
  function handleMobileMove(opportunity: GHLOpportunity) {
    const fromStageName = stageNameMap.get(opportunity.pipelineStageId) ?? "Unknown";
    // On mobile, we don't know the target yet — show a simple version
    // For now, reuse the same modal pattern but the user specifies the target
    setMoveModal({
      opportunity,
      fromStage: fromStageName,
      toStageId: "",
      toStageName: "Select target stage",
    });
  }

  async function handleConfirmMove(reason?: string) {
    if (!moveModal) return;

    const response = await apiFetch("/api/pipeline/move", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        opportunityId: moveModal.opportunity.id,
        targetStageId: moveModal.toStageId,
        reason,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error ?? "Failed to move prospect");
    }

    setMoveModal(null);
    onDataChange();
  }

  /** Filter opportunities by search query (client-side name match) */
  function filterBySearch(opportunities: GHLOpportunity[]): GHLOpportunity[] {
    if (!searchQuery) return opportunities;
    const q = searchQuery.toLowerCase();
    return opportunities.filter((o) => o.name.toLowerCase().includes(q));
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {pipelines.map((pipeline) => (
          <div key={pipeline.id} className="mb-8">
            <h2 className="text-h2 text-text-primary mb-3">{pipeline.name}</h2>
            <div className="flex gap-3 overflow-x-auto pb-4">
              {pipeline.stages.map((stage) => (
                <StageColumn
                  key={stage.id}
                  stageId={stage.id}
                  stageName={stage.name}
                  opportunities={filterBySearch(stage.opportunities)}
                  onMoveClick={handleMobileMove}
                />
              ))}
            </div>
          </div>
        ))}

        <DragOverlay>
          {activeOpp ? <DragOverlayCard opportunity={activeOpp} /> : null}
        </DragOverlay>
      </DndContext>

      {/* Stage Move Confirmation Modal */}
      {moveModal && moveModal.toStageId && (
        <StageMoveModal
          leadName={moveModal.opportunity.name}
          fromStage={moveModal.fromStage}
          toStage={moveModal.toStageName}
          onConfirm={handleConfirmMove}
          onCancel={() => setMoveModal(null)}
        />
      )}
    </>
  );
}
