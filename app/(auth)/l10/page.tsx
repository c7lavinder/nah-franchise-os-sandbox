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
  stage4Last30d: number;
  contractsLast30d: number;
  purchasesLast30d: number;
  purchasesT12: number;
  openIssues: number;
  openTodos: number;
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
    stage4Last30d: number;
    contractsLast30d: number;
    purchasesLast30d: number;
    medianPurchasesT12: number | null;
    highPerformersT12: number;
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
          {isCritical && <AlertTriangle className="h-4 w-4 flex-shrink-0 text-danger" />}
        </div>
        <div className="mt-1 flex items-center gap-1 text-xs text-text-tertiary">
          <MapPin className="h-3 w-3" />
          {territory.region ?? territory.slug}
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
        <div className="text-xs text-text-tertiary">Stage 1 / Stage 4</div>
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

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="grid gap-4 md:grid-cols-3">
        <HeaderCard
          label="Business View"
          value={coaching.activeTerritories}
          detail="Active territories in the company-wide coaching and development view."
          icon={Users}
          tone="blue"
        />
        <HeaderCard
          label="Dev Cadence"
          value="Biweekly"
          detail={`${devSales.activeProspects} active prospects, ${devSales.stalledProspects} stalled long enough to inspect.`}
          icon={TrendingUp}
          tone="green"
        />
        <HeaderCard
          label="Coaching Cadence"
          value="Weekly"
          detail={`${coaching.purchasesLast30d} purchases in the last 30 days, ${coaching.highPerformersT12} high performers T12.`}
          icon={Target}
          tone="amber"
        />
      </div>

      <section className="rounded-lg border border-border-default bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <SectionHeader
            title="Numerical Snapshot"
            sub="Team-wide numbers first. Benchmarks stay light here until the full-business targets are decided."
          />
          <div className="text-xs text-text-tertiary">Updated {formatRelativeTime(data.generatedAt)}</div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricTile
            label="Lead List Inserted"
            value={formatNumber(coaching.leadListInsertedMonth)}
            sub="current month, aggregate table"
            icon={BarChart3}
          />
          <MetricTile
            label="Stage 1 Leads"
            value={formatNumber(coaching.stage1Last30d)}
            sub="last 30 days"
            icon={CircleDot}
          />
          <MetricTile
            label="Stage 4 Offers"
            value={formatNumber(coaching.stage4Last30d)}
            sub="last 30 days"
            icon={Target}
          />
          <MetricTile
            label="Purchases"
            value={formatNumber(coaching.purchasesLast30d)}
            sub="last 30 days"
            icon={CheckCircle2}
          />
          <MetricTile
            label="Contracts"
            value={formatNumber(coaching.contractsLast30d)}
            sub="last 30 days"
            icon={Clock3}
          />
          <MetricTile
            label="Median T12 Buys"
            value={formatNumber(coaching.medianPurchasesT12)}
            sub="across active territories"
            icon={BarChart3}
          />
          <MetricTile
            label="EOS Health"
            value={operatingHealth.avgScorecardHealth == null ? "-" : `${operatingHealth.avgScorecardHealth}%`}
            sub="average scorecard health"
            icon={CheckCircle2}
          />
          <MetricTile
            label="Open Issues"
            value={formatNumber(operatingHealth.openIssues)}
            sub={`${operatingHealth.openTodos} open todos`}
            icon={AlertTriangle}
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-lg border border-border-default bg-white p-5 shadow-sm">
          <SectionHeader
            title="Dev Sales Journey"
            sub="Biweekly view of prospects moving through the franchise sales path."
          />
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
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <MetricTile label="New" value={devSales.newProspects14d} sub="last 14 days" icon={Users} />
            <MetricTile label="Moved" value={devSales.moved14d} sub="stage movement" icon={TrendingUp} />
            <MetricTile label="Stalled" value={devSales.stalledProspects} sub="needs review" icon={AlertTriangle} />
          </div>
        </section>

        <section className="rounded-lg border border-border-default bg-white shadow-sm">
          <div className="border-b border-border-default p-5">
            <SectionHeader
              title="Internal Focus"
              sub="People or ownership buckets where stalled work should get attention."
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

      <section className="rounded-lg border border-border-default bg-white shadow-sm">
        <div className="border-b border-border-default p-5">
          <SectionHeader
            title="Coaching Journey Focus"
            sub="Weekly John and Erin view: prolonged issues, underperformance, and who needs attention."
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
            title="Where There Is Possibility"
            sub="Territories with activity or lead-list volume that may convert with focused coaching."
          />
        </div>
        <div className="divide-y divide-border-default">
          {coaching.opportunityTerritories.map((territory) => (
            <TerritoryRow key={territory.slug} territory={territory} />
          ))}
          {coaching.opportunityTerritories.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-text-secondary">
              No opportunity territories found yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
