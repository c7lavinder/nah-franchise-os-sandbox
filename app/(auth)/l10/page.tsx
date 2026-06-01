"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CircleDot,
  Clock3,
  Loader2,
  MapPin,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { apiFetch } from "@/lib/auth/api-fetch";

interface StageCount {
  stage: string;
  count: number;
}

interface RepFocus {
  name: string;
  stalled: number;
}

interface TerritoryFocus {
  slug: string;
  name: string;
  region: string | null;
  health: number | null;
  leadListInsertedMonth: number;
  stage1Last30d: number;
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
  devSales: {
    activeProspects: number;
    newProspects14d: number;
    moved14d: number;
    stalledProspects: number;
    stageCounts: StageCount[];
    repsToFocus: RepFocus[];
  };
  coaching: {
    activeTerritories: number;
    leadListInsertedMonth: number;
    stage1Last30d: number;
    stage3Last30d: number;
    stage4Last30d: number;
    contractsLast30d: number;
    purchasesLast30d: number;
    medianPurchasesT12: number | null;
    highPerformersT12: number;
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

function formatNumber(value: number | null | undefined) {
  if (value == null) return "-";
  return value.toLocaleString();
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

function ScoreboardStat({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="min-w-0 border-r border-border-default px-4 py-3 last:border-r-0">
      <div className="text-xs font-semibold uppercase text-text-tertiary">{label}</div>
      <div className="mt-1 text-xl font-bold text-text-primary">{value}</div>
      <div className="mt-0.5 truncate text-xs text-text-secondary">{sub}</div>
    </div>
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const width = max > 0 ? Math.max(5, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 rounded-full bg-slate-100">
      <div className="h-2 rounded-full bg-nah-blue" style={{ width: `${width}%` }} />
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
  direction: "higher" | "lower";
  getValue: (territory: TerritoryFocus) => number;
  format?: (value: number) => string;
};

const QUARTILE_BOXES: QuartileBox[] = [
  {
    label: "Lead List Inserted",
    sub: "Are they feeding the postcard / lead-mining machine?",
    valueLabel: "records",
    direction: "higher",
    getValue: (t) => t.leadListInsertedMonth,
  },
  {
    label: "Stage 1 Leads",
    sub: "Are lead-list and marketing activities creating real seller leads?",
    valueLabel: "leads",
    direction: "higher",
    getValue: (t) => t.stage1Last30d,
  },
  {
    label: "Stage 3 Worked",
    sub: "Are new leads getting worked far enough to become real opportunities?",
    valueLabel: "worked",
    direction: "higher",
    getValue: (t) => t.stage3Last30d,
  },
  {
    label: "Stage 4 Offers",
    sub: "Are they actually working leads far enough to make offers?",
    valueLabel: "offers",
    direction: "higher",
    getValue: (t) => t.stage4Last30d,
  },
  {
    label: "Lead Work Rate",
    sub: "How much Stage 1 activity is reaching worked/offer stages?",
    valueLabel: "worked",
    direction: "higher",
    getValue: (t) => t.leadWorkRate,
    format: (value) => `${value}%`,
  },
  {
    label: "Contracts",
    sub: "Are offers turning into signed purchase contracts?",
    valueLabel: "contracts",
    direction: "higher",
    getValue: (t) => t.contractsLast30d,
  },
  {
    label: "Purchases",
    sub: "Who is converting activity into bought houses?",
    valueLabel: "purchases",
    direction: "higher",
    getValue: (t) => t.purchasesLast30d,
  },
  {
    label: "T12 Buying",
    sub: "Longer-term buying momentum across active territories.",
    valueLabel: "T12 buys",
    direction: "higher",
    getValue: (t) => t.purchasesT12,
  },
];

function QuartileCard({ box, territories }: { box: QuartileBox; territories: TerritoryFocus[] }) {
  const sorted = [...territories].sort((a, b) => {
    const diff = box.getValue(b) - box.getValue(a);
    return box.direction === "higher" ? diff : -diff;
  });
  const quartileSize = Math.max(1, Math.ceil(sorted.length / 4));
  const top = sorted.slice(0, quartileSize);
  const spendTime = sorted.slice(-quartileSize).reverse();
  const topMedian = top.length > 0 ? Math.round(top.reduce((sum, t) => sum + box.getValue(t), 0) / top.length) : 0;
  const focusMedian =
    spendTime.length > 0 ? Math.round(spendTime.reduce((sum, t) => sum + box.getValue(t), 0) / spendTime.length) : 0;
  const fmt = box.format ?? ((value: number) => formatNumber(value));

  return (
    <div className="rounded-lg border border-border-default bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-card-title text-text-primary">{box.label}</h3>
          <p className="mt-1 text-xs text-text-secondary">{box.sub}</p>
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
          <div className="text-xs font-semibold uppercase text-amber-700">Spend Time</div>
          <div className="mt-1 text-xl font-bold text-amber-900">{fmt(focusMedian)}</div>
          <div className="text-xs text-amber-700">{box.valueLabel}</div>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {spendTime.slice(0, 4).map((territory) => (
          <a
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
              <span className="text-sm font-semibold text-text-secondary">{fmt(box.getValue(territory))}</span>
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

function CompactTerritoryRow({ territory }: { territory: TerritoryFocus }) {
  return (
    <a
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
      <div className="mt-2 line-clamp-2 text-xs text-text-secondary">{territory.coachingReason}</div>
    </a>
  );
}

function QuartileOperatingColumn({
  quartile,
  territories,
}: {
  quartile: TerritoryFocus["quartile"];
  territories: TerritoryFocus[];
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
        {sorted.slice(0, 6).map((territory) => (
          <CompactTerritoryRow key={territory.slug} territory={territory} />
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

function AgendaBlock({ time, title, territories }: { time: string; title: string; territories: TerritoryFocus[] }) {
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
            <div className="mt-1 text-xs text-text-secondary">{territory.coachingReason}</div>
          </div>
        ))}
        {territories.length === 0 && <div className="text-sm text-text-secondary">No matching territories.</div>}
      </div>
    </div>
  );
}

function TerritoryRow({ territory }: { territory: TerritoryFocus }) {
  const healthLabel = territory.health == null ? "No EOS score" : `${territory.health}% EOS`;
  const isCritical = territory.purchasesLast30d === 0 || (territory.health != null && territory.health < 60);

  return (
    <a
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
          <span className="min-w-0 text-xs text-text-secondary">{territory.coachingReason}</span>
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
        <div className="text-xs text-text-tertiary">30d / T12 buys</div>
      </div>
      <div className="flex items-center justify-between gap-3 md:justify-end">
        <span className="rounded-full border border-border-default bg-bg-tertiary px-2 py-1 text-xs text-text-secondary">
          {healthLabel}
        </span>
        <ArrowRight className="h-4 w-4 text-text-tertiary" />
      </div>
    </a>
  );
}

export default function L10Page() {
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<L10Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.role !== "admin") {
      router.push("/daily-hq");
    }
  }, [user, router]);

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    apiFetch("/api/l10")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [user]);

  const maxSalesStage = useMemo(() => Math.max(...(data?.devSales.stageCounts.map((s) => s.count) ?? [1]), 1), [data]);

  if (!user || user.role !== "admin") return null;

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

  const { devSales, coaching, operatingHealth } = data;
  const quartileGroups: Record<TerritoryFocus["quartile"], TerritoryFocus[]> = {
    Q1: coaching.territories.filter((territory) => territory.quartile === "Q1"),
    Q2: coaching.territories.filter((territory) => territory.quartile === "Q2"),
    Q3: coaching.territories.filter((territory) => territory.quartile === "Q3"),
    Q4: coaching.territories.filter((territory) => territory.quartile === "Q4"),
  };
  const rankedTerritories = [...coaching.territories].sort((a, b) => a.rank - b.rank);
  const q4Urgent = [...quartileGroups.Q4].sort((a, b) => b.rank - a.rank);
  const leadGenGaps = rankedTerritories.filter((territory) => territory.coachingFlag === "Lead Gen Gap");
  const notWorkingLeads = rankedTerritories.filter((territory) => territory.coachingFlag === "Not Working Leads");
  const moveUpCandidates = [...coaching.opportunityTerritories]
    .filter((territory) => territory.quartile === "Q2" || territory.quartile === "Q3")
    .sort((a, b) => b.score - a.score || a.rank - b.rank);
  const attentionSlugs = new Set([...q4Urgent, ...leadGenGaps, ...notWorkingLeads].map((territory) => territory.slug));
  const stage1ToOfferRate = percent(coaching.stage4Last30d, coaching.stage1Last30d);

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6">
      <section className="space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <SectionHeader title="Sales" sub="Biweekly FranDev sales operating view." />
          <div className="text-xs text-text-tertiary">Updated {formatRelativeTime(data.generatedAt)}</div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <HeaderCard
            label="Active Prospects"
            value={devSales.activeProspects}
            detail={`${devSales.newProspects14d} new prospects in the last 14 days.`}
            icon={Users}
            tone="blue"
          />
          <HeaderCard
            label="Stage Movement"
            value={devSales.moved14d}
            detail="Prospects that advanced through the sales pipeline in the last 14 days."
            icon={TrendingUp}
            tone="green"
          />
          <HeaderCard
            label="Stalled"
            value={devSales.stalledProspects}
            detail="Prospects old enough to inspect in the biweekly sales meeting."
            icon={AlertTriangle}
            tone="amber"
          />
        </div>
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-lg border border-border-default bg-white p-5 shadow-sm">
            <SectionHeader title="Sales Journey" sub="Pipeline shape for the franchise development sales path." />
            <div className="mt-5 space-y-4">
              {devSales.stageCounts.map((stage) => (
                <div key={stage.stage}>
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-medium text-text-primary">{stage.stage}</span>
                    <span className="font-semibold text-text-primary">{stage.count}</span>
                  </div>
                  <ProgressBar value={stage.count} max={maxSalesStage} />
                </div>
              ))}
              {devSales.stageCounts.length === 0 && (
                <div className="rounded-lg border border-border-default bg-bg-tertiary p-4 text-sm text-text-secondary">
                  No active sales-stage data is available yet.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-border-default bg-white shadow-sm">
            <div className="border-b border-border-default p-5">
              <SectionHeader
                title="Sales Attention"
                sub="People or ownership buckets where stalled work should get time."
              />
            </div>
            <div className="divide-y divide-border-default">
              {devSales.repsToFocus.map((rep) => (
                <div key={rep.name} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div>
                    <div className="font-semibold text-text-primary">{rep.name}</div>
                    <div className="text-sm text-text-secondary">Stalled prospects assigned here</div>
                  </div>
                  <div className="rounded-lg bg-amber-50 px-3 py-2 text-lg font-bold text-amber-700">{rep.stalled}</div>
                </div>
              ))}
              {devSales.repsToFocus.length === 0 && (
                <div className="px-5 py-8 text-center text-sm text-text-secondary">
                  No stalled rep focus buckets right now.
                </div>
              )}
            </div>
          </section>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader title="Coaching" sub="Weekly territory operating view for John, Erin, and Chad." />
        <div className="grid gap-4 md:grid-cols-3">
          <HeaderCard
            label="Network Lead Gen Health"
            value={formatNumber(coaching.leadListInsertedMonth)}
            detail={`${coaching.stage1Last30d} Stage 1 leads from current lead generation and marketing work.`}
            icon={BarChart3}
            tone="blue"
          />
          <HeaderCard
            label="Buying Momentum"
            value={formatNumber(coaching.purchasesLast30d)}
            detail={`${coaching.contractsLast30d} contracts, ${coaching.highPerformersT12} T12 high-performing territories tracked.`}
            icon={CheckCircle2}
            tone="green"
          />
          <HeaderCard
            label="Coaching Attention"
            value={attentionSlugs.size}
            detail={`${quartileGroups.Q4.length} Q4 territories plus lead-gen and lead-work gaps.`}
            icon={Target}
            tone="amber"
          />
        </div>

        <div className="grid overflow-hidden rounded-lg border border-border-default bg-white shadow-sm sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <ScoreboardStat label="Lead List" value={formatNumber(coaching.leadListInsertedMonth)} sub="current month" />
          <ScoreboardStat label="Stage 1" value={formatNumber(coaching.stage1Last30d)} sub="last 30 days" />
          <ScoreboardStat label="Stage 3" value={formatNumber(coaching.stage3Last30d)} sub="worked leads" />
          <ScoreboardStat
            label="Stage 4"
            value={formatNumber(coaching.stage4Last30d)}
            sub={`${stage1ToOfferRate}% S1 to S4`}
          />
          <ScoreboardStat label="Contracts" value={formatNumber(coaching.contractsLast30d)} sub="last 30 days" />
          <ScoreboardStat label="Purchases" value={formatNumber(coaching.purchasesLast30d)} sub="last 30 days" />
          <ScoreboardStat label="Active" value={formatNumber(coaching.activeTerritories)} sub="territories" />
          <ScoreboardStat label="Q4" value={formatNumber(quartileGroups.Q4.length)} sub="immediate action" />
        </div>

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
              <QuartileOperatingColumn key={quartile} quartile={quartile} territories={quartileGroups[quartile]} />
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeader title="Coaching Agenda" sub="Suggested weekly meeting flow from the quartile agent." />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AgendaBlock time="First 10" title="Q4 urgent territories" territories={q4Urgent} />
            <AgendaBlock time="Next 10" title="Lead gen gaps" territories={leadGenGaps} />
            <AgendaBlock time="Next 10" title="Leads not worked" territories={notWorkingLeads} />
            <AgendaBlock time="Final 10" title="Move-up candidates" territories={moveUpCandidates} />
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeader
            title="Diagnostic Boxes"
            sub="The eight-box coaching detail stays below the board for metric-specific inspection."
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {QUARTILE_BOXES.map((box) => (
              <QuartileCard key={box.label} box={box} territories={coaching.territories} />
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-border-default bg-white shadow-sm">
          <div className="border-b border-border-default p-5">
            <SectionHeader
              title="Detailed Coaching Focus"
              sub="Prolonged issues, underperformance, and specific reasons to spend time."
            />
          </div>
          <div className="divide-y divide-border-default">
            {coaching.focusTerritories.map((territory) => (
              <TerritoryRow key={territory.slug} territory={territory} />
            ))}
            {coaching.focusTerritories.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-text-secondary">
                No coaching focus territories found.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-border-default bg-white shadow-sm">
          <div className="border-b border-border-default p-5">
            <SectionHeader
              title="Move-Up Candidates"
              sub="Territories with enough activity to move up fastest with focused coaching."
            />
          </div>
          <div className="divide-y divide-border-default">
            {moveUpCandidates.slice(0, 8).map((territory) => (
              <TerritoryRow key={territory.slug} territory={territory} />
            ))}
            {moveUpCandidates.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-text-secondary">No move-up candidates found yet.</div>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-border-default bg-white p-5 shadow-sm">
          <SectionHeader
            title="Operating Health"
            sub="EOS context stays supportive so it does not overpower the coaching score."
          />
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricTile
              label="EOS Health"
              value={operatingHealth.avgScorecardHealth == null ? "-" : `${operatingHealth.avgScorecardHealth}%`}
              sub="average scorecard health"
              icon={CheckCircle2}
            />
            <MetricTile
              label="Open Issues"
              value={formatNumber(operatingHealth.openIssues)}
              sub="context, not heavy penalty"
              icon={AlertTriangle}
            />
            <MetricTile
              label="Open Todos"
              value={formatNumber(operatingHealth.openTodos)}
              sub="active follow-through"
              icon={Clock3}
            />
            <MetricTile
              label="Rocks"
              value={`${operatingHealth.rocksOnTrack}/${operatingHealth.rocksOffTrack}`}
              sub="on track / off track"
              icon={Target}
            />
          </div>
        </section>
      </section>
    </div>
  );
}
