"use client";
import { apiFetch } from "@/lib/auth/api-fetch";
import { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle,
  ArrowDown,
  Clock,
  DollarSign,
  ExternalLink,
  Gauge,
  Home,
  Loader2,
  Package,
  PieChart,
  Target,
  TrendingUp,
  X,
} from "lucide-react";

interface FunnelStage {
  stage: string;
  count: number;
}

interface FunnelComparisonRow {
  stage: string;
  medianActiveTerritory: number | null;
  benchmark: number | null;
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

interface LatestStage4OfferRow {
  propertyId: number;
  address: string;
  stage4Date: string;
  currentStage: string | null;
  picturesUrl: string | null;
  hasPictures: boolean;
  mastermindUrl: string | null;
  hasMastermind: boolean;
  propertyPageUrl: string | null;
  leadCategory?: string | null;
  leadType?: string | null;
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

interface LeadListBuilding {
  total: number;
  benchmark: number | null;
  benchmarkMonthly: number;
  leadTypes: Record<string, number>;
}

interface PerformanceData {
  kpis: KPIs | null;
  funnel: FunnelStage[];
  prevFunnel: FunnelStage[];
  comparisonRows?: FunnelComparisonRow[];
  activeTerritoryComparisonCount?: number;
  soldProperties: PropertyRow[];
  inventoryProperties: PropertyRow[];
  latestStage4Offers?: LatestStage4OfferRow[];
  leadCategories: Record<string, number>;
  leadListBuilding?: LeadListBuilding;
  leadCategoryFilter: string | null;
  period: string;
}

type Period = "t1" | "t3" | "t12" | "ytd" | "all";

const PERIOD_LABELS: Record<Period, string> = {
  t1: "Last Month",
  t3: "Last 3 Months",
  t12: "Last 12 Months",
  ytd: "YTD",
  all: "All Time",
};
const PREV_LABELS: Record<Period, string> = {
  t1: "vs prior month",
  t3: "vs prior 3mo",
  t12: "vs prior 12mo",
  ytd: "vs prior YTD",
  all: "",
};

const STAGE_LABELS: Record<string, string> = {
  "1": "Stage 1",
  "2": "Stage 2",
  "3": "Stage 3",
  "4": "Stage 4",
  "5 Contract": "Stage 5 Contract",
  "6 Purchase": "Stage 6 Purchase",
};

const STAGE_COLORS: Record<string, string> = {
  "1": "#60a5fa",
  "2": "#3b82f6",
  "3": "#6366f1",
  "4": "#8b5cf6",
  "5 Contract": "#f97316",
  "6 Purchase": "#22c55e",
};

const LEAD_TYPE_COLORS = [
  "#2563eb",
  "#f97316",
  "#16a34a",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#ca8a04",
  "#db2777",
  "#64748b",
];

function pctOf(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

function fmt$(n: number): string {
  return `$${n.toLocaleString()}`;
}
function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}

export default function PerformanceTab({ TerritorySlug }: { TerritorySlug: string }) {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("ytd");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [visibleStage4Offers, setVisibleStage4Offers] = useState(10);

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

  useEffect(() => {
    setVisibleStage4Offers(10);
  }, [period, selectedCategory, TerritorySlug]);

  if (loading && !data)
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin" size={24} />
      </div>
    );
  if (!data || !data.kpis) return <div className="text-text-secondary py-6">No performance data available.</div>;

  const {
    kpis,
    funnel,
    comparisonRows = [],
    activeTerritoryComparisonCount = 0,
    soldProperties,
    inventoryProperties,
    latestStage4Offers = [],
    leadCategories,
    leadListBuilding,
  } = data;

  return (
    <div className="space-y-6">
      {/* Period Toggle */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 bg-bg-secondary border border-border-default rounded-lg p-1">
          {(["t1", "t3", "t12", "ytd", "all"] as Period[]).map((p) => (
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

      {leadListBuilding && (
        <LeadListBuildingPanel leadListBuilding={leadListBuilding} periodLabel={PERIOD_LABELS[period]} />
      )}

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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <PropertyFunnelStory
          funnel={funnel}
          periodLabel={PERIOD_LABELS[period]}
          categoryLabel={selectedCategory}
          comparisonLabel={PREV_LABELS[period]}
        />
        <PipelineComparisonTable
          funnel={funnel}
          comparisonRows={comparisonRows}
          activeTerritoryComparisonCount={activeTerritoryComparisonCount}
        />
      </div>

      {latestStage4Offers.length > 0 && (
        <LatestStage4OffersPanel
          offers={latestStage4Offers}
          periodLabel={PERIOD_LABELS[period]}
          visibleCount={visibleStage4Offers}
          onShowMore={() => setVisibleStage4Offers((count) => Math.min(count + 10, latestStage4Offers.length))}
        />
      )}

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

function LatestStage4OffersPanel({
  offers,
  periodLabel,
  visibleCount,
  onShowMore,
}: {
  offers: LatestStage4OfferRow[];
  periodLabel: string;
  visibleCount: number;
  onShowMore: () => void;
}) {
  const visibleOffers = offers.slice(0, visibleCount);
  const remaining = Math.max(offers.length - visibleOffers.length, 0);
  const nextCount = Math.min(10, remaining);

  return (
    <div className="bg-bg-primary border border-border-default rounded-lg overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border-default px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Target size={14} className="text-nah-orange" />
          <h3 className="truncate text-body-sm font-semibold text-text-primary">
            Latest Stage 4 Offers ({offers.length})
          </h3>
        </div>
        <span className="shrink-0 text-caption text-text-tertiary">{periodLabel}</span>
      </div>

      <div className="divide-y divide-border-default/50">
        {visibleOffers.map((offer) => (
          <div
            key={`${offer.propertyId}-${offer.stage4Date}`}
            className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
          >
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <p className="min-w-0 truncate text-body-sm font-semibold text-text-primary">{offer.address}</p>
                <span className="shrink-0 rounded bg-nah-orange/10 px-1.5 py-0.5 text-[10px] font-medium text-nah-orange">
                  {offer.currentStage ?? "Current unknown"}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {offer.leadCategory && <InfoChip value={offer.leadCategory} />}
                {offer.leadType && <InfoChip value={offer.leadType} />}
                <span className="rounded bg-bg-secondary px-1.5 py-0.5 text-[10px] text-text-tertiary">
                  Stage 4 {fmtDate(offer.stage4Date)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-start gap-1.5 sm:justify-end">
              <LinkStatus href={offer.picturesUrl} active={offer.hasPictures} label="Pictures" />
              <LinkStatus href={offer.mastermindUrl} active={offer.hasMastermind} label="Mastermind" />
              {offer.propertyPageUrl ? (
                <a
                  href={offer.propertyPageUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${offer.address} in MasterSuite`}
                  title="Open in MasterSuite"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border-default text-text-tertiary transition-colors hover:border-nah-blue/40 hover:text-nah-blue"
                >
                  <ExternalLink size={15} />
                </a>
              ) : (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border-default text-text-tertiary/50">
                  <ExternalLink size={15} />
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {remaining > 0 && (
        <div className="border-t border-border-default bg-bg-secondary px-4 py-3">
          <button
            type="button"
            onClick={onShowMore}
            className="text-caption font-semibold text-nah-blue transition-colors hover:text-nah-orange"
          >
            Show {nextCount} more
          </button>
        </div>
      )}
    </div>
  );
}

function InfoChip({ value }: { value: string }) {
  return (
    <span className="rounded bg-bg-tertiary px-1.5 py-0.5 text-[10px] font-medium text-text-secondary">
      {value}
    </span>
  );
}

function LinkStatus({ href, active, label }: { href: string | null; active: boolean; label: string }) {
  const className = active
    ? "flex h-7 min-w-[116px] items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 px-2 text-[11px] font-semibold text-emerald-700 transition-colors"
    : "flex h-7 min-w-[116px] items-center justify-center rounded-md border border-border-default bg-bg-secondary px-2 text-[11px] font-medium text-text-tertiary transition-colors";

  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" title={label} className={`${className} hover:border-emerald-300`}>
        {label}
      </a>
    );
  }

  return (
    <span title={`${label} missing`} className={className}>
      {label}
    </span>
  );
}

function LeadListBuildingPanel({
  leadListBuilding,
  periodLabel,
}: {
  leadListBuilding: LeadListBuilding;
  periodLabel: string;
}) {
  const sortedTypes = Object.entries(leadListBuilding.leadTypes).sort(([, a], [, b]) => b - a);
  const topTypes = sortedTypes.slice(0, 7);
  const otherCount = sortedTypes.slice(7).reduce((total, [, count]) => total + count, 0);
  const chartRows = otherCount > 0 ? [...topTypes, ["Other", otherCount] as [string, number]] : topTypes;
  const benchmark = leadListBuilding.benchmark;
  const progressPct = benchmark ? Math.min(Math.round((leadListBuilding.total / benchmark) * 100), 100) : null;
  const shortBy = benchmark == null ? null : Math.max(benchmark - leadListBuilding.total, 0);

  let cursor = 0;
  const gradientStops =
    chartRows.length > 0
      ? chartRows
          .map(([, count], index) => {
            const start = cursor;
            const end = cursor + (count / leadListBuilding.total) * 100;
            cursor = end;
            const color = LEAD_TYPE_COLORS[index % LEAD_TYPE_COLORS.length];
            return `${color} ${start}% ${end}%`;
          })
          .join(", ")
      : "#e5e7eb 0% 100%";

  return (
    <div className="bg-bg-primary border border-border-default rounded-lg p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <PieChart size={15} className="text-nah-orange" />
            <h3 className="text-body-sm font-semibold text-text-primary">Lead List Building</h3>
          </div>
          <p className="mt-1 text-caption text-text-tertiary">
            Counts properties created in 0 Lead List during {periodLabel}.
          </p>
          <div className="mt-4 flex items-end gap-3">
            <div className="text-3xl font-bold text-text-primary">{leadListBuilding.total.toLocaleString()}</div>
            <div className="pb-1 text-caption font-medium text-text-tertiary">Lead List Created</div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)] lg:w-[560px]">
          <div className="flex items-center justify-center">
            <div
              className="relative h-36 w-36 rounded-full border border-border-default shadow-inner"
              style={{ background: `conic-gradient(${gradientStops})` }}
              aria-label="Lead type mix"
            >
              <div className="absolute inset-8 rounded-full border border-border-default bg-bg-primary" />
            </div>
          </div>

          <div className="min-w-0 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {chartRows.map(([leadType, count], index) => (
                <div key={leadType} className="flex min-w-0 items-center gap-2 rounded-md bg-bg-secondary px-2 py-1.5">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: LEAD_TYPE_COLORS[index % LEAD_TYPE_COLORS.length] }}
                  />
                  <span className="min-w-0 flex-1 truncate text-caption text-text-secondary">{leadType}</span>
                  <span className="text-caption font-semibold text-text-primary">{count.toLocaleString()}</span>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-border-default bg-bg-secondary p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <p className="text-caption font-semibold text-text-primary">Benchmark Progression</p>
                  <p className="text-[11px] text-text-tertiary">
                    {benchmark == null
                      ? `${leadListBuilding.benchmarkMonthly.toLocaleString()} per month benchmark`
                      : `${leadListBuilding.total.toLocaleString()} / ${benchmark.toLocaleString()} target`}
                  </p>
                </div>
                {progressPct != null && <div className="text-body-sm font-bold text-text-primary">{progressPct}%</div>}
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-bg-tertiary">
                <div
                  className="h-full rounded-full bg-nah-orange transition-all"
                  style={{ width: `${progressPct ?? 0}%` }}
                />
              </div>
              {shortBy != null && (
                <p className="mt-2 text-[11px] text-text-tertiary">
                  {shortBy === 0 ? "At or above benchmark." : `${shortBy.toLocaleString()} short of benchmark.`}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PropertyFunnelStory({
  funnel,
  periodLabel,
  categoryLabel,
  comparisonLabel,
}: {
  funnel: FunnelStage[];
  periodLabel: string;
  categoryLabel: string | null;
  comparisonLabel: string;
}) {
  const stage1Count = funnel[0]?.count ?? 0;
  const transitions = funnel.slice(1).map((stage, index) => {
    const previous = funnel[index];
    const previousCount = previous?.count ?? 0;
    const lostCount = Math.max(previousCount - stage.count, 0);
    const stepPct = pctOf(stage.count, previousCount);
    return {
      from: STAGE_LABELS[previous?.stage ?? ""] ?? previous?.stage ?? "Prior stage",
      to: STAGE_LABELS[stage.stage] ?? stage.stage,
      lostCount,
      stepPct,
    };
  });
  const bottlenecks = transitions
    .filter((transition) => transition.lostCount > 0)
    .sort((a, b) => b.lostCount - a.lostCount)
    .slice(0, 3);

  return (
    <div className="bg-bg-primary border border-border-default rounded-lg p-5">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h3 className="text-body-sm font-semibold text-text-primary">Property Funnel</h3>
          <p className="text-caption text-text-tertiary mt-1">
            {categoryLabel ? `${categoryLabel} - ` : ""}
            {periodLabel}
          </p>
        </div>
        {comparisonLabel && <span className="text-caption text-text-tertiary shrink-0">{comparisonLabel}</span>}
      </div>

      <div className="space-y-3">
        {funnel.map((stage, index) => {
          const previousCount = index > 0 ? (funnel[index - 1]?.count ?? 0) : stage.count;
          const leadPct = index === 0 ? 100 : pctOf(stage.count, stage1Count);
          const stepPct = index === 0 ? 100 : pctOf(stage.count, previousCount);
          const color = STAGE_COLORS[stage.stage] ?? "#6b7280";
          const label = STAGE_LABELS[stage.stage] ?? stage.stage;
          const widthPct = stage.count > 0 ? Math.max(leadPct, 1) : 0;

          return (
            <div
              key={stage.stage}
              className="grid grid-cols-[92px_minmax(0,1fr)_76px] items-center gap-3 sm:grid-cols-[120px_minmax(0,1fr)_92px]"
            >
              <div className="min-w-0">
                <p className="truncate text-caption font-semibold text-text-primary">{label}</p>
                <p className="text-[11px] text-text-tertiary">{index === 0 ? "start" : `${stepPct}% from prior`}</p>
              </div>
              <div className="h-8 overflow-hidden rounded-md border border-border-default bg-bg-tertiary">
                <div
                  className="h-full rounded-md transition-all duration-500"
                  style={{ width: `${widthPct}%`, backgroundColor: `${color}99` }}
                />
              </div>
              <div className="text-right">
                <p className="text-body-sm font-bold text-text-primary">{stage.count.toLocaleString()}</p>
                <p className="text-[11px] text-text-tertiary">{leadPct}%</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 rounded-lg border border-border-default bg-bg-secondary p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
            <Gauge size={17} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-caption text-text-tertiary">Bottleneck board</p>
            <p className="mt-1 text-body-sm font-semibold text-text-primary">
              Biggest pressure point:{" "}
              {bottlenecks[0] ? `${bottlenecks[0].from} to ${bottlenecks[0].to}` : "not enough movement yet"}
            </p>
          </div>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {bottlenecks.length > 0 ? (
            bottlenecks.map((item) => (
              <div key={`${item.from}-${item.to}`} className="rounded-md bg-white/70 px-3 py-2">
                <div className="flex items-center gap-2">
                  <ArrowDown size={14} className={item.lostCount > 0 ? "text-danger" : "text-text-tertiary"} />
                  <p className="min-w-0 truncate text-caption font-semibold text-text-primary">
                    {item.from} to {item.to}
                  </p>
                </div>
                <p className="mt-1 text-[11px] text-text-tertiary">
                  {item.lostCount.toLocaleString()} did not advance - {item.stepPct}% conversion
                </p>
              </div>
            ))
          ) : (
            <div className="rounded-md bg-white/70 px-3 py-2 md:col-span-3">
              <p className="text-caption font-semibold text-text-primary">No drop-off to call out yet</p>
              <p className="mt-1 text-[11px] text-text-tertiary">
                As volume moves through the stages, this will highlight where attention is needed.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PipelineComparisonTable({
  funnel,
  comparisonRows,
  activeTerritoryComparisonCount,
}: {
  funnel: FunnelStage[];
  comparisonRows: FunnelComparisonRow[];
  activeTerritoryComparisonCount: number;
}) {
  return (
    <div className="bg-bg-primary border border-border-default rounded-lg p-4">
      <div className="mb-3">
        <h3 className="text-body-sm font-semibold text-text-primary">Pipeline Comparison</h3>
        <p className="text-caption text-text-tertiary">
          Median across {activeTerritoryComparisonCount || "active"} active territories
        </p>
      </div>
      <div className="overflow-hidden rounded-md border border-border-default">
        <div className="grid grid-cols-[1.15fr_0.8fr_0.8fr_0.8fr] bg-bg-secondary px-3 py-2 text-[10px] font-semibold uppercase text-text-tertiary">
          <span>Stage</span>
          <span className="text-right">This</span>
          <span className="text-right">Median</span>
          <span className="text-right">Target</span>
        </div>
        <div className="divide-y divide-border-default/60">
          {funnel.map((stage) => {
            const comparison = comparisonRows.find((row) => row.stage === stage.stage);
            const label = STAGE_LABELS[stage.stage] ?? stage.stage;
            const benchmark = comparison?.benchmark;

            return (
              <div
                key={stage.stage}
                className="grid grid-cols-[1.15fr_0.8fr_0.8fr_0.8fr] items-center px-3 py-2 text-caption"
              >
                <span className="font-medium text-text-primary">{label}</span>
                <span className="text-right font-semibold text-text-primary">{stage.count}</span>
                <span className="text-right text-text-secondary">{comparison?.medianActiveTerritory ?? "—"}</span>
                <span className="text-right text-text-secondary">{benchmark == null ? "—" : benchmark}</span>
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-text-tertiary">
        Targets scale from monthly goals: 30 Stage 1 leads, 10 Stage 4 offers, 1 contract, and 1 purchase.
      </p>
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
  if (value != null && (isMoney || value > 0))
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
            <div key={i} className={`flex items-start min-w-0 ${i === 0 ? "shrink-0" : "flex-1"}`}>
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
