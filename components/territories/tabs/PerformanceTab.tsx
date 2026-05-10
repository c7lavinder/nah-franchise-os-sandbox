"use client";
import { apiFetch } from "@/lib/auth/api-fetch";
import { useState, useEffect, useCallback } from "react";
import { Loader2, DollarSign, Clock, Target, TrendingUp, AlertTriangle, Home, Package } from "lucide-react";

interface FunnelStage {
  stage: string;
  count: number;
}

interface PropertyRow {
  propertyId: number;
  address: string;
  purchaseDate: string;
  sellDate?: string | null;
  daysHeld: number;
  profit?: number | null;
  arv?: number | null;
  projectedProfit?: number | null;
  leadCategory?: string | null;
}

interface KPIs {
  leadsEntered: number;
  activeInventory: number;
  soldInPeriod: number;
  avgProfit: number | null;
  totalProfit: number | null;
  medianCycleDays: number | null;
  conversionRate: number | null;
}

interface PerformanceData {
  kpis: KPIs | null;
  funnel: FunnelStage[];
  soldProperties: PropertyRow[];
  inventoryProperties: PropertyRow[];
  leadCategories: Record<string, number>;
  period: string;
}

type Period = "t1" | "t3" | "t12";

const PERIOD_LABELS: Record<Period, string> = {
  t1: "Last Month",
  t3: "Last 3 Months",
  t12: "Last 12 Months",
};

const STAGE_LABELS: Record<string, string> = {
  "1": "Stage 1",
  "2": "Stage 2",
  "3": "Stage 3",
  "4": "Stage 4",
  "5 Contract": "Contract",
  "6 Purchase": "Purchased",
};

const STAGE_COLORS: Record<string, string> = {
  "1": "#60a5fa",
  "2": "#3b82f6",
  "3": "#6366f1",
  "4": "#8b5cf6",
  "5 Contract": "#f97316",
  "6 Purchase": "#22c55e",
};

function fmt$(n: number): string {
  return `$${n.toLocaleString()}`;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}

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

  if (loading && !data)
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin" size={24} />
      </div>
    );
  if (!data || !data.kpis) return <div className="text-text-secondary py-6">No performance data available.</div>;

  const { kpis, funnel, soldProperties, inventoryProperties, leadCategories } = data;
  const maxFunnel = funnel.length > 0 ? Math.max(...funnel.map((f) => f.count), 1) : 1;

  return (
    <div className="space-y-6">
      {/* Period Toggle */}
      <div className="flex items-center gap-1 bg-bg-secondary border border-border-default rounded-lg p-1 w-fit">
        {(["t1", "t3", "t12"] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 text-caption font-medium rounded-md transition-colors ${
              period === p ? "bg-nah-orange text-white shadow-sm" : "text-text-tertiary hover:text-text-primary"
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
        {loading && <Loader2 size={14} className="animate-spin text-text-tertiary ml-2" />}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-bg-secondary rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-caption text-text-tertiary mb-1">
            <TrendingUp size={12} /> Leads Entered
          </div>
          <div className="text-lg font-bold text-text-primary">{kpis.leadsEntered}</div>
          <div className="text-caption text-text-tertiary">hit Stage 1</div>
        </div>
        <div className="bg-bg-secondary rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-caption text-text-tertiary mb-1">
            <Target size={12} /> Conversion
          </div>
          <div className="text-lg font-bold text-text-primary">
            {kpis.conversionRate != null ? `${kpis.conversionRate}%` : "—"}
          </div>
          <div className="text-caption text-text-tertiary">S1 → S4+</div>
        </div>
        <div className="bg-bg-secondary rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-caption text-text-tertiary mb-1">
            <DollarSign size={12} /> Avg Profit
          </div>
          {kpis.avgProfit != null ? (
            <div className="text-lg font-bold text-text-primary">{fmt$(kpis.avgProfit)}</div>
          ) : (
            <div className="flex items-center gap-1.5 text-body-sm text-warning font-medium">
              <AlertTriangle size={14} /> None sold
            </div>
          )}
          <div className="text-caption text-text-tertiary">{PERIOD_LABELS[period]}</div>
        </div>
        <div className="bg-bg-secondary rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-caption text-text-tertiary mb-1">
            <DollarSign size={12} /> Total Profit
          </div>
          {kpis.totalProfit != null ? (
            <div className="text-lg font-bold text-text-primary">{fmt$(kpis.totalProfit)}</div>
          ) : (
            <div className="flex items-center gap-1.5 text-body-sm text-warning font-medium">
              <AlertTriangle size={14} /> None sold
            </div>
          )}
          <div className="text-caption text-text-tertiary">{PERIOD_LABELS[period]}</div>
        </div>
        <div className="bg-bg-secondary rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-caption text-text-tertiary mb-1">
            <Home size={12} /> Active Inventory
          </div>
          <div className="text-lg font-bold text-text-primary">{kpis.activeInventory}</div>
          <div className="text-caption text-text-tertiary">in hand</div>
        </div>
        <div className="bg-bg-secondary rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-caption text-text-tertiary mb-1">
            <Package size={12} /> Sold
          </div>
          <div className="text-lg font-bold text-text-primary">{kpis.soldInPeriod}</div>
          <div className="text-caption text-text-tertiary">{PERIOD_LABELS[period]}</div>
        </div>
        <div className="bg-bg-secondary rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-caption text-text-tertiary mb-1">
            <Clock size={12} /> Cycle Days
          </div>
          <div className="text-lg font-bold text-text-primary">{kpis.medianCycleDays ?? "—"}</div>
          <div className="text-caption text-text-tertiary">median</div>
        </div>
      </div>

      {/* Lead Category Breakdown */}
      {Object.keys(leadCategories).length > 0 && (
        <div className="bg-bg-primary border border-border-default rounded-lg p-4">
          <h3 className="text-body-sm font-semibold text-text-primary mb-3">Lead Sources — {PERIOD_LABELS[period]}</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(leadCategories)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, count]) => (
                <div key={cat} className="flex items-center gap-1.5 bg-bg-secondary rounded-full px-3 py-1">
                  <span className="text-body-sm font-medium text-text-primary">{count}</span>
                  <span className="text-caption text-text-tertiary">{cat}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Funnel */}
      <div className="bg-bg-primary border border-border-default rounded-lg p-5">
        <h3 className="text-body-sm font-semibold text-text-primary mb-1">Property Funnel</h3>
        <p className="text-caption text-text-tertiary mb-4">{PERIOD_LABELS[period]}</p>
        <div className="flex flex-col items-center gap-0.5">
          {funnel.map((f, i) => {
            const widthPct = maxFunnel > 0 ? Math.max((f.count / maxFunnel) * 100, 20) : 20;
            const prevCount = i > 0 ? funnel[i - 1].count : null;
            const convPct = prevCount && prevCount > 0 ? ((f.count / prevCount) * 100).toFixed(0) : null;
            const color = STAGE_COLORS[f.stage] ?? "#6b7280";
            const label = STAGE_LABELS[f.stage] ?? f.stage;

            return (
              <div key={f.stage} className="w-full flex flex-col items-center">
                {/* Conversion arrow between stages */}
                {convPct && <div className="text-[10px] font-medium text-text-tertiary py-0.5">↓ {convPct}%</div>}
                {/* Funnel bar — trapezoid via clip-path */}
                <div
                  className="relative flex items-center justify-between px-4 py-2 rounded-sm transition-all"
                  style={{
                    width: `${widthPct}%`,
                    minWidth: "160px",
                    backgroundColor: `${color}18`,
                    borderLeft: `3px solid ${color}`,
                    borderRight: `3px solid ${color}`,
                  }}
                >
                  <span className="text-body-sm font-medium" style={{ color }}>
                    {label}
                  </span>
                  <span className="text-body-sm font-bold text-text-primary">{f.count}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Inventory List */}
      {inventoryProperties.length > 0 && (
        <div className="bg-bg-primary border border-border-default rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border-default flex items-center gap-2">
            <Home size={14} className="text-nah-blue" />
            <h3 className="text-body-sm font-semibold text-text-primary">
              Active Inventory ({inventoryProperties.length})
            </h3>
          </div>
          <div className="divide-y divide-border-default/50">
            {inventoryProperties.map((p) => (
              <div key={p.propertyId} className="px-4 py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-body-sm font-medium text-text-primary truncate">{p.address}</p>
                  <div className="flex items-center gap-3 text-caption text-text-tertiary mt-0.5">
                    <span>Purchased {fmtDate(p.purchaseDate)}</span>
                    <span>{p.daysHeld}d held</span>
                    {p.leadCategory && (
                      <span className="px-1.5 py-0.5 rounded bg-bg-tertiary text-[10px]">{p.leadCategory}</span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {p.arv != null && <p className="text-caption text-text-tertiary">ARV {fmt$(p.arv)}</p>}
                  {p.projectedProfit != null && (
                    <p
                      className={`text-body-sm font-medium ${p.projectedProfit >= 0 ? "text-success" : "text-danger"}`}
                    >
                      {fmt$(p.projectedProfit)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sold Properties List */}
      <div className="bg-bg-primary border border-border-default rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border-default flex items-center gap-2">
          <Package size={14} className="text-success" />
          <h3 className="text-body-sm font-semibold text-text-primary">
            Sold — {PERIOD_LABELS[period]} ({soldProperties.length})
          </h3>
        </div>
        {soldProperties.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <AlertTriangle size={20} className="text-warning mx-auto mb-2" />
            <p className="text-body-sm text-text-tertiary">No properties sold in this period</p>
          </div>
        ) : (
          <div className="divide-y divide-border-default/50">
            {soldProperties.map((p) => (
              <div key={p.propertyId} className="px-4 py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-body-sm font-medium text-text-primary truncate">{p.address}</p>
                  <div className="flex items-center gap-3 text-caption text-text-tertiary mt-0.5">
                    <span>Sold {fmtDate(p.sellDate!)}</span>
                    <span>{p.daysHeld}d cycle</span>
                    {p.leadCategory && (
                      <span className="px-1.5 py-0.5 rounded bg-bg-tertiary text-[10px]">{p.leadCategory}</span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {p.arv != null && <p className="text-caption text-text-tertiary">ARV {fmt$(p.arv)}</p>}
                  {p.profit != null ? (
                    <p className={`text-body-sm font-bold ${p.profit >= 0 ? "text-success" : "text-danger"}`}>
                      {fmt$(p.profit)}
                    </p>
                  ) : (
                    <p className="text-caption text-text-tertiary">—</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
