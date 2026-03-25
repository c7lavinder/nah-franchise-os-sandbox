"use client";

import type { GHLOpportunity } from "@/types/ghl";

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

interface PipelineFunnelProps {
  pipelines: PipelineData[];
  selectedStage: string | null;
  onStageClick: (stageId: string, stageName: string) => void;
}

/** Short labels for compact display */
const SHORT_NAMES: Record<string, string> = {
  "New Lead": "New",
  "Contacted": "Contacted",
  "Qualified": "Qualified",
  "Matt Call (Discovery)": "Matt Call",
  "Sam Call (Validation)": "Sam Call",
  "Compliance Gate": "Compliance",
  "Application + Approval": "Application",
  "FDD Issued": "FDD",
  "Mark Call (Capital/Lending)": "Mark Call",
  "Award + Agreement": "Award",
  "Funds Received": "Won",
  "Follow-up": "Follow-up",
  "Nurture": "Nurture",
  "Re-engaged": "Re-engaged",
};

/** Color based on pipeline position */
function stageColor(stageName: string, isSelected: boolean): string {
  if (isSelected) return "bg-nah-orange text-white";

  // Active pipeline progression: cool → warm
  const warmStages = ["Award + Agreement", "Funds Received", "Matt Final/Documents Submitted"];
  const hotStages = ["FDD Issued", "Mark Call (Capital/Lending)"];
  const midStages = ["Matt Call (Discovery)", "Sam Call (Validation)", "Compliance Gate", "Application + Approval"];
  const longTermStages = ["Follow-up", "Nurture", "Re-engaged"];

  if (warmStages.some((s) => stageName.includes(s))) return "bg-success/20 text-success border-success/30";
  if (hotStages.some((s) => stageName.includes(s))) return "bg-warning/20 text-warning border-warning/30";
  if (midStages.some((s) => stageName.includes(s))) return "bg-scout-purple/20 text-scout-purple border-scout-purple/30";
  if (longTermStages.some((s) => stageName.includes(s))) return "bg-info/20 text-info border-info/30";
  return "bg-bg-tertiary text-text-secondary border-border-default";
}

export default function PipelineFunnel({ pipelines, selectedStage, onStageClick }: PipelineFunnelProps) {
  return (
    <div className="space-y-4 mb-6">
      {pipelines.map((pipeline) => {
        const totalLeads = pipeline.stages.reduce((sum, s) => sum + s.opportunities.length, 0);

        return (
          <div key={pipeline.id}>
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-body-sm text-text-secondary font-medium">
                {pipeline.name.replace("NAH Franchise Sales - ", "")}
              </h2>
              <span className="text-caption text-text-tertiary">
                {totalLeads} leads
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {pipeline.stages.map((stage) => {
                const count = stage.opportunities.length;
                const isSelected = selectedStage === stage.id;
                const shortName = SHORT_NAMES[stage.name] ?? stage.name;
                const colorClass = stageColor(stage.name, isSelected);

                return (
                  <button
                    key={stage.id}
                    onClick={() => onStageClick(stage.id, stage.name)}
                    className={`
                      px-3 py-2 rounded-lg border text-body-sm font-medium
                      transition-all duration-150 hover:scale-105
                      ${colorClass}
                      ${count === 0 ? "opacity-50" : ""}
                    `}
                  >
                    <div className="text-center">
                      <div className="text-lg font-bold leading-tight">{count}</div>
                      <div className="text-caption leading-tight whitespace-nowrap">{shortName}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
