"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, BarChart3, Clock, Home, Loader2, MapPin } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { apiFetch } from "@/lib/auth/api-fetch";
import type { UserRole } from "@/types/database";

interface StageCount {
  stage: string;
  count: number;
}

interface RepFocus {
  name: string;
  stalled: number;
}

type L10PeriodKey = "T1" | "T3" | "T6" | "T12";

interface TerritoryFocus {
  slug: string;
  name: string;
  region: string | null;
  health: number | null;
  leadListInsertedMonth: number;
  stage1Last30d: number;
  stage2Last30d: number;
  stage3Last30d: number;
  stage4Last30d: number;
  contractsLast30d: number;
  purchasesLast30d: number;
  purchasesT12: number;
  openIssues: number;
  openTodos: number;
  quartile: "Q1" | "Q2" | "Q3" | "Q4";
  score: number;
  rank: number;
  status: string;
  leadWorkRate: number;
  coachingFlag: string;
  coachingReason: string;
}

interface L10Data {
  generatedAt: string;
  period: {
    key: L10PeriodKey;
    label: string;
    days: number;
  };
  devSales: {
    activeProspects: number;
    newProspectsPeriod: number;
    ptoEnrolleesPeriod: number;
    closedFranchiseesPeriod: number;
    movedPeriod: number;
    stalledProspects: number;
    timing: {
      avgProspectToClosedDays: number | null;
      prospectToClosedCount: number;
      avgClosedToFirstPurchaseDays: number | null;
      closedToFirstPurchaseCount: number;
    };
    stageCounts: StageCount[];
    repsToFocus: RepFocus[];
  };
  coaching: {
    activeTerritories: number;
    leadListInsertedMonth: number;
    stage1Last30d: number;
    stage2Last30d: number;
    stage3Last30d: number;
    stage4Last30d: number;
    contractsLast30d: number;
    purchasesLast30d: number;
    medianPurchasesT12: number | null;
    highPerformersT12: number;
    royaltiesPaid: number;
    royaltiesDue: number;
    leadListMix: { label: string; count: number }[];
    territories: TerritoryFocus[];
    focusTerritories: TerritoryFocus[];
    opportunityTerritories: TerritoryFocus[];
  };
  operatingHealth: {
    avgScorecardHealth: number | null;
    openIssues: number;
    openTodos: number;
    rocksOnTrack: number;
    rocksOffTrack: number;
  };
  issues: { TerritorySlug: string; title: string; priority: string | null; created_at: string | null }[];
  todos: { TerritorySlug: string; title: string; assignee: string | null; due_date: string | null }[];
}

const PERIOD_OPTIONS: { key: L10PeriodKey; label: string; sub: string }[] = [
  { key: "T1", label: "T1", sub: "30 days" },
  { key: "T3", label: "T3", sub: "90 days" },
  { key: "T6", label: "T6", sub: "180 days" },
  { key: "T12", label: "T12", sub: "365 days" },
];

const L10_ROLES: UserRole[] = ["admin", "operator", "leadership"];

function canViewL10(role: UserRole | undefined) {
  return role ? L10_ROLES.includes(role) : false;
}

const MONTHLY_LEAD_LIST_BENCHMARK_PER_TERRITORY = 1000;

function formatNumber(value: number | null | undefined) {
  if (value == null) return "-";
  return value.toLocaleString();
}

function formatMoney(value: number | null | undefined) {
  if (value == null) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDays(value: number | null | undefined) {
  if (value == null) return "-";
  return `${formatNumber(value)}d`;
}

function formatRelativeTime(value: string | null) {
  if (!value) return "never";
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "unknown";
  const diffMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 48) return `${diffHours}h ago`;
  return `${Math.round(diffHours / 24)}d ago`;
}

function HeaderCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: React.ElementType;
  tone: "blue" | "green" | "amber";
}) {
  const tones = {
    blue: "border-nah-blue/20 bg-nah-blue-light text-nah-blue",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
  };

  return (
    <div className="rounded-lg border border-border-default bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-caption font-semibold uppercase text-text-tertiary">{label}</div>
          <div className="mt-3 text-3xl font-bold text-text-primary">{value}</div>
        </div>
        <div className={`rounded-lg border p-2 ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-3 text-sm text-text-secondary">{detail}</p>
    </div>
  );
}

function BigBlueCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-xl bg-gradient-to-br from-nah-blue to-[#0080b8] px-5 py-4 text-white shadow-md">
      <span className="text-4xl font-extrabold leading-none tracking-tight">{value}</span>
      <p className="mt-1.5 text-sm font-medium text-white/80">{label}</p>
      <p className="text-[11px] text-white/50">{detail}</p>
    </div>
  );
}

function TimingCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-lg border border-border-default bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase text-text-tertiary">{label}</div>
          <div className="mt-2 text-3xl font-bold text-text-primary">{value}</div>
          <div className="mt-1 text-xs text-text-secondary">{detail}</div>
        </div>
        <div className="rounded-lg border border-nah-blue/20 bg-nah-blue-light p-2 text-nah-blue">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function MetricTile({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  sub: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-lg border border-border-default bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-text-secondary">{label}</span>
        <Icon className="h-4 w-4 text-text-tertiary" />
      </div>
      <div className="text-2xl font-bold text-text-primary">{value}</div>
      <div className="mt-1 text-xs text-text-tertiary">{sub}</div>
    </div>
  );
}

const LEAD_MIX_COLORS = ["#f97316", "#0ea5e9", "#22c55e", "#8b5cf6", "#f59e0b", "#14b8a6", "#ef4444", "#64748b"];

function LeadListMixDonut({
  rows,
  total,
  selectedPeriodLabel,
}: {
  rows: { label: string; count: number }[];
  total: number;
  selectedPeriodLabel: string;
}) {
  let cursor = 0;
  const gradient =
    rows.length > 0 && total > 0
      ? rows
          .map((row, index) => {
            const start = cursor;
            const end = cursor + (row.count / total) * 100;
            cursor = end;
            return `${LEAD_MIX_COLORS[index % LEAD_MIX_COLORS.length]} ${start}% ${end}%`;
          })
          .join(", ")
      : "#e5e7eb 0% 100%";

  return (
    <section className="rounded-lg border border-border-default bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-nah-blue" />
            <h3 className="text-card-title text-text-primary">All 0 Lead List</h3>
          </div>
          <p className="mt-1 text-sm text-text-secondary">
            Lead-list mix across all active territories in {selectedPeriodLabel}.
          </p>
          <div className="mt-4 flex items-end gap-3">
            <div className="text-4xl font-bold text-text-primary">{formatNumber(total)}</div>
            <div className="pb-1 text-sm font-medium text-text-tertiary">0 Lead List records</div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)] lg:w-[560px]">
          <div className="flex items-center justify-center">
            <div
              className="relative h-36 w-36 rounded-full border border-border-default shadow-inner"
              style={{ background: `conic-gradient(${gradient})` }}
              aria-label="All 0 Lead List mix"
            >
              <div className="absolute inset-8 rounded-full border border-border-default bg-white" />
            </div>
          </div>

          <div className="grid content-center gap-2 sm:grid-cols-2">
            {(rows.length > 0 ? rows : [{ label: "No lead-list mix", count: 0 }]).map((row, index) => (
              <div key={row.label} className="flex min-w-0 items-center gap-2 rounded-md bg-bg-secondary px-2 py-1.5">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: LEAD_MIX_COLORS[index % LEAD_MIX_COLORS.length] }}
                />
                <span className="min-w-0 flex-1 truncate text-xs text-text-secondary">{row.label}</span>
                <span className="text-xs font-semibold text-text-primary">{formatNumber(row.count)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ScoreboardStat({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="min-w-0 border-r border-border-default px-4 py-3 last:border-r-0">
      <div className="text-xs font-semibold uppercase text-text-tertiary">{label}</div>
      <div className="mt-1 text-xl font-bold text-text-primary">{value}</div>
      <div className="mt-0.5 truncate text-xs text-text-secondary">{sub}</div>
    </div>
  );
}

function BenchmarkProgress({ value, benchmark, label }: { value: number; benchmark: number; label: string }) {
  const progress = benchmark > 0 ? Math.min(Math.round((value / benchmark) * 100), 100) : 0;
  const shortBy = Math.max(benchmark - value, 0);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-text-secondary">{label}</span>
        <span className="font-semibold text-text-primary">
          {formatNumber(value)} / {formatNumber(benchmark)}
        </span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-slate-100">
        <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-1 text-xs text-text-tertiary">
        {progress}% to pace{shortBy > 0 ? ` · ${formatNumber(shortBy)} short` : " · at or above pace"}
      </div>
    </div>
  );
}

function SectionHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <h2 className="text-section-title text-text-primary">{title}</h2>
      <p className="mt-1 text-sm text-text-secondary">{sub}</p>
    </div>
  );
}

function percent(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

function periodLabel(data: L10Data) {
  return `${data.period.label} (${data.period.days} days)`;
}

function scaledLeadListBenchmark(activeTerritories: number, days: number) {
  return Math.round(activeTerritories * MONTHLY_LEAD_LIST_BENCHMARK_PER_TERRITORY * (days / 30));
}

function territoryInsight(territory: TerritoryFocus, label: string) {
  if (
    territory.leadListInsertedMonth === 0 &&
    territory.stage1Last30d === 0 &&
    territory.stage3Last30d === 0 &&
    territory.stage4Last30d === 0
  ) {
    return `No lead creation or lead-work activity in ${label}.`;
  }
  if (territory.leadListInsertedMonth > 0 && territory.stage1Last30d === 0) {
    return "Lead-list work exists, but it has not produced Stage 1 leads yet.";
  }
  if (territory.stage1Last30d > 0 && territory.stage3Last30d === 0 && territory.stage4Last30d === 0) {
    return "Stage 1 leads exist, but none are showing worked or offer-stage movement.";
  }
  if (territory.stage3Last30d > 0 && territory.stage4Last30d === 0) {
    return "Leads are being worked, but offers are not showing up yet.";
  }
  if (territory.stage4Last30d > 0 && territory.contractsLast30d === 0) {
    return "Offers are happening, but no contracts are showing in this period.";
  }
  if (territory.contractsLast30d > 0 && territory.purchasesLast30d === 0) {
    return "Contracts are present; watch whether they convert to purchases.";
  }
  if (territory.purchasesLast30d > 0) {
    return "Buying activity is showing in the selected period.";
  }
  return territory.coachingReason;
}

const QUARTILE_STYLES: Record<TerritoryFocus["quartile"], string> = {
  Q1: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Q2: "border-yellow-200 bg-yellow-50 text-yellow-700",
  Q3: "border-orange-200 bg-orange-50 text-orange-700",
  Q4: "border-red-200 bg-red-50 text-red-700",
};

const QUARTILE_DESCRIPTIONS: Record<TerritoryFocus["quartile"], { title: string; sub: string }> = {
  Q1: { title: "Model Territories", sub: "What is working" },
  Q2: { title: "Solid Territories", sub: "Small push to top tier" },
  Q3: { title: "Coaching Opportunity", sub: "Needs monitoring" },
  Q4: { title: "Immediate Action", sub: "Spend time first" },
};

type QuartileBox = {
  label: string;
  sub: string;
  valueLabel: string;
  activeLabel: string;
  noActivityLabel: string;
  dataNote?: string;
  direction: "higher" | "lower";
  getValue: (territory: TerritoryFocus) => number;
  format?: (value: number) => string;
};

const QUARTILE_BOXES: QuartileBox[] = [
  {
    label: "Lead List Inserted",
    sub: "Stage 0 lead-list volume from monthly aggregate counts.",
    valueLabel: "records",
    activeLabel: "territories with Stage 0 volume",
    noActivityLabel: "No Stage 0 aggregate count",
    dataNote: "Stage 0 raw properties are not loaded here; this uses monthly lead-list aggregates.",
    direction: "higher",
    getValue: (t) => t.leadListInsertedMonth,
  },
  {
    label: "Stage 1 Leads",
    sub: "Are lead-list and marketing activities creating real seller leads?",
    valueLabel: "leads",
    activeLabel: "territories with Stage 1 leads",
    noActivityLabel: "No Stage 1 leads",
    direction: "higher",
    getValue: (t) => t.stage1Last30d,
  },
  {
    label: "Stage 3 Worked",
    sub: "Are new leads getting worked far enough to become real opportunities?",
    valueLabel: "worked",
    activeLabel: "territories with worked leads",
    noActivityLabel: "No Stage 3 movement",
    direction: "higher",
    getValue: (t) => t.stage3Last30d,
  },
  {
    label: "Stage 4 Offers",
    sub: "Are they actually working leads far enough to make offers?",
    valueLabel: "offers",
    activeLabel: "territories with offers",
    noActivityLabel: "No Stage 4 offers",
    direction: "higher",
    getValue: (t) => t.stage4Last30d,
  },
  {
    label: "Lead Work Rate",
    sub: "How much Stage 1 activity is reaching worked/offer stages?",
    valueLabel: "worked",
    activeLabel: "territories with lead work",
    noActivityLabel: "No measurable work rate",
    direction: "higher",
    getValue: (t) => t.leadWorkRate,
    format: (value) => `${value}%`,
  },
  {
    label: "Contracts",
    sub: "Are offers turning into signed purchase contracts?",
    valueLabel: "contracts",
    activeLabel: "territories with contracts",
    noActivityLabel: "No contracts",
    direction: "higher",
    getValue: (t) => t.contractsLast30d,
  },
  {
    label: "Purchases",
    sub: "Who is converting activity into bought houses?",
    valueLabel: "purchases",
    activeLabel: "territories with purchases",
    noActivityLabel: "No purchases",
    direction: "higher",
    getValue: (t) => t.purchasesLast30d,
  },
  {
    label: "Trailing 12 Buying",
    sub: "Longer-term purchase history, always trailing 12 months.",
    valueLabel: "T12 buys",
    activeLabel: "territories with T12 buys",
    noActivityLabel: "No T12 purchases",
    dataNote: "This card does not change to T1/T3/T6; it is the trailing-12 baseline.",
    direction: "higher",
    getValue: (t) => t.purchasesT12,
  },
];

function QuartileCard({
  box,
  territories,
  selectedPeriodLabel,
}: {
  box: QuartileBox;
  territories: TerritoryFocus[];
  selectedPeriodLabel: string;
}) {
  const sorted = [...territories].sort((a, b) => {
    const diff = box.getValue(b) - box.getValue(a);
    return box.direction === "higher" ? diff : -diff;
  });
  const quartileSize = Math.max(1, Math.ceil(sorted.length / 4));
  const top = sorted.slice(0, quartileSize);
  const noActivity = sorted.filter((territory) => box.getValue(territory) === 0);
  const active = sorted.filter((territory) => box.getValue(territory) > 0);
  const spendTime = noActivity.length > 0 ? noActivity : sorted.slice(-quartileSize).reverse();
  const topMedian = top.length > 0 ? Math.round(top.reduce((sum, t) => sum + box.getValue(t), 0) / top.length) : 0;
  const fmt = box.format ?? ((value: number) => formatNumber(value));
  const noActivityScope = box.label === "Trailing 12 Buying" ? "T12" : selectedPeriodLabel;

  return (
    <div className="rounded-lg border border-border-default bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-card-title text-text-primary">{box.label}</h3>
          <p className="mt-1 text-xs text-text-secondary">{box.sub}</p>
          {box.dataNote && <p className="mt-2 text-[11px] leading-snug text-text-tertiary">{box.dataNote}</p>}
        </div>
        <span className="rounded-full bg-bg-tertiary px-2 py-1 text-xs font-semibold text-text-tertiary">
          Quartiles
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-emerald-50 p-3">
          <div className="text-xs font-semibold uppercase text-emerald-700">Model</div>
          <div className="mt-1 text-xl font-bold text-emerald-900">{fmt(topMedian)}</div>
          <div className="text-xs text-emerald-700">{box.valueLabel}</div>
        </div>
        <div className="rounded-lg bg-amber-50 p-3">
          <div className="text-xs font-semibold uppercase text-amber-700">No Activity</div>
          <div className="mt-1 text-xl font-bold text-amber-900">{noActivity.length}</div>
          <div className="text-xs text-amber-700">territories</div>
        </div>
      </div>
      <div className="mt-3 text-xs text-text-secondary">
        {active.length} {box.activeLabel}; {noActivity.length} showing no activity in {noActivityScope}.
      </div>
      <div className="mt-4 space-y-2">
        {spendTime.slice(0, 4).map((territory) => (
          <Link
            key={territory.slug}
            href={`/territories/${territory.slug}`}
            className="flex items-center justify-between gap-3 rounded-md border border-border-default px-3 py-2 hover:bg-bg-hover"
          >
            <span className="min-w-0 truncate text-sm font-medium text-text-primary">{territory.name}</span>
            <span className="flex flex-shrink-0 items-center gap-2">
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${QUARTILE_STYLES[territory.quartile]}`}
              >
                {territory.quartile}
              </span>
              <span className="text-sm font-semibold text-text-secondary">
                {box.getValue(territory) === 0 ? box.noActivityLabel : fmt(box.getValue(territory))}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function CompactTerritoryRow({
  territory,
  selectedPeriodLabel,
}: {
  territory: TerritoryFocus;
  selectedPeriodLabel: string;
}) {
  return (
    <Link
      href={`/territories/${territory.slug}`}
      className="block rounded-md border border-border-default bg-white px-3 py-2 hover:bg-bg-hover"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-text-primary">{territory.name}</div>
          <div className="mt-1 truncate text-xs text-text-secondary">{territory.coachingFlag}</div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${QUARTILE_STYLES[territory.quartile]}`}
          >
            {territory.quartile}
          </span>
          <span className="text-xs font-semibold text-text-tertiary">#{territory.rank}</span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
        <div>
          <div className="font-semibold text-text-primary">{territory.stage1Last30d}</div>
          <div className="text-text-tertiary">S1</div>
        </div>
        <div>
          <div className="font-semibold text-text-primary">{territory.leadWorkRate}%</div>
          <div className="text-text-tertiary">work</div>
        </div>
        <div>
          <div className="font-semibold text-text-primary">{territory.stage4Last30d}</div>
          <div className="text-text-tertiary">S4</div>
        </div>
        <div>
          <div className="font-semibold text-text-primary">{territory.purchasesLast30d}</div>
          <div className="text-text-tertiary">buy</div>
        </div>
      </div>
      <div className="mt-2 line-clamp-2 text-xs text-text-secondary">
        {territoryInsight(territory, selectedPeriodLabel)}
      </div>
    </Link>
  );
}

function QuartileOperatingColumn({
  quartile,
  territories,
  selectedPeriodLabel,
}: {
  quartile: TerritoryFocus["quartile"];
  territories: TerritoryFocus[];
  selectedPeriodLabel: string;
}) {
  const meta = QUARTILE_DESCRIPTIONS[quartile];
  const sorted = [...territories].sort((a, b) => {
    if (quartile === "Q1" || quartile === "Q2") return a.rank - b.rank;
    return b.rank - a.rank;
  });

  return (
    <div className="rounded-lg border border-border-default bg-bg-secondary p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div
            className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${QUARTILE_STYLES[quartile]}`}
          >
            {quartile}
          </div>
          <h3 className="mt-2 text-card-title text-text-primary">{meta.title}</h3>
          <p className="text-xs text-text-secondary">{meta.sub}</p>
        </div>
        <div className="rounded-lg bg-white px-2 py-1 text-sm font-bold text-text-primary">{territories.length}</div>
      </div>
      <div className="space-y-2">
        {sorted.map((territory) => (
          <CompactTerritoryRow key={territory.slug} territory={territory} selectedPeriodLabel={selectedPeriodLabel} />
        ))}
        {sorted.length === 0 && (
          <div className="rounded-md border border-border-default bg-white p-3 text-sm text-text-secondary">
            No territories in this quartile.
          </div>
        )}
      </div>
    </div>
  );
}

function AgendaBlock({
  time,
  title,
  territories,
  selectedPeriodLabel,
}: {
  time: string;
  title: string;
  territories: TerritoryFocus[];
  selectedPeriodLabel: string;
}) {
  return (
    <div className="rounded-lg border border-border-default bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase text-text-tertiary">{time}</div>
          <h3 className="mt-1 text-card-title text-text-primary">{title}</h3>
        </div>
        <span className="rounded-full bg-bg-tertiary px-2 py-1 text-xs font-semibold text-text-secondary">
          {territories.length}
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {territories.slice(0, 3).map((territory) => (
          <div key={territory.slug} className="rounded-md bg-bg-tertiary p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-semibold text-text-primary">{territory.name}</span>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${QUARTILE_STYLES[territory.quartile]}`}
              >
                {territory.quartile}
              </span>
            </div>
            <div className="mt-1 text-xs text-text-secondary">{territoryInsight(territory, selectedPeriodLabel)}</div>
          </div>
        ))}
        {territories.length === 0 && <div className="text-sm text-text-secondary">No matching territories.</div>}
      </div>
    </div>
  );
}

function MeetingFocusCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  sub: string;
  icon: React.ElementType;
  tone: "blue" | "green" | "amber" | "red";
}) {
  const tones = {
    blue: "border-nah-blue/20 bg-nah-blue-light text-nah-blue",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    red: "border-red-200 bg-red-50 text-red-700",
  };

  return (
    <div className="rounded-lg border border-border-default bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase text-text-tertiary">{label}</div>
          <div className="mt-2 text-2xl font-bold text-text-primary">{value}</div>
          <div className="mt-1 text-sm text-text-secondary">{sub}</div>
        </div>
        <div className={`rounded-lg border p-2 ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function FlowMetric({
  label,
  value,
  sub,
  highlight,
  suffix = "%",
}: {
  label: string;
  value: number;
  sub: string;
  highlight?: boolean;
  suffix?: string;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        highlight ? "border-nah-blue/25 bg-nah-blue-light" : "border-border-default bg-white"
      }`}
    >
      <div className="text-xs font-semibold uppercase text-text-tertiary">{label}</div>
      <div className="mt-2 text-3xl font-bold text-text-primary">
        {formatNumber(value)}
        {suffix}
      </div>
      <div className="mt-1 text-xs text-text-secondary">{sub}</div>
    </div>
  );
}

function SalesFunnelBoard({ stages }: { stages: { label: string; value: number; sub: string }[] }) {
  return (
    <div className="grid overflow-hidden rounded-lg border border-border-default bg-white shadow-sm sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {stages.map((stage) => (
        <ScoreboardStat key={stage.label} label={stage.label} value={formatNumber(stage.value)} sub={stage.sub} />
      ))}
    </div>
  );
}

function TerritoryRow({ territory, selectedPeriodLabel }: { territory: TerritoryFocus; selectedPeriodLabel: string }) {
  const healthLabel = territory.health == null ? "No EOS score" : `${territory.health}% EOS`;
  const isCritical = territory.purchasesLast30d === 0 || (territory.health != null && territory.health < 60);

  return (
    <Link
      href={`/territories/${territory.slug}`}
      className="grid gap-3 border-b border-border-default px-4 py-3 last:border-0 hover:bg-bg-hover md:grid-cols-[1.2fr_0.9fr_0.9fr_0.9fr_auto]"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold text-text-primary">{territory.name}</span>
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${QUARTILE_STYLES[territory.quartile]}`}
          >
            {territory.quartile} · {territory.score} pts
          </span>
          {isCritical && <AlertTriangle className="h-4 w-4 flex-shrink-0 text-danger" />}
        </div>
        <div className="mt-1 flex items-center gap-1 text-xs text-text-tertiary">
          <MapPin className="h-3 w-3" />
          {territory.region ?? territory.slug}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-nah-blue-light px-2 py-1 text-[11px] font-semibold text-nah-blue">
            {territory.coachingFlag}
          </span>
          <span className="min-w-0 text-xs text-text-secondary">
            {territoryInsight(territory, selectedPeriodLabel)}
          </span>
        </div>
      </div>
      <div>
        <div className="text-sm font-semibold text-text-primary">{formatNumber(territory.leadListInsertedMonth)}</div>
        <div className="text-xs text-text-tertiary">lead-list inserted</div>
      </div>
      <div>
        <div className="text-sm font-semibold text-text-primary">
          {territory.stage1Last30d} <span className="text-text-tertiary">/</span> {territory.stage4Last30d}
        </div>
        <div className="text-xs text-text-tertiary">Stage 1 / Stage 4 · {territory.leadWorkRate}% worked</div>
      </div>
      <div>
        <div className="text-sm font-semibold text-text-primary">
          {territory.purchasesLast30d} <span className="text-text-tertiary">/</span> {territory.purchasesT12}
        </div>
        <div className="text-xs text-text-tertiary">{selectedPeriodLabel} / T12 buys</div>
      </div>
      <div className="flex items-center justify-between gap-3 md:justify-end">
        <span className="rounded-full border border-border-default bg-bg-tertiary px-2 py-1 text-xs text-text-secondary">
          {healthLabel}
        </span>
        <ArrowRight className="h-4 w-4 text-text-tertiary" />
      </div>
    </Link>
  );
}

export default function L10Page() {
  const { user } = useAuth();
  const router = useRouter();
  const [selectedPeriod, setSelectedPeriod] = useState<L10PeriodKey>("T3");
  const [data, setData] = useState<L10Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const allowed = canViewL10(user?.role);

  useEffect(() => {
    if (user && !canViewL10(user.role)) {
      router.push("/daily-hq");
    }
  }, [user, router]);

  useEffect(() => {
    if (!user || !allowed) return;
    setLoading(true);
    setError(null);
    apiFetch(`/api/l10?period=${selectedPeriod}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [user, allowed, selectedPeriod]);

  if (!user || !allowed) return null;

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-nah-blue" />
      </div>
    );
  }

  if (error || !data) {
    return <div className="p-8 text-danger">Failed to load L10 data: {error ?? "Unknown error"}</div>;
  }

  const { coaching } = data;
  const selectedPeriodLabel = periodLabel(data);
  const quartileGroups: Record<TerritoryFocus["quartile"], TerritoryFocus[]> = {
    Q1: coaching.territories.filter((territory) => territory.quartile === "Q1"),
    Q2: coaching.territories.filter((territory) => territory.quartile === "Q2"),
    Q3: coaching.territories.filter((territory) => territory.quartile === "Q3"),
    Q4: coaching.territories.filter((territory) => territory.quartile === "Q4"),
  };
  const desiredSalesStages = ["Engagement", "Qualification", "Discovery", "Compliance", "Awarding", "Closed"];
  const salesStageByName = new Map(data.devSales.stageCounts.map((stage) => [stage.stage, stage.count]));
  const salesStageMetrics = desiredSalesStages.map((label) => ({
    label,
    value: salesStageByName.get(label) ?? 0,
    sub: label === "Closed" ? `closed in ${selectedPeriodLabel}` : `reached in ${selectedPeriodLabel}`,
  }));

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6">
      <div className="flex flex-col gap-3 rounded-lg border border-border-default bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-sm font-semibold text-text-primary">L10 Period</div>
          <div className="mt-1 text-xs text-text-secondary">
            Sales and coaching metrics update together. Use longer windows when the 30-day view is too noisy.
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setSelectedPeriod(option.key)}
              className={`rounded-lg border px-3 py-2 text-left transition ${
                selectedPeriod === option.key
                  ? "border-nah-blue bg-nah-blue-light text-nah-blue"
                  : "border-border-default bg-white text-text-secondary hover:bg-bg-hover"
              }`}
            >
              <div className="text-sm font-bold">{option.label}</div>
              <div className="text-[11px]">{option.sub}</div>
            </button>
          ))}
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <SectionHeader
            title="Franchise Sales"
            sub={`Prospects moving through Path to Ownership in ${selectedPeriodLabel}.`}
          />
          <div className="text-xs text-text-tertiary">Updated {formatRelativeTime(data.generatedAt)}</div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <BigBlueCard
            label="New Prospects"
            value={formatNumber(data.devSales.newProspectsPeriod)}
            detail={`Entered franchise sales in ${selectedPeriodLabel}`}
          />
          <BigBlueCard
            label="New Path to Ownership"
            value={formatNumber(data.devSales.ptoEnrolleesPeriod)}
            detail={`PTO enrollments logged in ${selectedPeriodLabel}`}
          />
          <BigBlueCard
            label="Closed Franchisees"
            value={formatNumber(data.devSales.closedFranchiseesPeriod)}
            detail={`Reached Closed in ${selectedPeriodLabel}`}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <TimingCard
            label="Avg Prospect to Closed"
            value={formatDays(data.devSales.timing.avgProspectToClosedDays)}
            detail={`${formatNumber(data.devSales.timing.prospectToClosedCount)} closed franchisees in ${selectedPeriodLabel}`}
            icon={Clock}
          />
          <TimingCard
            label="Avg Closed to First House"
            value={formatDays(data.devSales.timing.avgClosedToFirstPurchaseDays)}
            detail={`${formatNumber(data.devSales.timing.closedToFirstPurchaseCount)} first purchases in ${selectedPeriodLabel}`}
            icon={Home}
          />
        </div>

        <SalesFunnelBoard stages={salesStageMetrics} />
      </section>

      <section className="space-y-4">
        <SectionHeader title="Coaching" sub={`Territory operating view for ${selectedPeriodLabel}.`} />

        <div className="grid gap-4 md:grid-cols-3">
          <BigBlueCard
            label="Stage 1 Touched"
            value={formatNumber(coaching.stage1Last30d)}
            detail={`Total Stage 1 touches in ${selectedPeriodLabel}`}
          />
          <BigBlueCard
            label="Stage 4 Touched"
            value={formatNumber(coaching.stage4Last30d)}
            detail={`Total Stage 4 touches in ${selectedPeriodLabel}`}
          />
          <BigBlueCard
            label="Purchased"
            value={formatNumber(coaching.purchasesLast30d)}
            detail={`Total purchases in ${selectedPeriodLabel}`}
          />
        </div>

        <div className="grid overflow-hidden rounded-lg border border-border-default bg-white shadow-sm sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <ScoreboardStat
            label="Lead List"
            value={formatNumber(coaching.leadListInsertedMonth)}
            sub="Stage 0 aggregate"
          />
          <ScoreboardStat label="Stage 1" value={formatNumber(coaching.stage1Last30d)} sub={selectedPeriodLabel} />
          <ScoreboardStat label="Stage 3" value={formatNumber(coaching.stage3Last30d)} sub="worked leads" />
          <ScoreboardStat
            label="Stage 4"
            value={formatNumber(coaching.stage4Last30d)}
            sub={`${percent(coaching.stage4Last30d, coaching.stage1Last30d)}% S1 to S4`}
          />
          <ScoreboardStat label="Contracts" value={formatNumber(coaching.contractsLast30d)} sub={selectedPeriodLabel} />
          <ScoreboardStat label="Purchases" value={formatNumber(coaching.purchasesLast30d)} sub={selectedPeriodLabel} />
          <ScoreboardStat label="Royalties Paid" value={formatMoney(coaching.royaltiesPaid)} sub="MasterSuite" />
          <ScoreboardStat label="Royalties Due" value={formatMoney(coaching.royaltiesDue)} sub="MasterSuite" />
        </div>

        <LeadListMixDonut
          rows={coaching.leadListMix}
          total={coaching.leadListInsertedMonth}
          selectedPeriodLabel={selectedPeriodLabel}
        />

        <section className="rounded-lg border border-border-default bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <SectionHeader
              title="Territory Quartile Operating Board"
              sub="The main coaching board: rank, reason, lead-work rate, and next territories to spend time on."
            />
            <div className="text-xs text-text-tertiary">Quartiles are assigned by the scoring agent</div>
          </div>
          <div className="grid gap-4 xl:grid-cols-4">
            {(["Q1", "Q2", "Q3", "Q4"] as const).map((quartile) => (
              <QuartileOperatingColumn
                key={quartile}
                quartile={quartile}
                territories={quartileGroups[quartile]}
                selectedPeriodLabel={selectedPeriodLabel}
              />
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}
