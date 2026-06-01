import {
  ArrowDown,
  ArrowRight,
  BarChart3,
  CircleDollarSign,
  ClipboardCheck,
  Gauge,
  GitBranch,
  Hammer,
  Home,
  ListChecks,
  Map,
  PhoneCall,
  Route,
  Sparkles,
  TrendingDown,
} from "lucide-react";

const STAGES = [
  { key: "entered", label: "Entered", count: 195, color: "#00a1e1" },
  { key: "contacted", label: "Contacted", count: 140, color: "#38bdf8" },
  { key: "qualified", label: "Qualified", count: 56, color: "#6366f1" },
  { key: "offer", label: "Offer", count: 55, color: "#f5a800" },
  { key: "contract", label: "Contract", count: 15, color: "#f97316" },
  { key: "purchase", label: "Purchased", count: 9, color: "#059669" },
] as const;

const MAX_COUNT = STAGES[0].count;

const QUALITY_ROWS = [
  { label: "High equity", values: [42, 34, 18, 18, 7, 5] },
  { label: "Tired landlord", values: [38, 27, 12, 11, 4, 2] },
  { label: "Vacant", values: [24, 16, 8, 8, 2, 1] },
  { label: "Light distress", values: [91, 63, 18, 18, 2, 1] },
] as const;

const EXAMPLES = [
  {
    number: "01",
    name: "Pipeline Story",
    bestFor: "Best if Corey wants the chart to read like a sentence.",
    icon: Sparkles,
    render: <PipelineStory />,
  },
  {
    number: "02",
    name: "Drop-Off Ledger",
    bestFor: "Best if the main question is where the lead count breaks.",
    icon: TrendingDown,
    render: <DropOffLedger />,
  },
  {
    number: "03",
    name: "Stage Cards With Bridges",
    bestFor: "Best if the team wants one clean KPI per step.",
    icon: GitBranch,
    render: <StageCardsWithBridges />,
  },
  {
    number: "04",
    name: "Lead Quality Heatmap",
    bestFor: "Best if lead source and quality explain the story.",
    icon: BarChart3,
    render: <LeadQualityHeatmap />,
  },
  {
    number: "05",
    name: "Property Journey Rail",
    bestFor: "Best if it should feel like houses moving toward closing.",
    icon: Home,
    render: <PropertyJourneyRail />,
  },
  {
    number: "06",
    name: "Bottleneck Board",
    bestFor: "Best if the page should tell operators what needs attention.",
    icon: Gauge,
    render: <BottleneckBoard />,
  },
  {
    number: "07",
    name: "Soft Flow Bands",
    bestFor: "Best if the team still wants a visual funnel, but softer.",
    icon: Route,
    render: <SoftFlowBands />,
  },
  {
    number: "08",
    name: "Executive Snapshot",
    bestFor: "Best for owners who only want the business story fast.",
    icon: CircleDollarSign,
    render: <ExecutiveSnapshot />,
  },
  {
    number: "09",
    name: "Deal Desk",
    bestFor: "Best if reps need a working view more than a chart.",
    icon: ListChecks,
    render: <DealDesk />,
  },
  {
    number: "10",
    name: "Market Map Strip",
    bestFor: "Best if geography matters as much as stage count.",
    icon: Map,
    render: <MarketMapStrip />,
  },
] as const;

function pct(count: number, base: number = MAX_COUNT) {
  if (base <= 0) return 0;
  return Math.round((count / base) * 100);
}

function compact(n: number) {
  return n.toLocaleString();
}

export default function PipelineExamplesPage() {
  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 border-b border-border-default pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-label-caps text-nah-blue">Design picker</p>
          <h1 className="mt-1 text-page-title text-text-primary">10 Property Pipeline Directions</h1>
          <p className="mt-2 max-w-3xl text-body text-text-secondary">
            Static mockups for the house-flipping lead pipeline. Each option uses the same sample counts so the visual
            difference is easy to compare.
          </p>
        </div>
        <div className="rounded-lg border border-border-default bg-bg-secondary px-4 py-3">
          <p className="text-caption text-text-tertiary">Sample flow</p>
          <p className="text-body-sm font-semibold text-text-primary">195 entered → 9 purchased</p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {EXAMPLES.map((example) => {
          const Icon = example.icon;
          return (
            <section key={example.number} className="rounded-lg border border-border-default bg-bg-primary p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-nah-blue/10 text-nah-blue">
                    <Icon size={19} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-caption font-semibold text-text-tertiary">{example.number}</span>
                      <h2 className="text-card-title text-text-primary">{example.name}</h2>
                    </div>
                    <p className="mt-1 text-caption text-text-secondary">{example.bestFor}</p>
                  </div>
                </div>
                <button className="rounded-md border border-border-default px-3 py-1.5 text-caption font-semibold text-text-secondary hover:border-nah-blue/40 hover:text-nah-blue">
                  Pick
                </button>
              </div>
              {example.render}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function PipelineStory() {
  const reachedOffer = STAGES[3].count;
  const purchases = STAGES[5].count;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <StoryMetric value={STAGES[0].count} label="new leads" />
        <StoryMetric value={`${pct(reachedOffer)}%`} label="reached offer" />
        <StoryMetric value={purchases} label="purchased" />
      </div>
      <div className="space-y-3">
        {STAGES.map((stage, index) => (
          <div key={stage.key} className="grid grid-cols-[92px_minmax(0,1fr)_72px] items-center gap-3">
            <span className="text-caption font-semibold text-text-primary">{stage.label}</span>
            <div className="h-7 overflow-hidden rounded-md bg-bg-tertiary">
              <div
                className="h-full rounded-md"
                style={{ width: `${Math.max(pct(stage.count), 5)}%`, backgroundColor: `${stage.color}99` }}
              />
            </div>
            <div className="text-right">
              <p className="text-body-sm font-bold text-text-primary">{compact(stage.count)}</p>
              <p className="text-[11px] text-text-tertiary">{index === 0 ? "start" : `${pct(stage.count)}%`}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="rounded-md bg-nah-blue/10 px-3 py-2 text-caption font-medium text-text-primary">
        Story: strong early movement, then contract conversion is the pressure point.
      </p>
    </div>
  );
}

function DropOffLedger() {
  return (
    <div className="overflow-hidden rounded-lg border border-border-default">
      {STAGES.map((stage, index) => {
        const prev = index === 0 ? stage.count : STAGES[index - 1].count;
        const lost = Math.max(prev - stage.count, 0);
        return (
          <div
            key={stage.key}
            className="grid grid-cols-[1fr_74px_92px] items-center border-b border-border-default bg-bg-secondary px-3 py-2 last:border-b-0"
          >
            <div className="min-w-0">
              <p className="truncate text-body-sm font-semibold text-text-primary">{stage.label}</p>
              <p className="text-[11px] text-text-tertiary">
                {index === 0 ? "Starting volume" : `${pct(stage.count, prev)}% from prior`}
              </p>
            </div>
            <p className="text-right text-body-sm font-bold text-text-primary">{compact(stage.count)}</p>
            <p className={`text-right text-caption font-semibold ${lost > 25 ? "text-danger" : "text-text-tertiary"}`}>
              {index === 0 ? "—" : `-${compact(lost)}`}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function StageCardsWithBridges() {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {STAGES.map((stage, index) => {
        const prev = index === 0 ? stage.count : STAGES[index - 1].count;
        return (
          <div key={stage.key} className="rounded-lg border border-border-default bg-bg-secondary p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-caption font-semibold text-text-secondary">{stage.label}</p>
              {index > 0 && <ArrowRight size={14} className="text-text-tertiary" />}
            </div>
            <p className="mt-2 text-xl font-bold text-text-primary">{compact(stage.count)}</p>
            <div className="mt-2 h-1.5 rounded-full bg-bg-tertiary">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(pct(stage.count), 4)}%`, backgroundColor: stage.color }}
              />
            </div>
            <p className="mt-2 text-[11px] text-text-tertiary">
              {index === 0 ? "lead pool" : `${pct(stage.count, prev)}% step conversion`}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function LeadQualityHeatmap() {
  const max = Math.max(...QUALITY_ROWS.flatMap((row) => row.values));
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        <div className="grid grid-cols-[120px_repeat(6,1fr)] gap-1 text-[11px] font-semibold text-text-tertiary">
          <span />
          {STAGES.map((stage) => (
            <span key={stage.key} className="truncate text-center">
              {stage.label}
            </span>
          ))}
        </div>
        <div className="mt-2 space-y-1">
          {QUALITY_ROWS.map((row) => (
            <div key={row.label} className="grid grid-cols-[120px_repeat(6,1fr)] gap-1">
              <span className="flex items-center rounded-md bg-bg-secondary px-2 text-caption font-semibold text-text-primary">
                {row.label}
              </span>
              {row.values.map((value, index) => (
                <span
                  key={`${row.label}-${STAGES[index].key}`}
                  className="rounded-md px-2 py-3 text-center text-caption font-bold text-text-primary"
                  style={{ backgroundColor: `rgba(0, 161, 225, ${0.08 + (value / max) * 0.36})` }}
                >
                  {value}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PropertyJourneyRail() {
  return (
    <div className="space-y-5">
      <div className="flex items-start overflow-x-auto pb-2">
        {STAGES.map((stage, index) => (
          <div key={stage.key} className="flex min-w-[120px] flex-1 items-start">
            {index > 0 && <div className="mt-5 h-0.5 min-w-8 flex-1 bg-border-default" />}
            <div className="flex min-w-[92px] flex-col items-center text-center">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: stage.color }}
              >
                {index < 3 ? <PhoneCall size={16} /> : index < 5 ? <ClipboardCheck size={16} /> : <Home size={16} />}
              </div>
              <p className="mt-2 text-caption font-semibold text-text-primary">{stage.label}</p>
              <p className="text-body-sm font-bold text-text-primary">{compact(stage.count)}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-md bg-bg-secondary px-3 py-2 text-caption text-text-secondary">
        Feels less like a chart and more like properties traveling from lead to house purchase.
      </div>
    </div>
  );
}

function BottleneckBoard() {
  const bottlenecks = [
    { label: "Offer → Contract", note: "40 leads did not sign", tone: "text-danger", icon: TrendingDown },
    { label: "Contract → Purchase", note: "60% close rate", tone: "text-warning", icon: Gauge },
    { label: "Stage 2 → Qualified", note: "56 of 140 advanced", tone: "text-text-secondary", icon: ArrowDown },
  ];
  return (
    <div className="grid gap-3 md:grid-cols-[1fr_1.1fr]">
      <div className="rounded-lg bg-bg-secondary p-4">
        <p className="text-caption text-text-tertiary">Main read</p>
        <p className="mt-1 text-xl font-bold text-text-primary">Contracts are the pinch point.</p>
        <p className="mt-2 text-caption text-text-secondary">
          The view starts with the operating conclusion, then supports it with numbers.
        </p>
      </div>
      <div className="space-y-2">
        {bottlenecks.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="flex items-center gap-3 rounded-lg border border-border-default bg-bg-secondary p-3"
            >
              <Icon size={17} className={item.tone} />
              <div>
                <p className="text-body-sm font-semibold text-text-primary">{item.label}</p>
                <p className="text-caption text-text-tertiary">{item.note}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SoftFlowBands() {
  return (
    <div className="space-y-3">
      {STAGES.map((stage, index) => (
        <div key={stage.key} className="flex items-center gap-3">
          <div className="w-20 text-caption font-semibold text-text-primary">{stage.label}</div>
          <div className="h-9 flex-1 rounded-full bg-bg-tertiary p-1">
            <div
              className="flex h-full items-center justify-end rounded-full px-3 text-[11px] font-bold text-white"
              style={{
                width: `${Math.max(Math.sqrt(stage.count / MAX_COUNT) * 100, 13)}%`,
                backgroundColor: stage.color,
              }}
            >
              {compact(stage.count)}
            </div>
          </div>
          <div className="w-10 text-right text-[11px] text-text-tertiary">
            {index === 0 ? "100%" : `${pct(stage.count)}%`}
          </div>
        </div>
      ))}
    </div>
  );
}

function ExecutiveSnapshot() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <StoryMetric value="28%" label="lead → offer" />
        <StoryMetric value="27%" label="offer → contract" />
        <StoryMetric value="60%" label="contract → buy" />
      </div>
      <div className="rounded-lg bg-bg-secondary p-4">
        <p className="text-caption text-text-tertiary">Plain-English readout</p>
        <p className="mt-1 text-body-sm font-semibold text-text-primary">
          Lead volume is healthy. The biggest missed value is between accepted seller interest and signed contract.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MiniFact label="Working leads" value="186" />
        <MiniFact label="Bought houses" value="9" />
      </div>
    </div>
  );
}

function DealDesk() {
  const rows = [
    ["Hot seller follow-up", "Offer", "18", "Same-day call"],
    ["Contract cleanup", "Contract", "15", "Title / inspection"],
    ["Ready to buy", "Purchased", "9", "Handoff to ops"],
    ["Needs qualification", "Qualified", "56", "Price check"],
  ] as const;
  return (
    <div className="overflow-hidden rounded-lg border border-border-default">
      {rows.map(([name, stage, count, action]) => (
        <div
          key={name}
          className="grid grid-cols-[1fr_76px_52px] gap-2 border-b border-border-default bg-bg-secondary px-3 py-2 last:border-b-0"
        >
          <div className="min-w-0">
            <p className="truncate text-body-sm font-semibold text-text-primary">{name}</p>
            <p className="truncate text-[11px] text-text-tertiary">{action}</p>
          </div>
          <p className="self-center rounded-md bg-bg-tertiary px-2 py-1 text-center text-[11px] font-semibold text-text-secondary">
            {stage}
          </p>
          <p className="self-center text-right text-body-sm font-bold text-text-primary">{count}</p>
        </div>
      ))}
    </div>
  );
}

function MarketMapStrip() {
  const markets = [
    { label: "Knoxville", value: 55, color: "#00a1e1" },
    { label: "Chattanooga", value: 34, color: "#f5a800" },
    { label: "Nashville", value: 22, color: "#6366f1" },
    { label: "Tri-Cities", value: 15, color: "#059669" },
  ];
  return (
    <div className="space-y-3">
      {markets.map((market) => (
        <div key={market.label} className="grid grid-cols-[100px_minmax(0,1fr)_42px] items-center gap-3">
          <p className="truncate text-caption font-semibold text-text-primary">{market.label}</p>
          <div className="h-8 rounded-md bg-bg-tertiary">
            <div
              className="h-full rounded-md"
              style={{ width: `${Math.max((market.value / 55) * 100, 12)}%`, backgroundColor: `${market.color}99` }}
            />
          </div>
          <p className="text-right text-body-sm font-bold text-text-primary">{market.value}</p>
        </div>
      ))}
      <p className="rounded-md bg-bg-secondary px-3 py-2 text-caption text-text-secondary">
        Useful when the pipeline story needs to compare territories, not just total count.
      </p>
    </div>
  );
}

function StoryMetric({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="rounded-lg bg-bg-secondary px-3 py-3">
      <p className="text-xl font-bold text-text-primary">{typeof value === "number" ? compact(value) : value}</p>
      <p className="text-caption text-text-tertiary">{label}</p>
    </div>
  );
}

function MiniFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border-default bg-bg-secondary px-3 py-2">
      <p className="text-caption text-text-tertiary">{label}</p>
      <p className="text-lg font-bold text-text-primary">{value}</p>
    </div>
  );
}
