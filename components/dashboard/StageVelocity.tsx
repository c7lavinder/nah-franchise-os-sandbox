"use client";

import { Clock } from "lucide-react";

interface StageCount {
  pipelineName: string;
  stageName: string;
  count: number;
  avgDays?: number;
}

interface StageVelocityProps {
  stages: StageCount[];
}

/** Short labels */
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
};

export default function StageVelocity({ stages }: StageVelocityProps) {
  const activeStages = stages.filter((s) => s.pipelineName === "Active");

  return (
    <div className="bg-bg-secondary border border-border-default rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Clock size={16} className="text-info" />
        <h3 className="text-h2 text-text-primary">Stage Velocity</h3>
      </div>

      <div className="space-y-2">
        {activeStages.map((stage) => {
          const shortName = SHORT_NAMES[stage.stageName] ?? stage.stageName;
          const avgDays = stage.avgDays ?? 0;

          return (
            <div key={stage.stageName} className="flex items-center justify-between px-2 py-1.5">
              <span className="text-body-sm text-text-primary w-[90px] truncate">{shortName}</span>
              <div className="flex-1 mx-3">
                <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      avgDays > 14 ? "bg-danger" : avgDays > 7 ? "bg-warning" : "bg-success"
                    }`}
                    style={{ width: `${Math.min((avgDays / 30) * 100, 100)}%` }}
                  />
                </div>
              </div>
              <span className={`text-body-sm font-semibold w-[50px] text-right ${
                avgDays > 14 ? "text-danger" : avgDays > 7 ? "text-warning" : "text-success"
              }`}>
                {avgDays > 0 ? `${avgDays}d` : "—"}
              </span>
            </div>
          );
        })}
      </div>

      {activeStages.every((s) => !s.avgDays) && (
        <p className="text-caption text-text-tertiary text-center mt-3 pt-3 border-t border-border-default">
          Velocity data will populate as leads move through stages over time
        </p>
      )}
    </div>
  );
}
