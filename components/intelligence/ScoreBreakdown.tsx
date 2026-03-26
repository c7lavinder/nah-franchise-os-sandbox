"use client";

/**
 * ScoreBreakdown — reusable score display for candidate intelligence.
 * Shows total score prominently with 4 horizontal progress bars.
 */

interface ScoreBreakdownProps {
  financial: number;
  operational: number;
  engagement: number;
  momentum: number;
  total: number;
}

const BUCKETS: {
  key: keyof Omit<ScoreBreakdownProps, "total">;
  label: string;
  color: string;
  bgColor: string;
}[] = [
  { key: "financial", label: "Financial", color: "bg-nah-blue", bgColor: "bg-nah-blue-light" },
  { key: "operational", label: "Operational", color: "bg-success", bgColor: "bg-[#e8f5e9]" },
  { key: "engagement", label: "Engagement", color: "bg-accent-yellow", bgColor: "bg-accent-yellow-light" },
  { key: "momentum", label: "Momentum", color: "bg-[#7c3aed]", bgColor: "bg-[#f3e8ff]" },
];

export default function ScoreBreakdown({
  financial,
  operational,
  engagement,
  momentum,
  total,
}: ScoreBreakdownProps) {
  const scores = { financial, operational, engagement, momentum };

  /** Score color based on total out of 100 */
  function totalColor(): string {
    if (total >= 75) return "text-success";
    if (total >= 50) return "text-nah-blue";
    if (total >= 25) return "text-accent-yellow";
    return "text-danger";
  }

  return (
    <div className="rounded-lg border border-border-default bg-surface-glass p-5">
      {/* Total score */}
      <div className="flex items-end gap-2 mb-5">
        <span className={`text-metric font-headline ${totalColor()}`}>{total}</span>
        <span className="text-body text-text-tertiary mb-1">/ 100</span>
      </div>

      {/* 4 buckets */}
      <div className="space-y-3">
        {BUCKETS.map((bucket) => {
          const value = scores[bucket.key];
          const pct = Math.round((value / 25) * 100);

          return (
            <div key={bucket.key}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-body-sm text-text-secondary">{bucket.label}</span>
                <span className="text-body-sm font-medium text-text-primary">{value}/25</span>
              </div>
              <div className={`h-2 rounded-full ${bucket.bgColor} overflow-hidden`}>
                <div
                  className={`h-full rounded-full ${bucket.color} transition-all duration-500`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
