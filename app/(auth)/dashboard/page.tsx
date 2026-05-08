"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/auth/api-fetch";
import { Users, TrendingUp, Target, Award, BarChart3, Clock, Trophy, AlertTriangle } from "lucide-react";

/** Dashboard data shape from /api/dashboard */
interface DashboardData {
  kpis: {
    activeLeads: number;
    won: number;
    lost: number;
    conversionRate: number;
    totalContacts: number;
  };
  funnel: { pipelineName: string; stageName: string; count: number; avgDays: number }[];
  sources: { name: string; count: number; color: string }[];
  period: string;
}

type Period = "week" | "month" | "quarter" | "year";

/** KPI card with icon and optional trend indicator */
function KPICard({
  label,
  value,
  icon: Icon,
  color,
  suffix,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  suffix?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-400">{label}</span>
        <div className={`rounded-lg p-2 ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 flex items-end gap-1">
        <span className="text-3xl font-bold text-white">{value.toLocaleString()}</span>
        {suffix && <span className="mb-1 text-sm text-zinc-400">{suffix}</span>}
      </div>
    </div>
  );
}

/** Horizontal bar chart for pipeline funnel */
function FunnelChart({ data }: { data: DashboardData["funnel"] }) {
  // Filter to only Sales pipeline for the funnel view
  const salesStages = data.filter((d) => d.pipelineName.toLowerCase().includes("sales"));
  const maxCount = Math.max(...salesStages.map((s) => s.count), 1);

  if (salesStages.length === 0) {
    return <div className="text-sm text-zinc-500">No pipeline data available</div>;
  }

  return (
    <div className="space-y-3">
      {salesStages.map((stage, i) => {
        const widthPct = Math.max((stage.count / maxCount) * 100, 4);
        // Gradient from purple to green across stages
        const hue = 270 - (i / Math.max(salesStages.length - 1, 1)) * 150;
        return (
          <div key={stage.stageName} className="group">
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-zinc-300">{stage.stageName}</span>
              <div className="flex items-center gap-3">
                {stage.avgDays > 0 && (
                  <span className="flex items-center gap-1 text-xs text-zinc-500">
                    <Clock className="h-3 w-3" />
                    {stage.avgDays}d avg
                  </span>
                )}
                <span className="font-semibold text-white">{stage.count}</span>
              </div>
            </div>
            <div className="h-6 w-full overflow-hidden rounded-md bg-zinc-800">
              <div
                className="h-full rounded-md transition-all duration-500"
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: `hsl(${hue}, 70%, 55%)`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Donut-style chart for lead sources */
function SourceChart({ sources }: { sources: DashboardData["sources"] }) {
  const total = sources.reduce((sum, s) => sum + s.count, 0);
  if (total === 0) {
    return <div className="text-sm text-zinc-500">No source data available</div>;
  }

  // Build SVG donut segments
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let accumulated = 0;

  const segments = sources
    .filter((s) => s.count > 0)
    .map((source) => {
      const pct = source.count / total;
      const dashLength = pct * circumference;
      const dashOffset = -accumulated * circumference;
      accumulated += pct;
      return { ...source, pct, dashLength, dashOffset };
    });

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
      {/* SVG donut */}
      <div className="relative flex-shrink-0">
        <svg width="160" height="160" viewBox="0 0 160 160">
          {segments.map((seg, i) => (
            <circle
              key={i}
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth="20"
              strokeDasharray={`${seg.dashLength} ${circumference - seg.dashLength}`}
              strokeDashoffset={seg.dashOffset}
              transform="rotate(-90 80 80)"
              className="transition-all duration-500"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white">{total}</span>
          <span className="text-xs text-zinc-400">total</span>
        </div>
      </div>

      {/* Legend */}
      <div className="space-y-2">
        {segments.map((seg) => (
          <div key={seg.name} className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: seg.color }} />
            <span className="text-sm text-zinc-300">{seg.name}</span>
            <span className="ml-auto text-sm font-medium text-white">{seg.count}</span>
            <span className="text-xs text-zinc-500">({Math.round(seg.pct * 100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** All-pipelines stage breakdown table */
function PipelineBreakdown({ data }: { data: DashboardData["funnel"] }) {
  // Group by pipeline
  const grouped = new Map<string, DashboardData["funnel"]>();
  for (const row of data) {
    const existing = grouped.get(row.pipelineName) ?? [];
    existing.push(row);
    grouped.set(row.pipelineName, existing);
  }

  return (
    <div className="space-y-4">
      {Array.from(grouped.entries()).map(([pipelineName, stages]) => {
        const total = stages.reduce((sum, s) => sum + s.count, 0);
        if (total === 0) return null;
        return (
          <div key={pipelineName}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-300">{pipelineName}</span>
              <span className="text-xs text-zinc-500">{total} active</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {stages.map((stage) => (
                <div key={stage.stageName} className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
                  <div className="text-lg font-bold text-white">{stage.count}</div>
                  <div className="text-xs text-zinc-400">{stage.stageName}</div>
                  {stage.avgDays > 0 && <div className="mt-1 text-xs text-zinc-600">{stage.avgDays}d avg</div>}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Conversion funnel data */
interface FunnelStage {
  stageName: string;
  entered: number;
  currentlyActive: number;
  advanced: number;
  conversionRate: number;
  dropOffRate: number;
  avgDaysInStage: number;
  isTerminal: boolean;
}

/** Visual conversion funnel with drop-off arrows */
function ConversionFunnel({ stages }: { stages: FunnelStage[] }) {
  if (stages.length === 0) {
    return <div className="text-sm text-zinc-500">No conversion data yet</div>;
  }

  const maxEntered = Math.max(...stages.map((s) => s.entered), 1);

  return (
    <div className="space-y-1">
      {stages.map((stage, i) => {
        const widthPct = Math.max((stage.entered / maxEntered) * 100, 8);
        const isLast = i === stages.length - 1;

        return (
          <div key={stage.stageName}>
            {/* Stage bar */}
            <div className="flex items-center gap-3">
              <div className="w-28 flex-shrink-0 text-right text-xs text-zinc-400">{stage.stageName}</div>
              <div className="flex-1">
                <div
                  className="flex items-center justify-between rounded-md bg-purple-600/30 px-3 py-1.5 transition-all"
                  style={{ width: `${widthPct}%`, minWidth: "80px" }}
                >
                  <span className="text-xs font-semibold text-white">{stage.entered}</span>
                  <span className="text-xs text-purple-300">{stage.avgDaysInStage}d avg</span>
                </div>
              </div>
              <div className="w-16 flex-shrink-0 text-right text-xs">
                <span className="text-zinc-400">{stage.currentlyActive} now</span>
              </div>
            </div>

            {/* Conversion arrow between stages */}
            {!isLast && (
              <div className="ml-28 flex items-center gap-2 py-0.5 pl-3">
                <div className="text-xs text-zinc-600">|</div>
                <span
                  className={`text-xs font-medium ${stage.conversionRate >= 50 ? "text-green-400" : stage.conversionRate >= 25 ? "text-amber-400" : "text-red-400"}`}
                >
                  {stage.conversionRate}% advance
                </span>
                {stage.dropOffRate > 0 && <span className="text-xs text-zinc-600">({stage.dropOffRate}% drop)</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Rep leaderboard data */
interface RepMetrics {
  userId: string;
  userName: string;
  role: string;
  activeLeads: number;
  stagesAdvanced: number;
  callsGraded: number;
  avgGradeScore: number;
  avgGradeLetter: string;
  scoutActions: number;
  stalledLeads: number;
}

/** Rep leaderboard table */
function RepLeaderboard({ reps }: { reps: RepMetrics[] }) {
  if (reps.length === 0) {
    return <div className="text-sm text-zinc-500">No rep activity in this period</div>;
  }

  function gradeColor(letter: string) {
    if (letter.startsWith("A")) return "text-green-400";
    if (letter.startsWith("B")) return "text-blue-400";
    if (letter.startsWith("C")) return "text-yellow-400";
    return "text-red-400";
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
            <th className="pb-2 pr-4">#</th>
            <th className="pb-2 pr-4">Rep</th>
            <th className="pb-2 pr-4 text-right">Leads</th>
            <th className="pb-2 pr-4 text-right">Advanced</th>
            <th className="pb-2 pr-4 text-right">Calls</th>
            <th className="pb-2 pr-4 text-right">Avg Grade</th>
            <th className="pb-2 pr-4 text-right">Actions</th>
            <th className="pb-2 text-right">Stalled</th>
          </tr>
        </thead>
        <tbody>
          {reps.map((rep, i) => (
            <tr key={rep.userId} className="border-b border-zinc-800/50">
              <td className="py-2 pr-4 text-zinc-500">{i + 1}</td>
              <td className="py-2 pr-4 font-medium text-white">{rep.userName}</td>
              <td className="py-2 pr-4 text-right text-zinc-300">{rep.activeLeads}</td>
              <td className="py-2 pr-4 text-right font-semibold text-green-400">{rep.stagesAdvanced}</td>
              <td className="py-2 pr-4 text-right text-zinc-300">{rep.callsGraded}</td>
              <td className={`py-2 pr-4 text-right font-bold ${gradeColor(rep.avgGradeLetter)}`}>
                {rep.avgGradeLetter !== "-" ? `${rep.avgGradeLetter} (${rep.avgGradeScore})` : "-"}
              </td>
              <td className="py-2 pr-4 text-right text-zinc-300">{rep.scoutActions}</td>
              <td className="py-2 text-right">
                {rep.stalledLeads > 0 ? (
                  <span className="flex items-center justify-end gap-1 text-amber-400">
                    <AlertTriangle className="h-3 w-3" />
                    {rep.stalledLeads}
                  </span>
                ) : (
                  <span className="text-zinc-600">0</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [leaderboard, setLeaderboard] = useState<RepMetrics[]>([]);
  const [funnelStages, setFunnelStages] = useState<FunnelStage[]>([]);
  const [funnelOverall, setFunnelOverall] = useState(0);
  const [period, setPeriod] = useState<Period>("month");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async (p: Period) => {
    setLoading(true);
    setError(null);
    try {
      const [dashRes, lbRes, funnelRes] = await Promise.all([
        apiFetch(`/api/dashboard?period=${p}`),
        apiFetch(`/api/metrics/rep-leaderboard?period=${p}`),
        apiFetch(`/api/metrics/conversion-funnel?pipeline=sales&period=${p}`),
      ]);
      if (!dashRes.ok) throw new Error("Failed to load dashboard");
      const json = await dashRes.json();
      setData(json);

      if (lbRes.ok) {
        const lbJson = await lbRes.json();
        setLeaderboard(lbJson.leaderboard ?? []);
      }

      if (funnelRes.ok) {
        const funnelJson = await funnelRes.json();
        setFunnelStages(funnelJson.funnel ?? []);
        setFunnelOverall(funnelJson.overallConversion ?? 0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard(period);
  }, [period, fetchDashboard]);

  const periods: { value: Period; label: string }[] = [
    { value: "week", label: "7 days" },
    { value: "month", label: "30 days" },
    { value: "quarter", label: "90 days" },
    { value: "year", label: "1 year" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-zinc-400">Pipeline health at a glance</p>
        </div>
        <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900/60 p-1">
          {periods.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                period === p.value ? "bg-purple-600 text-white" : "text-zinc-400 hover:text-white"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading && !data && (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
        </div>
      )}

      {error && <div className="rounded-lg border border-red-800 bg-red-900/20 p-4 text-sm text-red-400">{error}</div>}

      {data && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KPICard
              label="Active Leads"
              value={data.kpis.activeLeads}
              icon={Users}
              color="bg-purple-900/50 text-purple-400"
            />
            <KPICard label="Won" value={data.kpis.won} icon={Award} color="bg-green-900/50 text-green-400" />
            <KPICard
              label="Conversion Rate"
              value={data.kpis.conversionRate}
              icon={TrendingUp}
              color="bg-blue-900/50 text-blue-400"
              suffix="%"
            />
            <KPICard
              label="Total Contacts"
              value={data.kpis.totalContacts}
              icon={Target}
              color="bg-amber-900/50 text-amber-400"
            />
          </div>

          {/* Main charts row */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Sales Funnel */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
              <div className="mb-4 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-purple-400" />
                <h2 className="text-sm font-semibold text-white">Sales Funnel</h2>
              </div>
              <FunnelChart data={data.funnel} />
            </div>

            {/* Lead Sources */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
              <div className="mb-4 flex items-center gap-2">
                <Target className="h-4 w-4 text-amber-400" />
                <h2 className="text-sm font-semibold text-white">Lead Sources</h2>
              </div>
              <SourceChart sources={data.sources} />
            </div>
          </div>

          {/* Conversion Funnel */}
          {funnelStages.length > 0 && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-400" />
                  <h2 className="text-sm font-semibold text-white">Sales Conversion Funnel</h2>
                </div>
                <span className="text-xs text-zinc-400">
                  Overall: <span className="font-bold text-white">{funnelOverall}%</span>
                </span>
              </div>
              <ConversionFunnel stages={funnelStages} />
            </div>
          )}

          {/* All pipelines breakdown */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-400" />
              <h2 className="text-sm font-semibold text-white">All Pipelines</h2>
            </div>
            <PipelineBreakdown data={data.funnel} />
          </div>

          {/* Rep Leaderboard */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
            <div className="mb-4 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-white">Rep Performance</h2>
            </div>
            <RepLeaderboard reps={leaderboard} />
          </div>
        </>
      )}
    </div>
  );
}
