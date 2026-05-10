"use client";
import { apiFetch } from "@/lib/auth/api-fetch";
import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  DollarSign,
  Clock,
  Target,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Home,
  Package,
  X,
} from "lucide-react";

interface FunnelStage {
  stage: string;
  count: number;
}

interface Stage {
  label: string;
  date: string | null;
  days: number | null;
}

interface PropertyRow {
  propertyId: number;
  address: string;
  currentPhase: string | null;
  stages: Stage[];
  purchaseDate: string;
  totalDays: number;
  profit?: number | null;
  arv?: number | null;
  projectedProfit?: number | null;
  leadCategory?: string | null;
}

interface KPIs {
  leadsEntered: number;
  leadProgression: number | null;
  avgLeadToPurchase: number | null;
  avgCycleDays: number | null;
  activeInventory: number;
  soldInPeriod: number;
  avgProfit: number | null;
  totalProfit: number | null;
  conversionRate: number | null;
}

interface PerformanceData {
  kpis: KPIs | null;
  funnel: FunnelStage[];
  prevFunnel: FunnelStage[];
  soldProperties: PropertyRow[];
  inventoryProperties: PropertyRow[];
  leadCategories: Record<string, number>;
  leadCategoryFilter: string | null;
  period: string;
}

type Period = "t1" | "t3" | "t12" | "all";

const PERIOD_LABELS: Record<Period, string> = {
  t1: "Last Month",
  t3: "Last 3 Months",
  t12: "Last 12 Months",
  all: "All Time",
};
const PREV_LABELS: Record<Period, string> = { t1: "vs prior month", t3: "vs prior 3mo", t12: "vs prior 12mo", all: "" };

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

function ChangeIndicator({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return <span className="text-[10px] text-success font-medium">NEW</span>;
  const pctChange = Math.round(((current - previous) / previous) * 100);
  if (pctChange === 0) return <span className="text-[10px] text-text-tertiary">0%</span>;
  const isUp = pctChange > 0;
  return (
    <span className={`text-[10px] font-medium flex items-center gap-0.5 ${isUp ? "text-success" : "text-danger"}`}>
      {isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {isUp ? "+" : ""}
      {pctChange}%
    </span>
  );
}

export default function PerformanceTab({ TerritorySlug }: { TerritorySlug: string }) {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("t3");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const fetchData = useCallback(
    async (p: Period, cat: string | null) => {
      setLoading(true);
      try {
        let url = `/api/territories/${TerritorySlug}/performance?period=${p}`;
        if (cat) url += `&leadCategory=${encodeURIComponent(cat)}`;
        const res = await apiFetch(url);
        if (res.ok) setData(await res.json());
      } catch {
        /* silent */
      }
      setLoading(false);
    },
    [TerritorySlug]
  );

  useEffect(() => {
    void fetchData(period, selectedCategory);
  }, [period, selectedCategory, fetchData]);

  if (loading && !data)
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin" size={24} />
      </div>
    );
  if (!data || !data.kpis) return <div className="text-text-secondary py-6">No performance data available.</div>;

  const { kpis, funnel, prevFunnel, soldProperties, inventoryProperties, leadCategories } = data;
  const stage1Count = funnel[0]?.count ?? 0;

  return (
    <div className="space-y-6">
      {/* Period Toggle */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 bg-bg-secondary border border-border-default rounded-lg p-1">
          {(["t1", "t3", "t12", "all"] as Period[]).map((p) => (
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
        </div>
        {loading && <Loader2 size={14} className="animate-spin text-text-tertiary" />}
        {selectedCategory && (
          <button
            onClick={() => setSelectedCategory(null)}
            className="flex items-center gap-1 px-2 py-1 rounded-full bg-nah-blue/10 text-nah-blue text-caption font-medium"
          >
            {selectedCategory} <X size={12} />
          </button>
        )}
      </div>

      {/* KPI Cards — 4 columns x 2 rows, paired as columns (top/bottom) */}
      <div className="grid grid-cols-4 gap-3">
        {/* Row 1: Leads Entered | Lead→Purchase | Active Inventory | Avg Profit */}
        <KPICard icon={TrendingUp} label="Leads Entered" value={String(kpis.leadsEntered)} sub="hit Stage 1" />
        <KPICard
          icon={Clock}
          label="Lead → Purchase"
          value={kpis.avgLeadToPurchase != null ? `${kpis.avgLeadToPurchase}d` : "—"}
          sub="avg days"
        />
        <KPICard icon={Home} label="Active Inventory" value={String(kpis.activeInventory)} sub="in hand" />
        <NoSoldFallback icon={DollarSign} label="Avg Profit" value={kpis.avgProfit} sub="per flip" isMoney />
        {/* Row 2: Lead Progression | Cycle Time | Sold | Total Profit */}
        <KPICard
          icon={Target}
          label="Lead Progression"
          value={kpis.leadProgression != null ? `${kpis.leadProgression}%` : "—"}
          sub="reached Stage 4"
        />
        <KPICard
          icon={Clock}
          label="Cycle Time"
          value={kpis.avgCycleDays != null ? `${kpis.avgCycleDays}d` : "—"}
          sub="purchase → sold"
        />
        <NoSoldFallback icon={Package} label="Sold" value={kpis.soldInPeriod} sub={PERIOD_LABELS[period]} />
        <NoSoldFallback
          icon={DollarSign}
          label="Total Profit"
          value={kpis.totalProfit}
          sub={PERIOD_LABELS[period]}
          isMoney
        />
      </div>

      {/* Lead Sources — clickable to filter funnel */}
      {Object.keys(leadCategories).length > 0 && !selectedCategory && (
        <div className="bg-bg-primary border border-border-default rounded-lg p-4">
          <h3 className="text-body-sm font-semibold text-text-primary mb-3">Lead Sources — {PERIOD_LABELS[period]}</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(leadCategories)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, count]) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className="flex items-center gap-1.5 bg-bg-secondary hover:bg-bg-hover rounded-full px-3 py-1 transition-colors cursor-pointer border border-transparent hover:border-nah-blue/30"
                >
                  <span className="text-body-sm font-medium text-text-primary">{count}</span>
                  <span className="text-caption text-text-tertiary">{cat}</span>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Funnel — each stage as % of Stage 1, with period-over-period change */}
      <div className="bg-bg-primary border border-border-default rounded-lg p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-body-sm font-semibold text-text-primary">Property Funnel</h3>
          <span className="text-caption text-text-tertiary">{PREV_LABELS[period]}</span>
        </div>
        <p className="text-caption text-text-tertiary mb-4">
          {selectedCategory ? `${selectedCategory} — ` : ""}
          {PERIOD_LABELS[period]}
        </p>
        <div className="flex flex-col items-center gap-1">
          {funnel.map((f, i) => {
            const pct = stage1Count > 0 ? (f.count / stage1Count) * 100 : 0;
            const widthPct = Math.max(pct, 15);
            const prevCount = prevFunnel[i]?.count ?? 0;
            const color = STAGE_COLORS[f.stage] ?? "#6b7280";
            const label = STAGE_LABELS[f.stage] ?? f.stage;

            return (
              <div key={f.stage} className="w-full flex flex-col items-center">
                <div
                  className="relative flex items-center justify-between px-4 py-2.5 transition-all"
                  style={{
                    width: `${widthPct}%`,
                    minWidth: "200px",
                    backgroundColor: `${color}15`,
                    borderLeft: `3px solid ${color}`,
                    borderRight: `3px solid ${color}`,
                    clipPath:
                      i < funnel.length - 1
                        ? `polygon(0 0, 100% 0, 97% 100%, 3% 100%)`
                        : `polygon(2% 0, 98% 0, 100% 100%, 0% 100%)`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-body-sm font-semibold" style={{ color }}>
                      {label}
                    </span>
                    <span className="text-[10px] text-text-tertiary">{i === 0 ? "100%" : `${pct.toFixed(0)}%`}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-body-sm font-bold text-text-primary">{f.count}</span>
                    <ChangeIndicator current={f.count} previous={prevCount} />
                  </div>
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
              <PropertyCard key={p.propertyId} property={p} isSold={false} />
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
              <PropertyCard key={p.propertyId} property={p} isSold={true} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function KPICard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-bg-secondary rounded-lg p-3">
      <div className="flex items-center gap-1.5 text-caption text-text-tertiary mb-1">
        <Icon size={12} /> {label}
      </div>
      <div className="text-lg font-bold text-text-primary">{value}</div>
      {sub && <div className="text-caption text-text-tertiary">{sub}</div>}
    </div>
  );
}

function NoSoldFallback({
  icon: Icon,
  label,
  value,
  sub,
  isMoney,
}: {
  icon: React.ElementType;
  label: string;
  value: number | null;
  sub: string;
  isMoney?: boolean;
}) {
  if (value != null && value > 0)
    return <KPICard icon={Icon} label={label} value={isMoney ? fmt$(value) : String(value)} sub={sub} />;
  return (
    <div className="bg-bg-secondary rounded-lg p-3">
      <div className="flex items-center gap-1.5 text-caption text-text-tertiary mb-1">
        <Icon size={12} /> {label}
      </div>
      <div className="flex items-center gap-1.5 text-body-sm text-warning font-medium">
        <AlertTriangle size={14} /> None sold
      </div>
      <div className="text-caption text-text-tertiary">{sub}</div>
    </div>
  );
}

function PropertyCard({ property: p, isSold }: { property: PropertyRow; isSold: boolean }) {
  const stages = p.stages;
  // Current = last stage with a date
  let currentIdx = 0;
  for (let i = stages.length - 1; i >= 0; i--) {
    if (stages[i].date) {
      currentIdx = i;
      break;
    }
  }

  return (
    <div className="px-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-body-sm font-semibold text-text-primary truncate">{p.address}</p>
          {p.currentPhase && (
            <span className="px-1.5 py-0.5 rounded bg-nah-orange/10 text-nah-orange text-[10px] font-medium shrink-0">
              {p.currentPhase}
            </span>
          )}
          {p.leadCategory && (
            <span className="px-1.5 py-0.5 rounded bg-bg-tertiary text-[10px] text-text-tertiary shrink-0">
              {p.leadCategory}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span
            className={`text-caption font-medium ${p.totalDays > 180 ? "text-danger" : p.totalDays > 90 ? "text-warning" : "text-text-tertiary"}`}
          >
            {p.totalDays}d {isSold ? "cycle" : "held"}
          </span>
          {p.arv != null && <span className="text-caption text-text-tertiary">ARV {fmt$(p.arv)}</span>}
          {isSold && p.profit != null ? (
            <span className={`text-body-sm font-bold ${p.profit >= 0 ? "text-success" : "text-danger"}`}>
              {fmt$(p.profit)}
            </span>
          ) : !isSold && p.projectedProfit != null ? (
            <span className={`text-body-sm font-medium ${p.projectedProfit >= 0 ? "text-success" : "text-danger"}`}>
              {fmt$(p.projectedProfit)}
            </span>
          ) : null}
        </div>
      </div>

      {/* Journey — 5 stages: Purchased → Construction → Complete → Listed → Sold */}
      <div className="flex items-start">
        {stages.map((s, i) => {
          const reached = !!s.date;
          const isCurrent = i === currentIdx;
          const isPast = i < currentIdx;
          return (
            <div key={i} className="flex items-start flex-1 min-w-0">
              {i > 0 && (
                <div className="flex flex-col items-center mt-[7px] flex-1 min-w-0">
                  <div className={`w-full h-[2px] ${reached ? "bg-success" : "bg-border-default"}`} />
                  {s.days != null && (
                    <span
                      className={`text-[10px] font-bold mt-0.5 ${
                        s.days > 90 ? "text-danger" : s.days > 45 ? "text-warning" : "text-text-tertiary"
                      }`}
                    >
                      {s.days}d
                    </span>
                  )}
                </div>
              )}
              <div className="flex flex-col items-center shrink-0" style={{ width: 60 }}>
                <div
                  className={`rounded-full transition-all ${
                    isCurrent
                      ? "w-4 h-4 border-[2.5px] border-nah-orange bg-white shadow-sm"
                      : isPast
                        ? "w-3 h-3 bg-success"
                        : "w-3 h-3 bg-bg-tertiary border border-border-default"
                  }`}
                />
                <span
                  className={`text-[9px] mt-1 text-center leading-tight ${
                    isCurrent ? "text-nah-orange font-bold" : isPast ? "text-success font-medium" : "text-text-tertiary"
                  }`}
                >
                  {s.label}
                </span>
                {s.date && <span className="text-[8px] text-text-tertiary">{fmtDate(s.date)}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
