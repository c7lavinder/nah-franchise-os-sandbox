"use client";

import { useState } from "react";
import { OwnershipPath, PipelineFilters } from "@/components/pipeline";
import PipelineLeadList from "@/components/pipeline/PipelineLeadList";
import TerritoryCardList from "@/components/pipeline/TerritoryCardList";
import ScoreCardRow from "@/components/scorecards/ScoreCardRow";

/**
 * Pipeline Page — Sprint 3 Rewire
 *
 * Top: OwnershipPath shows 6-stage Sales + 3-stage Follow-up (from Supabase)
 * Bottom: All Leads list from contact_pipeline_state (from Supabase)
 *
 * Click a stage circle to filter the list to just that stage.
 */
export default function PipelinePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [selectedStageName, setSelectedStageName] = useState<string | null>(null);
  const [selectedTerritoryStatus, setSelectedTerritoryStatus] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  function handleStageClick(stageId: string, stageName: string) {
    if (selectedStage === stageId) {
      setSelectedStage(null);
      setSelectedStageName(null);
      setSelectedTerritoryStatus(null);
    } else {
      setSelectedStage(stageId);
      setSelectedStageName(stageName);
      // Check if this is a territory status stage
      const lowerName = stageName.toLowerCase();
      if (lowerName === "active" || lowerName === "inactive" || lowerName === "available") {
        setSelectedTerritoryStatus(lowerName);
      } else {
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
        loading={false}
      />

      {/* Path to Ownership + Long-Term visual */}
      <OwnershipPath
        selectedStage={selectedStage}
        onStageClick={handleStageClick}
      />

      {/* All Leads list — from Supabase (hide when territory stage selected) */}
      {!selectedTerritoryStatus && (
        <PipelineLeadList
          key={refreshKey}
          selectedStageId={selectedStage}
          selectedStageName={selectedStageName}
          searchQuery={searchQuery}
        />
      )}

      {/* Territory Cards — Territories pipeline */}
      <div className={selectedTerritoryStatus ? "" : "mt-8"}>
        {!selectedTerritoryStatus && (
          <h2 className="text-overline text-text-tertiary tracking-wider mb-4">TERRITORY NETWORK</h2>
        )}
        <TerritoryCardList statusFilter={selectedTerritoryStatus} searchQuery={searchQuery} />
      </div>
    </div>
  );
}
