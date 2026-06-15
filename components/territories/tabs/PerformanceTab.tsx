"use client";
import { apiFetch } from "@/lib/auth/api-fetch";
import { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock,
  DollarSign,
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
  const [bottleneckData, setBottleneckData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [bottleneckLoading, setBottleneckLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("ytd");
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

  useEffect(() => {
    let active = true;
    setBottleneckLoading(true);
    apiFetch(`/api/territories/${TerritorySlug}/performance?period=ytd`)
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (active) setBottleneckData(payload);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setBottleneckLoading(false);
      });
    return () => {
      active = false;
    };
  }, [TerritorySlug]);

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
        <PropertyFunnelBottleneck
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

      <BottleneckAgentPanel data={bottleneckData} loading={bottleneckLoading} />

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

type BottleneckTone = "healthy" | "direct" | "warning" | "critical";

interface BottleneckRead {
  tone: BottleneckTone;
  label: string;
  headline: string;
  narrative: string;
  coachFocus: string[];
  probes: string[];
  guardrails: string[];
  metricLine: string;
}

function stageCount(funnel: FunnelStage[], stage: string) {
  return funnel.find((row) => row.stage === stage)?.count ?? 0;
}

function benchmarkFor(data: PerformanceData, stage: string) {
  return data.comparisonRows?.find((row) => row.stage === stage)?.benchmark ?? null;
}

function ratio(count: number, benchmark: number | null) {
  if (!benchmark || benchmark <= 0) return null;
  return count / benchmark;
}

function conversionPct(numerator: number, denominator: number) {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 100);
}

function buildBottleneckRead(data: PerformanceData): BottleneckRead {
  const stage1 = stageCount(data.funnel, "1");
  const stage3 = stageCount(data.funnel, "3");
  const stage4 = stageCount(data.funnel, "4");
  const stage5 = stageCount(data.funnel, "5 Contract");
  const stage6 = stageCount(data.funnel, "6 Purchase");
  const stage1Target = benchmarkFor(data, "1");
  const stage4Target = benchmarkFor(data, "4");
  const stage5Target = benchmarkFor(data, "5 Contract");
  const stage6Target = benchmarkFor(data, "6 Purchase");
  const stage1Ratio = ratio(stage1, stage1Target);
  const stage4Ratio = ratio(stage4, stage4Target);
  const stage5Ratio = ratio(stage5, stage5Target);
  const stage6Ratio = ratio(stage6, stage6Target);
  const s1ToS4 = conversionPct(stage4, stage1);
  const s3ToS4 = conversionPct(stage4, stage3);
  const s4ToS5 = conversionPct(stage5, stage4);
  const s5ToS6 = conversionPct(stage6, stage5);
  const sourceTotal = Object.values(data.leadCategories).reduce((sum, count) => sum + count, 0);
  const sourceMismatch = sourceTotal > 0 && stage1 > 0 && Math.abs(sourceTotal - stage1) >= Math.max(5, stage1 * 0.2);
  const avgProfit = data.kpis?.avgProfit ?? null;
  const lowProfit = avgProfit != null && avgProfit > 0 && avgProfit < 20000;
  const activeInventory = data.kpis?.activeInventory ?? 0;
  const hittingDeals =
    (stage5Target != null && stage5 >= stage5Target) || (stage6Target != null && stage6 >= stage6Target) || stage6 > 0;
  const stage1Light = stage1Ratio != null ? stage1Ratio < 0.85 : stage1 < 70;
  const stage1VeryLow = stage1Ratio != null ? stage1Ratio < 0.35 : stage1 < 20;
  const stage1Healthy = stage1Ratio != null ? stage1Ratio >= 0.95 : stage1 >= 90;
  const stage4Healthy = stage4Ratio != null ? stage4Ratio >= 0.85 : stage4 >= 10;
  const contractsHealthy = stage5Ratio != null ? stage5Ratio >= 0.85 : stage5 > 0;
  const purchasesHealthy = stage6Ratio != null ? stage6Ratio >= 0.85 : stage6 > 0;

  const goalParts = [
    stage1Target ? `${stage1Target} leads` : null,
    stage4Target ? `${stage4Target} offers` : null,
    stage5Target ? `${stage5Target} contracts` : null,
    stage6Target ? `${stage6Target} purchases` : null,
  ].filter(Boolean);
  const metricLine = `YTD so far: ${stage1} leads, ${stage4} offers, ${stage5} contracts, ${stage6} purchases.${
    goalParts.length ? ` Goal: ${goalParts.join(", ")}.` : ""
  }`;
  const simpleYtd = `YTD: ${stage1} leads, ${stage4} offers, ${stage5} contracts, ${stage6} purchases.`;
  const targetYtd = goalParts.length ? `The goal is ${goalParts.join(", ")}.` : "";

  if (stage1 === 0 && stage4 === 0 && stage5 === 0 && stage6 === 0) {
    return {
      tone: "critical",
      label: "No Funnel To Coach",
      headline: "Nothing is really moving yet.",
      narrative:
        "Do not make this complicated. If there are no leads, offers, contracts, or purchases in the system, the first problem is activity.",
      coachFocus: [
        "There is no acquisition funnel to diagnose yet. No leads, no offers, no contracts, and no purchases are showing.",
        "This is not a conversion problem yet. The business has to create real seller activity before anything else matters.",
      ],
      probes: [
        "Put the whole call on lead-generation activity for this week.",
        "Set one clear owner, one lead source, and one number of new leads that must be created before the next check-in.",
      ],
      guardrails: [
        "Do not spend the call debating lead quality, offer strategy, or closing skill before there is actual activity in the system.",
      ],
      metricLine,
    };
  }

  if (stage1VeryLow && hittingDeals) {
    return {
      tone: "warning",
      label: "Buying, But Hidden",
      headline: "They are buying houses, but the work is not showing clearly.",
      narrative:
        "This could be good, or it could be messy data. They may have a strong source, or they may just not be entering leads. Give credit for the deals, then find out what is really happening.",
      coachFocus: [
        `${simpleYtd} They are still getting deals, so something is working, but the front of the funnel is not telling the full story.`,
        "This is either a strong hidden lead source or messy data entry. The read is not 'they need more leads' until the source of those purchases is clear.",
      ],
      probes: [
        "Trace the last purchases back to the exact source.",
        "Clean up whether all leads are being entered, then decide if this is a repeatable channel or just owner hustle.",
        "If the source is real, turn it into a simple repeatable play for the next month.",
      ],
      guardrails: [
        "Do not call this broken just because Stage 1 looks light.",
        "Do not ignore the purchases either. A deal source exists, and the call needs clarity on where it came from.",
      ],
      metricLine,
    };
  }

  if (stage1Light && hittingDeals && (contractsHealthy || purchasesHealthy)) {
    return {
      tone: lowProfit ? "warning" : "healthy",
      label: lowProfit ? "Buying, But Check Profit" : "Working, Needs More Leads",
      headline: lowProfit
        ? "They are buying houses. Now make sure the profit is strong enough."
        : "This looks like it works. They need more leads.",
      narrative:
        "Do not treat this like a broken funnel. If a small amount of leads is turning into contracts or purchases, the simple answer is more lead flow.",
      coachFocus: [
        lowProfit
          ? `${simpleYtd} They can turn limited lead flow into deals, but profit is the part to pressure now.`
          : `${simpleYtd} This is a good operator being underfed. The leads they do have are producing real movement.`,
        lowProfit
          ? "Do not celebrate volume until the deal quality is checked."
          : "The bottleneck is not sales skill. It is not enough at-bats at the top of the funnel.",
      ],
      probes: [
        lowProfit
          ? "Review the last purchases for ARV, rehab, risk, and expected profit."
          : "Increase Stage 1 lead flow without changing the working parts of the process.",
        "Protect the lead source that is already creating deals.",
        lowProfit
          ? "Tighten offer discipline before pushing more buying volume."
          : "Set a specific weekly lead target and hold it there.",
      ],
      guardrails: [
        "Do not over-coach a funnel that is already converting.",
        lowProfit
          ? "Do not tell them to buy more until the profit story supports it."
          : "Do not let the conversation drift into vague strategy. More quality lead flow is the move.",
      ],
      metricLine,
    };
  }

  if (stage1 > 0 && stage4 === 0) {
    return {
      tone: "critical",
      label: "Leads Not Becoming Offers",
      headline: "Leads are coming in, but offers are not happening.",
      narrative:
        "Do not let this turn into a vague lead-quality excuse. The coach needs to find out if leads are being worked, walked, followed up with, and given real numbers.",
      coachFocus: [
        `${simpleYtd} Leads exist, but they are not becoming offers. That means the business is stopping before sellers get a real number.`,
        "This is not a purchase problem yet. The current breakdown is between lead intake and offer activity.",
      ],
      probes: [
        "Pull recent leads and see exactly where they died.",
        "Force the next step: work the leads, walk the ones worth walking, and make real offers instead of staying in review mode.",
        "Keep lead flow moving, but make the main coaching push offer creation.",
      ],
      guardrails: sourceMismatch
        ? ["The lead source numbers do not match Stage 1. Clean up the data before making a hard call."]
        : ["Do not accept 'bad leads' as the answer unless the lead review proves it."],
      metricLine,
    };
  }

  if (stage1Healthy && stage4Ratio != null && stage4Ratio < 0.7 && !(stage4Ratio < 0.55 && contractsHealthy)) {
    return {
      tone: contractsHealthy || purchasesHealthy ? "warning" : "critical",
      label: "Offer Volume Gap",
      headline: "Lead flow is there. Not enough of it is becoming offers.",
      narrative:
        "This is the coach-call read: the owner has enough lead activity to work with, but too few sellers are getting to a real offer conversation.",
      coachFocus: [
        `${simpleYtd} Lead flow is not the excuse on this call. The issue is that only ${stage4} offers have come from ${stage1} leads.`,
        stage5 > 0 || stage6 > 0
          ? `The offers that do happen are creating some results: ${stage5} contracts and ${stage6} purchases. That points the call toward why more leads are not reaching Stage 4.`
          : "The pipeline is dying before the owner gets sellers a real number. That is the problem to solve first.",
      ],
      probes: [
        "Walk the owner through the recent leads and find where they are stopping: contact, qualification, walkthrough, pricing, or follow-up.",
        "Push for more real Stage 4 offers from the leads already coming in before making this a generic lead-gen conversation.",
        "Leave the Google Meet with one concrete offer-volume action for this week.",
      ],
      guardrails: [
        "Do not let the call stay vague. The coaching pressure is simple: more qualified sellers need to get a real offer.",
      ],
      metricLine: `${metricLine} Stage 1 to Stage 4 conversion is ${s1ToS4 ?? 0}%.`,
    };
  }

  if (stage1Healthy && stage4Ratio != null && stage4Ratio < 0.55 && contractsHealthy) {
    return {
      tone: "warning",
      label: "Qualified Leads Not Getting Offers",
      headline: "They have lead volume, but not enough real offers.",
      narrative:
        "A big Stage 1 drop-off can be normal in cold call or cold text markets. The real question is whether interested sellers are getting pushed to a clear offer.",
      coachFocus: [
        `${simpleYtd} Lead flow is not the main issue. The weak spot is getting enough of those leads to real offers.`,
        `Stage 3 to Stage 4 is ${s3ToS4 ?? 0}%, so the call needs to focus on the handoff from interested seller to written offer.`,
      ],
      probes: [
        "Review the interested sellers and decide which ones should already have offers.",
        "Fix the offer habit: faster numbers, cleaner seller conversation, and no skipping rejected offers in the system.",
        "Give credit for the contracts, but push the operator to create more offer volume from the leads they already have.",
      ],
      guardrails: ["Do not make this a simple more-leads conversation when Stage 1 is already strong."],
      metricLine: `${metricLine} Stage 3 to Stage 4 conversion is ${s3ToS4 ?? 0}%.`,
    };
  }

  if (stage4Healthy && stage5 === 0) {
    return {
      tone: "warning",
      label: "Offer To Contract Gap",
      headline: "They are making offers, but not getting contracts.",
      narrative:
        "This is probably not a lead-count problem. Look at the offer, the seller conversation, pricing, repair budget, speed, and competition.",
      coachFocus: [
        `${simpleYtd} Offers are happening, but sellers are not signing. The bottleneck has moved from lead flow to winning the deal.`,
        `Stage 4 to contract is ${s4ToS5 ?? 0}%, so pressure offer quality, seller follow-up, speed, and certainty.`,
      ],
      probes: [
        "Review the last offers and sort them into price problem, repair/ARV problem, speed problem, or seller-conversation problem.",
        "Make the operator tighten follow-up after the offer instead of just sending numbers and waiting.",
        "Set the next call around signed contracts, not more top-of-funnel activity.",
      ],
      guardrails: ["Do not make lead gen the headline if Stage 4 volume is already healthy."],
      metricLine: `${metricLine} Stage 4 to contract conversion is ${s4ToS5 ?? 0}%.`,
    };
  }

  if (stage5 > 0 && (s5ToS6 ?? 100) < 60) {
    return {
      tone: "warning",
      label: "Contract To Purchase Watch",
      headline: "Contracts are not closing into purchases.",
      narrative:
        "This might be a real closing problem, or the contracts may just be new. Ask what is happening before calling the funnel broken.",
      coachFocus: [
        `${simpleYtd} They can get sellers under contract, but too many contracts are not turning into purchases yet.`,
        `Contract to purchase is ${s5ToS6 ?? 0}%. The current read is closing risk, not lead generation.`,
      ],
      probes: [
        "Separate normal timing from real fallout.",
        "Name the reason each contract has not closed: title, seller, financing, inspection, deal quality, or simply too new.",
        "Keep the top of funnel alive while the current contracts are pushed to purchase.",
      ],
      guardrails: [
        "Do not let contract count create false comfort. A contract only matters if it can become a purchase.",
      ],
      metricLine: `${metricLine} Contract to purchase conversion is ${s5ToS6 ?? 0}%.`,
    };
  }

  if (stage1Light && (stage4Healthy || hittingDeals)) {
    return {
      tone: "direct",
      label: "Healthy But Underfed",
      headline: "The process works, but there are not enough leads.",
      narrative:
        "This is a positive coaching conversation, but still direct. They are getting movement from the leads they have. To grow, they need more Stage 1 activity.",
      coachFocus: [
        `${simpleYtd} This is not a broken operator. The process is creating movement, but the top of the funnel is too light for the next level.`,
        targetYtd ||
          "The read is simple: they need more qualified Stage 1 activity feeding a process that already has signs of working.",
      ],
      probes: [
        "Set the lead target and the lead source for the next week.",
        "Keep the current acquisitions process intact while increasing Stage 1 volume.",
        "Make the ask specific: what activity doubles the current lead pace?",
      ],
      guardrails: ["Do not treat this like a broken funnel. Be direct that the next level requires more leads."],
      metricLine,
    };
  }

  if (stage1Healthy && stage4Healthy && contractsHealthy && purchasesHealthy) {
    return {
      tone: "healthy",
      label: "Working Well",
      headline: "This is working. Help them do more of it.",
      narrative:
        "They are getting leads, making offers, getting contracts, and buying houses. Do not over-coach it. Find out what is working and what would help them scale.",
      coachFocus: [
        `${simpleYtd} This is a working acquisitions machine right now.`,
        "They are getting leads, making offers, getting contracts, and buying houses. Protect the pattern and help them scale it.",
      ],
      probes: [
        "Name what is working so it can be repeated.",
        "Ask what capacity, money, people, or lead source would let them do more of it.",
        "Capture the play so other territories can copy the useful parts.",
      ],
      guardrails: ["Do not over-coach a healthy system.", "Do not break what is already producing results."],
      metricLine,
    };
  }

  if (activeInventory > 0 && stage1Light) {
    return {
      tone: "direct",
      label: "Inventory Distraction Risk",
      headline: "Inventory cannot become the excuse to stop lead gen.",
      narrative:
        "They may be busy with current houses, but they still need the next houses lined up. Do not let active inventory turn into a reason to stop prospecting.",
      coachFocus: [
        `${simpleYtd} They have inventory work happening, but the next batch of leads is too light.`,
        "The risk is that current houses become the excuse for an empty future pipeline.",
      ],
      probes: [
        "Keep Stage 1 moving while inventory is being handled.",
        "Set who owns lead gen every week, even when houses are active.",
        "Bring the conversation back to future purchases, not just current project work.",
      ],
      guardrails: ["Do not let inventory become permission to take the foot off gas."],
      metricLine,
    };
  }

  return {
    tone: "direct",
    label: "Coach Call Needed",
    headline: "The funnel is mixed. Make one call and leave with one move.",
    narrative: "This is not a clean single-stage miss, so the coach needs to turn the call into a clear next action.",
    coachFocus: [
      `${simpleYtd} This is a mixed funnel, but the meeting still needs a clear read before it ends.`,
      `Stage 1 to Stage 4 is ${s1ToS4 ?? 0}%. Compare that against contracts, purchases, inventory, and profit, then name the constraint out loud with the owner.`,
    ],
    probes: [
      "Use the call to decide which part is blocking the next purchase: lead flow, offer creation, seller close, or contract-to-close.",
      "Clean up missing data only if it changes the coaching call. Otherwise move to the operating decision.",
      "Tie the next action to the owner’s next purchase goal.",
    ],
    guardrails: ["Do not leave the call vague. Force one clear next move before the conversation ends."],
    metricLine,
  };
}

function toneClasses(tone: BottleneckTone) {
  if (tone === "healthy") return "border-success/30 bg-success/5 text-success";
  if (tone === "critical") return "border-danger/30 bg-danger/5 text-danger";
  if (tone === "warning") return "border-warning/30 bg-warning/5 text-warning";
  return "border-nah-blue/30 bg-nah-blue/5 text-nah-blue";
}

function BottleneckAgentPanel({ data, loading }: { data: PerformanceData | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="rounded-lg border border-border-default bg-bg-primary p-5">
        <div className="flex items-center gap-3 text-text-tertiary">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-body-sm">Loading fixed YTD bottleneck read...</span>
        </div>
      </div>
    );
  }

  if (!data || !data.kpis) return null;

  const read = buildBottleneckRead(data);
  const toneClass = toneClasses(read.tone);

  return (
    <div className="rounded-lg border border-border-default bg-bg-primary p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-nah-blue/10 text-nah-blue">
              <Bot size={18} />
            </div>
            <div>
              <h3 className="text-body-sm font-semibold text-text-primary">Bottleneck Agent</h3>
              <p className="text-caption text-text-tertiary">
                Coach-call read for this franchisee&apos;s acquisition funnel.
              </p>
            </div>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${toneClass}`}>
              {read.label}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <BottleneckList title="Current Read" icon={Target} items={read.coachFocus} />
        <BottleneckList title="What To Press" icon={Gauge} items={read.probes} />
        <BottleneckList title="Do Not Miss" icon={CheckCircle2} items={read.guardrails} />
      </div>
    </div>
  );
}

function BottleneckList({ title, icon: Icon, items }: { title: string; icon: React.ElementType; items: string[] }) {
  return (
    <div className="rounded-lg border border-border-default bg-bg-secondary p-3">
      <div className="mb-2 flex items-center gap-2 text-caption font-semibold text-text-primary">
        <Icon size={14} />
        {title}
      </div>
      <div className="space-y-2">
        {items.slice(0, 3).map((item) => (
          <p key={item} className="text-caption leading-relaxed text-text-secondary">
            {item}
          </p>
        ))}
      </div>
    </div>
  );
}

function PropertyFunnelBottleneck({
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
