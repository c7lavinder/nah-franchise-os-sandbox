"use client";

import { TrendingUp } from "lucide-react";

interface ConversionChartProps {
  stageCounts: { stageName: string; pipelineName: string; count: number }[];
  wonCount: number;
  lostCount: number;
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

export default function ConversionChart({ stageCounts, wonCount, lostCount }: ConversionChartProps) {
  const activeStages = stageCounts.filter((s) => s.pipelineName === "Active");

  // Calculate cumulative conversion: what % of total pipeline made it to each stage
  const totalEntered = activeStages.reduce((sum, s) => sum + s.count, 0) + wonCount + lostCount;

  // Build conversion data — each stage shows cumulative leads that reached it or passed it
  const cumulativeData: { name: string; count: number; pct: number }[] = [];
  let cumulative = totalEntered;
  for (const stage of activeStages) {
    cumulativeData.push({
      name: SHORT_NAMES[stage.stageName] ?? stage.stageName,
      count: cumulative,
      pct: totalEntered > 0 ? Math.round((cumulative / totalEntered) * 100) : 0,
    });
    cumulative -= stage.count;
  }

  // Add won
  cumulativeData.push({
    name: "Won",
    count: wonCount,
    pct: totalEntered > 0 ? Math.round((wonCount / totalEntered) * 100) : 0,
  });

  const maxCount = Math.max(...cumulativeData.map((d) => d.count), 1);

  return (
    <div className="bg-bg-secondary border border-border-default rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={16} className="text-nah-orange" />
        <h3 className="text-h2 text-text-primary">Conversion by Stage</h3>
      </div>

      <div className="space-y-1.5">
        {cumulativeData.map((stage) => {
          const widthPct = Math.max((stage.count / maxCount) * 100, 3);

          return (
            <div key={stage.name} className="flex items-center gap-2">
              <span className="text-caption text-text-tertiary w-[70px] text-right truncate">
                {stage.name}
              </span>
              <div className="flex-1 h-5 bg-bg-tertiary rounded overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-nah-orange to-nah-orange-hover rounded flex items-center px-1.5 transition-all duration-500"
                  style={{ width: `${widthPct}%` }}
                >
                  {stage.pct > 5 && (
                    <span className="text-[10px] font-bold text-white whitespace-nowrap">
                      {stage.pct}%
                    </span>
                  )}
                </div>
              </div>
              <span className="text-caption text-text-tertiary w-[40px] text-right">
                {stage.count}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between mt-3 pt-3 border-t border-border-default text-caption text-text-tertiary">
        <span>Total entered: {totalEntered}</span>
        <span>Won: {wonCount} ({totalEntered > 0 ? Math.round((wonCount / totalEntered) * 100) : 0}%)</span>
        <span>Lost: {lostCount} ({totalEntered > 0 ? Math.round((lostCount / totalEntered) * 100) : 0}%)</span>
      </div>
    </div>
  );
}
