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
  prevFunnel: FunnelStage[];
  soldProperties: PropertyRow[];
  inventoryProperties: PropertyRow[];
  leadCategories: Record<string, number>;
  leadCategoryFilter: string | null;
  period: string;
}

type Period = "t1" | "t3" | "t12";

const PERIOD_LABELS: Record<Period, string> = { t1: "Last Month", t3: "Last 3 Months", t12: "Last 12 Months" };
const PREV_LABELS: Record<Period, string> = { t1: "vs prior month", t3: "vs prior 3mo", t12: "vs prior 12mo" };

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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard icon={TrendingUp} label="Leads Entered" value={String(kpis.leadsEntered)} sub="hit Stage 1" />
        <KPICard
          icon={Target}
          label="Conversion"
          value={kpis.conversionRate != null ? `${kpis.conversionRate}%` : "—"}
          sub="S1 → S4+"
        />
        {kpis.avgProfit != null ? (
          <KPICard icon={DollarSign} label="Avg Profit" value={fmt$(kpis.avgProfit)} sub={PERIOD_LABELS[period]} />
        ) : (
          <div className="bg-bg-secondary rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-caption text-text-tertiary mb-1">
              <DollarSign size={12} /> Avg Profit
            </div>
            <div className="flex items-center gap-1.5 text-body-sm text-warning font-medium">
              <AlertTriangle size={14} /> None sold
            </div>
            <div className="text-caption text-text-tertiary">{PERIOD_LABELS[period]}</div>
          </div>
        )}
        {kpis.totalProfit != null ? (
          <KPICard icon={DollarSign} label="Total Profit" value={fmt$(kpis.totalProfit)} sub={PERIOD_LABELS[period]} />
        ) : (
          <div className="bg-bg-secondary rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-caption text-text-tertiary mb-1">
              <DollarSign size={12} /> Total Profit
            </div>
            <div className="flex items-center gap-1.5 text-body-sm text-warning font-medium">
              <AlertTriangle size={14} /> None sold
            </div>
            <div className="text-caption text-text-tertiary">{PERIOD_LABELS[period]}</div>
          </div>
        )}
        <KPICard icon={Home} label="Active Inventory" value={String(kpis.activeInventory)} sub="in hand" />
        <KPICard icon={Package} label="Sold" value={String(kpis.soldInPeriod)} sub={PERIOD_LABELS[period]} />
        <KPICard
          icon={Clock}
          label="Cycle Days"
          value={kpis.medianCycleDays != null ? String(kpis.medianCycleDays) : "—"}
          sub="median"
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
