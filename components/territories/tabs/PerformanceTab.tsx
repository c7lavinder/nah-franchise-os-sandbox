"use client";
import { apiFetch } from "@/lib/auth/api-fetch";
import { useState, useEffect, useCallback } from "react";
import { Loader2, TrendingUp, Home, DollarSign, Clock, Target } from "lucide-react";

interface KPIs {
  purchasedYTD: number;
  soldYTD: number;
  activeInventory: number;
  avgProfit: number;
  totalProfit: number;
  leadsInPeriod: number;
  conversionRate: number | null;
  medianCycleDays: number | null;
}

interface PerformanceData {
  funnel: Record<string, number>;
  kpis: KPIs;
  period: string;
}

type Period = "t1" | "t3" | "t12";

const PERIOD_LABELS: Record<Period, string> = {
  t1: "Last Month",
  t3: "Last 3 Months",
  t12: "Last 12 Months",
};

function Stat({
  label,
  value,
  icon: Icon,
  sub,
}: {
  label: string;
  value: string | number;
  icon?: React.ElementType;
  sub?: string;
}) {
  return (
    <div className="bg-bg-secondary rounded-lg p-3">
      <div className="flex items-center gap-1.5 text-caption text-text-tertiary mb-1">
        {Icon && <Icon size={12} />}
        {label}
      </div>
      <div className="text-lg font-bold text-text-primary">{value}</div>
      {sub && <div className="text-caption text-text-tertiary">{sub}</div>}
    </div>
  );
}

const FUNNEL_STAGES = [
  { key: "1", label: "Stage 1", color: "bg-blue-400" },
  { key: "2", label: "Stage 2", color: "bg-blue-500" },
  { key: "3", label: "Stage 3", color: "bg-indigo-500" },
  { key: "4", label: "Stage 4", color: "bg-purple-500" },
  { key: "5 Contract", label: "Contract", color: "bg-orange-500" },
  { key: "6 Purchase", label: "Purchased", color: "bg-green-500" },
];

export default function PerformanceTab({ TerritorySlug }: { TerritorySlug: string }) {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("t3");

  const fetchData = useCallback(
    async (p: Period) => {
      setLoading(true);
      try {
        const res = await apiFetch(`/api/territories/${TerritorySlug}/performance?period=${p}`);
        if (res.ok) setData(await res.json());
      } catch {
        /* silent */
      }
      setLoading(false);
    },
    [TerritorySlug]
  );

  useEffect(() => {
    void fetchData(period);
  }, [period, fetchData]);

  function handlePeriodChange(p: Period) {
    setPeriod(p);
  }

  if (loading && !data)
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin" size={24} />
      </div>
    );
  if (!data) return <div className="text-text-secondary py-6">No performance data available.</div>;

  const { funnel, kpis } = data;
  const maxFunnel = Math.max(...FUNNEL_STAGES.map((s) => funnel[s.key] || 0), 1);

  return (
    <div className="space-y-6">
      {/* Period Toggle */}
      <div className="flex items-center gap-1 bg-bg-secondary border border-border-default rounded-lg p-1 w-fit">
        {(["t1", "t3", "t12"] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => handlePeriodChange(p)}
            className={`px-3 py-1.5 text-caption font-medium rounded-md transition-colors ${
              period === p ? "bg-nah-orange text-white shadow-sm" : "text-text-tertiary hover:text-text-primary"
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
        {loading && <Loader2 size={14} className="animate-spin text-text-tertiary ml-2" />}
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Leads Entered" value={kpis.leadsInPeriod} icon={TrendingUp} sub={PERIOD_LABELS[period]} />
        <Stat
          label="Conversion"
          value={kpis.conversionRate != null ? `${kpis.conversionRate}%` : "—"}
          icon={Target}
          sub="S1+ → S4+"
        />
        <Stat label="Active Inventory" value={kpis.activeInventory} icon={Home} sub="purchased, not sold" />
        <Stat label="Cycle Days" value={kpis.medianCycleDays ?? "—"} icon={Clock} sub="median" />
        <Stat
          label="Avg Profit"
          value={kpis.avgProfit > 0 ? `$${kpis.avgProfit.toLocaleString()}` : "—"}
          icon={DollarSign}
          sub="per flip YTD"
        />
        <Stat
          label="Total Profit"
          value={kpis.totalProfit > 0 ? `$${kpis.totalProfit.toLocaleString()}` : "—"}
          icon={DollarSign}
          sub="YTD"
        />
      </div>

      {/* Property Funnel — entries per stage in period */}
      <div className="bg-bg-primary border border-border-default rounded-lg p-5">
        <h3 className="text-body-sm font-semibold text-text-primary mb-1">Property Funnel</h3>
        <p className="text-caption text-text-tertiary mb-4">
          Unique properties reaching each stage — {PERIOD_LABELS[period]}
        </p>
        <div className="space-y-2">
          {FUNNEL_STAGES.map((stage) => {
            const count = funnel[stage.key] || 0;
            const pct = (count / maxFunnel) * 100;
            return (
              <div key={stage.key} className="flex items-center gap-3">
                <span className="w-16 text-caption text-text-tertiary text-right shrink-0">{stage.label}</span>
                <div className="flex-1 bg-bg-secondary rounded-full h-5 overflow-hidden">
                  <div
                    className={`h-full ${stage.color} rounded-full transition-all`}
                    style={{ width: `${Math.max(pct, count > 0 ? 3 : 0)}%` }}
                  />
                </div>
                <span className="w-8 text-body-sm font-medium text-text-primary text-right">{count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
