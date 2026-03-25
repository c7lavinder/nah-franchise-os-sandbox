"use client";

interface StageCount {
  pipelineName: string;
  stageName: string;
  count: number;
}

interface PipelineFunnelChartProps {
  stages: StageCount[];
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

/** Gradient colors for funnel bars */
const BAR_COLORS = [
  "from-blue-500 to-blue-600",
  "from-blue-400 to-indigo-500",
  "from-indigo-500 to-purple-500",
  "from-purple-500 to-purple-600",
  "from-purple-600 to-violet-600",
  "from-violet-600 to-fuchsia-500",
  "from-fuchsia-500 to-pink-500",
  "from-pink-500 to-orange-500",
  "from-orange-500 to-amber-500",
  "from-amber-500 to-yellow-500",
  "from-yellow-500 to-green-500",
];

export default function PipelineFunnelChart({ stages }: PipelineFunnelChartProps) {
  const activeStages = stages.filter((s) => s.pipelineName === "Active");
  const longTermStages = stages.filter((s) => s.pipelineName === "Long-Term");
  const maxCount = Math.max(...activeStages.map((s) => s.count), 1);

  return (
    <div className="bg-bg-secondary border border-border-default rounded-lg p-4 mb-6">
      <h3 className="text-h2 text-text-primary mb-4">Pipeline Funnel</h3>

      {/* Active pipeline funnel */}
      <div className="space-y-2 mb-6">
        {activeStages.map((stage, i) => {
          const widthPct = Math.max((stage.count / maxCount) * 100, 2);
          const shortName = SHORT_NAMES[stage.stageName] ?? stage.stageName;
          const color = BAR_COLORS[i % BAR_COLORS.length];

          return (
            <div key={stage.stageName} className="flex items-center gap-3">
              <span className="text-caption text-text-tertiary w-[80px] text-right flex-shrink-0 truncate">
                {shortName}
              </span>
              <div className="flex-1 h-7 bg-bg-tertiary rounded overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${color} rounded flex items-center px-2 transition-all duration-500`}
                  style={{ width: `${widthPct}%` }}
                >
                  {stage.count > 0 && (
                    <span className="text-[11px] font-bold text-white whitespace-nowrap">
                      {stage.count}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Long-term pipeline */}
      {longTermStages.length > 0 && (
        <>
          <p className="text-overline text-text-tertiary tracking-wider mb-2">LONG-TERM</p>
          <div className="space-y-2">
            {longTermStages.map((stage) => {
              const shortName = SHORT_NAMES[stage.stageName] ?? stage.stageName;
              const widthPct = Math.max((stage.count / maxCount) * 100, 2);

              return (
                <div key={stage.stageName} className="flex items-center gap-3">
                  <span className="text-caption text-text-tertiary w-[80px] text-right flex-shrink-0 truncate">
                    {shortName}
                  </span>
                  <div className="flex-1 h-7 bg-bg-tertiary rounded overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-sky-500 to-cyan-600 rounded flex items-center px-2 transition-all duration-500"
                      style={{ width: `${widthPct}%` }}
                    >
                      {stage.count > 0 && (
                        <span className="text-[11px] font-bold text-white whitespace-nowrap">
                          {stage.count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
