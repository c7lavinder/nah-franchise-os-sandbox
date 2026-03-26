"use client";

import { useState, useEffect } from "react";
import { Brain, Loader2 } from "lucide-react";

interface ScoreDistributionData {
  high: number;
  medium: number;
  low: number;
  total: number;
}

/** Bar row for a single score tier */
function TierBar({
  label,
  count,
  total,
  color,
  bgColor,
  borderColor,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
  bgColor: string;
  borderColor: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div className="flex items-center gap-3">
      <span className={`text-caption font-medium w-16 flex-shrink-0 ${color}`}>
        {label}
      </span>
      <div className="flex-1 h-6 bg-bg-tertiary rounded-md overflow-hidden">
        <div
          className={`h-full ${bgColor} ${borderColor} border-r-2 rounded-md transition-all duration-500 flex items-center px-2`}
          style={{ width: `${Math.max(pct, 4)}%` }}
        >
          {pct >= 15 && (
            <span className={`text-[10px] font-bold ${color}`}>{count}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0 w-16 justify-end">
        <span className="text-body-sm font-bold text-text-primary">{count}</span>
        <span className="text-caption text-text-tertiary">({pct}%)</span>
      </div>
    </div>
  );
}

export default function ScoreDistribution() {
  const [data, setData] = useState<ScoreDistributionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchScores() {
      try {
        // Fetch all three tiers in parallel
        const [highRes, medRes, lowRes] = await Promise.all([
          fetch("/api/intelligence/scores?tier=high"),
          fetch("/api/intelligence/scores?tier=medium"),
          fetch("/api/intelligence/scores?tier=low"),
        ]);

        if (!highRes.ok || !medRes.ok || !lowRes.ok) {
          throw new Error("Failed to fetch score distribution");
        }

        const [highData, medData, lowData] = await Promise.all([
          highRes.json() as Promise<{ total: number }>,
          medRes.json() as Promise<{ total: number }>,
          lowRes.json() as Promise<{ total: number }>,
        ]);

        const high = highData.total ?? 0;
        const medium = medData.total ?? 0;
        const low = lowData.total ?? 0;

        setData({
          high,
          medium,
          low,
          total: high + medium + low,
        });
      } catch {
        setError("Unable to load scores");
      } finally {
        setLoading(false);
      }
    }

    void fetchScores();
  }, []);

  return (
    <div className="bg-bg-secondary border border-border-default rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-scout-purple/10 flex items-center justify-center">
          <Brain size={16} className="text-scout-purple" />
        </div>
        <div>
          <h3 className="font-headline text-card-title text-text-primary">
            Intelligence Score Distribution
          </h3>
          {data && (
            <p className="text-caption text-text-tertiary">
              {data.total} profiled candidate{data.total !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={16} className="animate-spin text-text-tertiary" />
        </div>
      )}

      {error && (
        <div className="py-4 text-center">
          <p className="text-caption text-text-tertiary">{error}</p>
        </div>
      )}

      {data && (
        <div className="space-y-3">
          <TierBar
            label="High"
            count={data.high}
            total={data.total}
            color="text-success"
            bgColor="bg-success/20"
            borderColor="border-success/40"
          />
          <TierBar
            label="Medium"
            count={data.medium}
            total={data.total}
            color="text-[#d97706]"
            bgColor="bg-warning/20"
            borderColor="border-warning/40"
          />
          <TierBar
            label="Low"
            count={data.low}
            total={data.total}
            color="text-danger"
            bgColor="bg-danger/20"
            borderColor="border-danger/40"
          />
        </div>
      )}
    </div>
  );
}
