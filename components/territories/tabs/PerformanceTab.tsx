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
  const [storyData, setStoryData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [storyLoading, setStoryLoading] = useState(true);
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
    setStoryLoading(true);
    apiFetch(`/api/territories/${TerritorySlug}/performance?period=ytd`)
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (active) setStoryData(payload);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setStoryLoading(false);
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
        <PropertyFunnelStory
          funnel={funnel}
          periodLabel={PERIOD_LABELS[period]}
          categoryLabel={selectedCategory}
          comparisonLabel={PREV_LABELS[period]}
          storyData={storyData}
          storyLoading={storyLoading}
        />
        <PipelineComparisonTable
          funnel={funnel}
          comparisonRows={comparisonRows}
          activeTerritoryComparisonCount={activeTerritoryComparisonCount}
        />
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

type StoryTone = "healthy" | "direct" | "warning" | "critical";

interface BottleneckRead {
  tone: StoryTone;
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

  const metricLine = `YTD: Stage 1 ${stage1Target ? `${stage1}/${stage1Target}` : stage1}, Stage 4 ${
    stage4Target ? `${stage4}/${stage4Target}` : stage4
  }, contracts ${stage5Target ? `${stage5}/${stage5Target}` : stage5}, purchases ${
    stage6Target ? `${stage6}/${stage6Target}` : stage6
  }.`;

  if (stage1 === 0 && stage4 === 0 && stage5 === 0 && stage6 === 0) {
    return {
      tone: "critical",
      label: "No Funnel To Coach",
      headline: "There is no acquisition process showing in the system.",
      narrative:
        "This is the hard-stop case. The conversation should not drift into lead quality, sales skill, pricing, or inventory strategy until houses are being put into the system.",
      coachFocus: [
        "Get Stage 1 leads entered immediately.",
        "Have the honest commitment conversation if they are not going to work the business.",
      ],
      probes: [
        "What exact lead generation activity happened this week?",
        "Who owns getting the next leads into MasterSuite?",
      ],
      guardrails: ["Be blunt. Do not soften zero activity into 'not enough movement yet.'"],
      metricLine,
    };
  }

  if (stage1VeryLow && hittingDeals) {
    return {
      tone: "warning",
      label: "Buying, But Not Scalable",
      headline: "The output is real, but the operating system is probably invisible.",
      narrative:
        "Low Stage 1 with real contracts or purchases can be a high-quality niche, but it can also mean they are not entering leads. Treat the buying as good news while challenging whether this is coachable, repeatable, and scalable.",
      coachFocus: [
        "Ask what their goals are.",
        "Find out what is keeping them from following the system.",
        "Document what source, niche, or behavior is producing deals if it is legitimate.",
      ],
      probes: [
        "Are all leads being entered into MasterSuite?",
        "Is this dependent on the owner personally working relationships?",
        "Can someone else copy the process?",
      ],
      guardrails: [
        "Do not blindly celebrate purchases if the funnel is hidden.",
        "Do not call it a simple lead quantity bottleneck until data discipline is checked.",
      ],
      metricLine,
    };
  }

  if (stage1Light && hittingDeals && (contractsHealthy || purchasesHealthy)) {
    return {
      tone: lowProfit ? "warning" : "healthy",
      label: lowProfit ? "High Conversion, Check Margin" : "High Conversion, Underfed",
      headline: lowProfit
        ? "They are buying well, but make sure acceptance rate is not being purchased with margin."
        : "The sales process is working. Feed it more leads.",
      narrative:
        "This is not a broken funnel. They are converting the leads they have into contracts or purchases, so the growth lever is more Stage 1 activity. The coach should build confidence that more lead gen should produce ROI.",
      coachFocus: [
        "Double down on lead generation activity.",
        "Protect the current process because it is producing deals.",
        "Ask what their goals are before prescribing how hard to scale.",
      ],
      probes: [
        "Which sources and habits are producing the strongest opportunities?",
        "How much more Stage 1 volume can they add without breaking follow-up?",
        "How do sold-house profits look, especially under $20k average gross?",
      ],
      guardrails: [
        "Do not encourage fewer purchases just to protect conversion optics.",
        "If margin is thin, probe whether offers are too rich and whether more profit per accepted deal is possible.",
      ],
      metricLine,
    };
  }

  if (stage1 > 0 && stage4 === 0) {
    return {
      tone: "critical",
      label: "Leads Not Becoming Offers",
      headline: "Lead quality alone should not explain zero Stage 4.",
      narrative:
        "This is an operator/process problem until proven otherwise. The conversation should stay on lead creation and lead work: follow-up, walks, getting sellers a number, and whether offers are actually being made.",
      coachFocus: [
        "Increase Stage 1 lead flow.",
        "Audit what is happening to every lead before it dies.",
        "Force clarity on why no offers are being created.",
      ],
      probes: [
        "Are they working the leads or writing them off too early?",
        "Did they walk anything?",
        "Did they make any offers that were not advanced to Stage 4?",
      ],
      guardrails: sourceMismatch
        ? ["Flag the data mismatch: lead source pills do not reconcile to Stage 1, so the panel should be checked."]
        : ["Do not let the conversation hide behind 'bad lead quality' without evidence."],
      metricLine,
    };
  }

  if (stage1Healthy && stage4Ratio != null && stage4Ratio < 0.55 && contractsHealthy) {
    return {
      tone: "warning",
      label: "Qualification To Offer Gap",
      headline: "Strong contracts can still hide a Stage 3 to Stage 4 problem.",
      narrative:
        "For cold calling or cold texting markets, a big Stage 1 drop-off can be normal. The better question is why qualified or interested sellers are not becoming real offers often enough.",
      coachFocus: [
        "Audit Stage 3 discipline and offer follow-through.",
        "Look at source quality instead of simply asking for more leads.",
        "Keep credit for contracts already being won.",
      ],
      probes: [
        "Are they skipping Stage 4 when sellers reject the number?",
        "Are Stage 3 leads being advanced too generously?",
        "Should they shift toward better lead-quality sources?",
      ],
      guardrails: [
        "Do not diagnose this as pure lead quantity when Stage 1 is already heavy and contracts are strong.",
      ],
      metricLine: `${metricLine} Stage 3 to Stage 4 conversion is ${s3ToS4 ?? 0}%.`,
    };
  }

  if (stage4Healthy && stage5 === 0) {
    return {
      tone: "warning",
      label: "Offer To Contract Gap",
      headline: "They are getting to offer conversations but not getting contracts.",
      narrative:
        "This is where the coach should inspect sales skill, offer structure, ARV, construction budget, competition, and seller motivation instead of defaulting to more lead volume.",
      coachFocus: [
        "Tighten the offer-to-contract process.",
        "Review deal quality and pricing assumptions.",
        "Listen for whether sellers are getting clear, confident offers.",
      ],
      probes: [
        "Are offers too low, too slow, or poorly explained?",
        "Are ARV and repair budgets killing credibility?",
        "Is competition beating them on speed or certainty?",
      ],
      guardrails: ["Do not make lead gen the headline if Stage 4 volume is already healthy."],
      metricLine: `${metricLine} Stage 4 to contract conversion is ${s4ToS5 ?? 0}%.`,
    };
  }

  if (stage5 > 0 && (s5ToS6 ?? 100) < 60) {
    return {
      tone: "warning",
      label: "Contract To Purchase Watch",
      headline: "Contracts are not becoming purchases fast enough.",
      narrative:
        "This may be a real closing issue or simply newer contracts that have not had time to close. The agent should ask before assuming the funnel is broken.",
      coachFocus: [
        "Identify why contracts are not closing.",
        "Keep future inventory lined up while current deals are worked.",
        "Separate normal timing from avoidable fallout.",
      ],
      probes: [
        "Title issues?",
        "Seller going quiet?",
        "Financing, inspection, or deal-quality friction?",
        "Are these just new contracts?",
      ],
      guardrails: ["Do not tell them to slow lead gen because inventory exists."],
      metricLine: `${metricLine} Contract to purchase conversion is ${s5ToS6 ?? 0}%.`,
    };
  }

  if (stage1Light && (stage4Healthy || hittingDeals)) {
    return {
      tone: "direct",
      label: "Healthy But Underfed",
      headline: "The process appears to work, but the machine is capped by lead volume.",
      narrative:
        "This is the positive but direct conversation: ratios are healthy and houses are being bought, but to reach the level expected, Stage 1 activity needs to materially increase.",
      coachFocus: [
        "Push Stage 1 toward benchmark.",
        "Make the lead gen ask concrete, not a tiny tweak.",
        "Keep reinforcing future inventory creation.",
      ],
      probes: [
        "What activity would double the current lead pace?",
        "Which working lead source deserves more fuel?",
        "What might cause them to slow down when inventory increases?",
      ],
      guardrails: ["Do not treat this like a broken funnel.", "Be direct that the next level requires more leads."],
      metricLine,
    };
  }

  if (stage1Healthy && stage4Healthy && contractsHealthy && purchasesHealthy) {
    return {
      tone: "healthy",
      label: "Empower And Learn",
      headline: "This is working. Help them do even more and learn what to copy.",
      narrative:
        "They are feeding the top, creating real opportunities, getting contracts, and buying houses. The coaching move is not to rebuild the funnel. It is to preserve what works, ask what their goals are, and identify what the rest of the system can learn.",
      coachFocus: [
        "Praise the pipeline.",
        "Ask what would empower them to do more.",
        "Identify the lead sources, habits, and behaviors worth copying.",
      ],
      probes: [
        "What are they doing consistently that other territories are not?",
        "What support would help them scale without breaking the current system?",
        "Where is the light tightening point?",
      ],
      guardrails: ["Do not over-coach a healthy system.", "Do not break what is already producing results."],
      metricLine,
    };
  }

  if (activeInventory > 0 && stage1Light) {
    return {
      tone: "direct",
      label: "Inventory Distraction Risk",
      headline: "They cannot let current inventory stop future inventory creation.",
      narrative:
        "The funnel is not dead, but the coach should keep hammering the importance of lining up the next houses while current inventory is being managed.",
      coachFocus: [
        "Keep Stage 1 moving while inventory is active.",
        "Set a clear weekly lead creation expectation.",
        "Acknowledge the work in inventory without letting it become the excuse.",
      ],
      probes: [
        "Who is protecting lead gen time while houses are in inventory?",
        "What activity continues every week no matter what is in construction?",
      ],
      guardrails: ["Do not let inventory become permission to take the foot off gas."],
      metricLine,
    };
  }

  return {
    tone: "direct",
    label: "Coach The Constraint",
    headline: "Read the whole funnel before naming the bottleneck.",
    narrative:
      "The agent should start with the story, not the loudest number. Decide whether this is an underfed good operator, a hidden-data business, an offer gap, a closing gap, or a true commitment problem.",
    coachFocus: [
      "Anchor on the highest-leverage constraint.",
      "Compare lead volume, offer creation, contracts, purchases, inventory, and profit quality together.",
      "Turn the read into one coaching conversation.",
    ],
    probes: [
      "Are the numbers complete?",
      "What stage is truly limiting purchases?",
      "What is the owner's goal for the next level?",
    ],
    guardrails: [`Stage 1 to Stage 4 conversion is ${s1ToS4 ?? 0}%; do not diagnose from Stage 1 alone.`],
    metricLine,
  };
}

function toneClasses(tone: StoryTone) {
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
                Fixed YTD read. Timeline switches below do not change this.
              </p>
            </div>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${toneClass}`}>
              {read.label}
            </span>
          </div>

          <h2 className="mt-4 text-xl font-bold leading-tight text-text-primary">{read.headline}</h2>
          <p className="mt-2 max-w-4xl text-body-sm leading-relaxed text-text-secondary">{read.narrative}</p>
          <p className="mt-3 text-caption font-medium text-text-tertiary">{read.metricLine}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        <StoryList title="Coach Focus" icon={Target} items={read.coachFocus} />
        <StoryList title="Questions To Ask" icon={Gauge} items={read.probes} />
        <StoryList title="Guardrails" icon={CheckCircle2} items={read.guardrails} />
      </div>
    </div>
  );
}

function StoryList({ title, icon: Icon, items }: { title: string; icon: React.ElementType; items: string[] }) {
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

function PropertyFunnelStory({
  funnel,
  periodLabel,
  categoryLabel,
  comparisonLabel,
  storyData,
  storyLoading,
}: {
  funnel: FunnelStage[];
  periodLabel: string;
  categoryLabel: string | null;
  comparisonLabel: string;
  storyData: PerformanceData | null;
  storyLoading: boolean;
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

      <BottleneckAgentPanel data={storyData} loading={storyLoading} />
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
