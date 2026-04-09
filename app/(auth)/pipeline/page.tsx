"use client";

import { useState } from "react";
import { OwnershipPath, PipelineFilters } from "@/components/pipeline";
import PipelineLeadList from "@/components/pipeline/PipelineLeadList";

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
  const [refreshKey, setRefreshKey] = useState(0);

  function handleStageClick(stageId: string, stageName: string) {
    if (selectedStage === stageId) {
      setSelectedStage(null);
      setSelectedStageName(null);
    } else {
      setSelectedStage(stageId);
      setSelectedStageName(stageName);
    }
  }

  function handleRefresh() {
    setRefreshKey((k) => k + 1);
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <h1 className="font-headline text-page-title text-text-primary">Pipeline</h1>
      </div>

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

      {/* All Leads list — from Supabase */}
      <PipelineLeadList
        key={refreshKey}
        selectedStageId={selectedStage}
        selectedStageName={selectedStageName}
        searchQuery={searchQuery}
      />
    </div>
  );
}
