"use client";

import { useState } from "react";
import { OwnershipPath, PipelineFilters } from "@/components/pipeline";
import PipelineLeadList from "@/components/pipeline/PipelineLeadList";
import TerritoryCardList from "@/components/pipeline/TerritoryCardList";
import ScoreCardRow from "@/components/scorecards/ScoreCardRow";
import AddProspectModal from "@/components/pipeline/AddProspectModal";

/**
 * Pipeline Page — Sprint 3 Rewire
 *
 * Top: OwnershipPath shows 6-stage Sales + 3-stage Follow-up (from Supabase)
 * Bottom: All Leads list from journey_pipeline_state (from Supabase)
 *
 * Click a stage circle to filter the list to just that stage.
 */
export default function PipelinePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [selectedStageName, setSelectedStageName] = useState<string | null>(null);
  const [showTerritories, setShowTerritories] = useState(false);
  const [selectedTerritoryStatus, setSelectedTerritoryStatus] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showAddProspect, setShowAddProspect] = useState(false);

  // Pipelines where clicking a stage should show territories, not prospects
  const TERRITORY_PIPELINES = new Set(["onboarding", "runway", "territories"]);

  function handleStageClick(stageId: string, stageName: string, pipelineSlug: string) {
    if (selectedStage === stageId) {
      setSelectedStage(null);
      setSelectedStageName(null);
      setShowTerritories(false);
      setSelectedTerritoryStatus(null);
    } else {
      setSelectedStage(stageId);
      setSelectedStageName(stageName);

      if (TERRITORY_PIPELINES.has(pipelineSlug)) {
        setShowTerritories(true);
        const lowerName = stageName.toLowerCase();
        if (lowerName === "active" || lowerName === "inactive" || lowerName === "available") {
          setSelectedTerritoryStatus(lowerName);
        } else {
          setSelectedTerritoryStatus(null);
        }
      } else {
        setShowTerritories(false);
        setSelectedTerritoryStatus(null);
      }
    }
  }

  function handleRefresh() {
    setRefreshKey((k) => k + 1);
  }

  return (
    <div>
      {/* Scorecards */}
      <ScoreCardRow page="pipeline" />

      {/* Filters */}
      <PipelineFilters
        onSearchChange={setSearchQuery}
        onRefresh={handleRefresh}
        onAddProspect={() => setShowAddProspect(true)}
        loading={false}
      />

      {/* Path to Ownership + Long-Term visual */}
      <OwnershipPath selectedStage={selectedStage} onStageClick={handleStageClick} />

      {/* Journeys list — always visible, filtered by stage when selected */}
      <PipelineLeadList
        key={refreshKey}
        selectedStageId={selectedStage}
        selectedStageName={selectedStageName}
        searchQuery={searchQuery}
      />

      {/* Territory Cards — only show when no stage selected or onboarding/runway/territories selected */}
      {(!selectedStage || showTerritories) && (
        <div className="mt-8">
          <TerritoryCardList statusFilter={selectedTerritoryStatus} stageId={selectedStage} searchQuery={searchQuery} />
        </div>
      )}

      {/* Add Prospect Modal */}
      <AddProspectModal open={showAddProspect} onClose={() => setShowAddProspect(false)} onCreated={handleRefresh} />
    </div>
  );
}
