"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  CircleDot,
  Gauge,
  Home,
  Loader2,
  RefreshCw,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { apiFetch } from "@/lib/auth/api-fetch";

interface SalesStageTotal {
  stage: string;
  count: number;
}

interface FocusRep {
  userId: string;
  name: string;
  activeProspects: number;
  newProspects: number;
  stageAdvances: number;
  stalledProspects: number;
}

interface TerritoryRow {
  slug: string;
  nickname: string;
  region: string | null;
  owners: string[];
  leadListInserted: number;
  stage1: number;
  stage4: number;
  purchases: number;
  stage1Target: number;
  stage4Target: number;
  purchaseTarget: number;
  stage1Pace: number;
  stage4Pace: number;
  purchasePace: number;
  focusReason: string;
}

interface L10Data {
  cadences: {
    dev: { label: string; cadence: string; days: number };
    coaching: { label: string; cadence: string; days: number; coaches: string[] };
  };
  sales: {
    periodLabel: string;
    activeProspects: number;
    newProspects: number;
    stageAdvances: number;
    stalledProspects: number;
    stageTotals: SalesStageTotal[];
    focusReps: FocusRep[];
  };
  coaching: {
    periodLabel: string;
    weeklyLabel: string;
    activeTerritories: number;
    leadListInserted: number;
    stage1: number;
    stage4: number;
    purchases: number;
    medianStage1: number;
    medianStage4: number;
    medianPurchases: number;
    stage1Target: number;
    stage4Target: number;
    purchaseTarget: number;
    focusTerritories: TerritoryRow[];
  };
  territories: TerritoryRow[];
  generatedAt: string;
}

function compact(value: number): string {
  return value.toLocaleString();
}

function paceTone(pace: number): string {
  if (pace >= 100) return "text-success";
  if (pace >= 70) return "text-warning";
  return "text-danger";
}

function barTone(pace: number): string {
  if (pace >= 100) return "bg-success";
  if (pace >= 70) return "bg-warning";
  return "bg-danger";
}

function formatRefresh(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Updated just now";
  return `Updated ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

function HeaderCard({
  icon: Icon,
  label,
  value,
  sub,
  tone = "blue",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  tone?: "blue" | "green" | "amber";
}) {
  const colors = {
    blue: "bg-nah-blue/10 text-nah-blue",
    green: "bg-success/10 text-success",
    amber: "bg-warning/10 text-warning",
  };

  return (
    <div className="rounded-lg border border-border-default bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-label-caps text-text-tertiary">{label}</p>
          <p className="mt-2 text-[30px] font-bold leading-none text-text-primary">{value}</p>
          <p className="mt-2 text-caption text-text-secondary">{sub}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${colors[tone]}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

function SectionShell({
  title,
  label,
  children,
  action,
}: {
  title: string;
  label: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border-default bg-white shadow-sm">
      <div className="flex flex-col gap-2 border-b border-border-default px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-label-caps text-nah-blue">{label}</p>
          <h2 className="mt-1 text-card-title text-text-primary">{title}</h2>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function MiniMetric({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-lg border border-border-default bg-bg-secondary p-4">
      <div className="flex items-center gap-2 text-caption font-semibold text-text-secondary">
        <Icon size={15} className="text-nah-blue" />
        {label}
      </div>
      <p className="mt-3 text-2xl font-bold leading-none text-text-primary">{value}</p>
      <p className="mt-1 text-caption text-text-tertiary">{sub}</p>
    </div>
  );
}

function SalesFunnel({ stages }: { stages: SalesStageTotal[] }) {
  const max = Math.max(...stages.map((s) => s.count), 1);

  if (stages.length === 0) {
    return <p className="py-10 text-center text-body-sm text-text-tertiary">No active sales pipeline data.</p>;
  }

  return (
    <div className="space-y-3">
      {stages.map((stage, index) => {
        const width = Math.max((stage.count / max) * 100, stage.count > 0 ? 2 : 0);
        const color = index < 2 ? "bg-nah-blue" : index < 4 ? "bg-warning" : "bg-success";
        return (
          <div key={stage.stage} className="grid grid-cols-[minmax(96px,140px)_minmax(0,1fr)_52px] items-center gap-3">
            <span className="truncate text-body-sm font-semibold text-text-primary">{stage.stage}</span>
            <div className="h-8 overflow-hidden rounded-md bg-bg-tertiary">
              <div className={`h-full rounded-md ${color}`} style={{ width: `${width}%` }} />
            </div>
            <span className="text-right text-body-sm font-bold text-text-primary">{compact(stage.count)}</span>
          </div>
        );
      })}
    </div>
  );
}

function FocusRepList({ reps }: { reps: FocusRep[] }) {
  if (reps.length === 0) {
    return <p className="py-8 text-center text-body-sm text-text-tertiary">No rep focus items right now.</p>;
  }

  return (
    <div className="space-y-2">
      {reps.map((rep) => (
        <div key={rep.userId} className="rounded-lg border border-border-default bg-bg-secondary px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-body-sm font-semibold text-text-primary">{rep.name}</p>
              <p className="mt-1 text-caption text-text-tertiary">
                {rep.activeProspects} active prospects · {rep.stageAdvances} advances
              </p>
            </div>
            <div className="text-right">
              <p
                className={`text-lg font-bold leading-none ${rep.stalledProspects > 0 ? "text-danger" : "text-success"}`}
              >
                {rep.stalledProspects}
              </p>
              <p className="mt-1 text-[11px] font-semibold uppercase text-text-tertiary">stalled</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function PaceBar({ label, actual, target }: { label: string; actual: number; target: number }) {
  const pace = target > 0 ? Math.round((actual / target) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-caption font-semibold text-text-primary">{label}</span>
        <span className={`text-caption font-bold ${paceTone(pace)}`}>
          {compact(actual)} / {compact(target)}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-bg-tertiary">
        <div className={`h-full rounded-full ${barTone(pace)}`} style={{ width: `${Math.min(pace, 100)}%` }} />
      </div>
    </div>
  );
}

function TerritoryFocus({ territories }: { territories: TerritoryRow[] }) {
  if (territories.length === 0) {
    return (
      <div className="rounded-lg border border-success/20 bg-success/10 p-4 text-body-sm font-medium text-success">
        Every tracked territory is at or above the current focus thresholds.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {territories.map((territory) => (
        <Link
          key={territory.slug}
          href={`/territories/${territory.slug}`}
          className="block rounded-lg border border-border-default bg-bg-secondary p-4 transition-colors hover:border-nah-blue/40 hover:bg-bg-hover"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-body-sm font-semibold text-text-primary">{territory.nickname}</p>
              <p className="mt-1 truncate text-caption text-text-tertiary">
                {territory.owners.length > 0 ? territory.owners.join(", ") : "No owner mapped"}
              </p>
            </div>
            <span className="rounded-full bg-danger/10 px-2.5 py-1 text-[11px] font-bold uppercase text-danger">
              {territory.focusReason}
            </span>
          </div>
          <div className="mt-4 grid gap-3">
            <PaceBar label="Stage 1 true leads" actual={territory.stage1} target={territory.stage1Target} />
            <PaceBar label="Stage 4 offers" actual={territory.stage4} target={territory.stage4Target} />
            <PaceBar label="Purchases" actual={territory.purchases} target={territory.purchaseTarget} />
          </div>
        </Link>
      ))}
    </div>
  );
}

function BenchmarkTable({ data }: { data: L10Data["coaching"] }) {
  const rows = [
    {
      label: "Lead-list inserted",
      actual: data.leadListInserted,
      median: null,
      benchmark: null,
      note: "Stage 0 aggregate",
    },
    {
      label: "Stage 1 true leads",
      actual: data.stage1,
      median: data.medianStage1,
      benchmark: data.stage1Target,
      note: "per territory target",
    },
    {
      label: "Stage 4 offers",
      actual: data.stage4,
      median: data.medianStage4,
      benchmark: data.stage4Target,
      note: "per territory target",
    },
    {
      label: "Purchases",
      actual: data.purchases,
      median: data.medianPurchases,
      benchmark: data.purchaseTarget,
      note: "per territory target",
    },
  ];

  return (
    <div className="overflow-hidden rounded-lg border border-border-default">
      <table className="w-full text-left text-body-sm">
        <thead className="bg-bg-secondary text-caption font-semibold text-text-tertiary">
          <tr>
            <th className="px-4 py-3">Metric</th>
            <th className="px-4 py-3 text-right">Network</th>
            <th className="px-4 py-3 text-right">Median</th>
            <th className="px-4 py-3 text-right">Benchmark</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-default">
          {rows.map((row) => (
            <tr key={row.label} className="bg-white">
              <td className="px-4 py-3">
                <p className="font-semibold text-text-primary">{row.label}</p>
                <p className="text-caption text-text-tertiary">{row.note}</p>
              </td>
              <td className="px-4 py-3 text-right font-bold text-text-primary">{compact(row.actual)}</td>
              <td className="px-4 py-3 text-right text-text-secondary">
                {row.median == null ? "—" : compact(row.median)}
              </td>
              <td className="px-4 py-3 text-right text-text-secondary">
                {row.benchmark == null ? "—" : compact(row.benchmark)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TerritoryTable({ territories }: { territories: TerritoryRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border-default">
      <table className="w-full text-left text-body-sm">
        <thead className="bg-bg-secondary text-caption font-semibold text-text-tertiary">
          <tr>
            <th className="px-4 py-3">Territory</th>
            <th className="px-4 py-3">Owner</th>
            <th className="px-4 py-3 text-right">Lead list</th>
            <th className="px-4 py-3 text-right">S1</th>
            <th className="px-4 py-3 text-right">S4</th>
            <th className="px-4 py-3 text-right">Buy</th>
            <th className="px-4 py-3">Focus</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-default bg-white">
          {territories.slice(0, 20).map((territory) => (
            <tr key={territory.slug} className="hover:bg-bg-hover">
              <td className="px-4 py-3">
                <Link
                  href={`/territories/${territory.slug}`}
                  className="font-semibold text-text-primary hover:text-nah-blue"
                >
                  {territory.nickname}
                </Link>
              </td>
              <td className="max-w-[180px] truncate px-4 py-3 text-text-secondary">
                {territory.owners.length > 0 ? territory.owners.join(", ") : "—"}
              </td>
              <td className="px-4 py-3 text-right font-semibold text-text-primary">
                {compact(territory.leadListInserted)}
              </td>
              <td className={`px-4 py-3 text-right font-semibold ${paceTone(territory.stage1Pace)}`}>
                {compact(territory.stage1)}
              </td>
              <td className={`px-4 py-3 text-right font-semibold ${paceTone(territory.stage4Pace)}`}>
                {compact(territory.stage4)}
              </td>
              <td className={`px-4 py-3 text-right font-semibold ${paceTone(territory.purchasePace)}`}>
                {compact(territory.purchases)}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ${
                    territory.focusReason === "On track" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                  }`}
                >
                  {territory.focusReason}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
        if (!r.ok) throw new Error(`Request failed: ${r.status}`);
        return r.json();
      })
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [user]);

  if (!user || user.role !== "admin") return null;

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-nah-blue" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-danger/20 bg-danger/10 p-5 text-danger">Failed to load L10 data.</div>
    );
  }

  const sortedTerritories = [...data.territories].sort((a, b) => {
    if (a.focusReason === "On track" && b.focusReason !== "On track") return 1;
    if (a.focusReason !== "On track" && b.focusReason === "On track") return -1;
    return a.nickname.localeCompare(b.nickname);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border-default bg-white px-3 py-1.5 text-caption font-semibold text-text-secondary">
            <RefreshCw size={13} className="text-nah-blue" />
            {formatRefresh(data.generatedAt)}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border-default bg-white px-3 py-1.5 text-caption font-semibold text-text-secondary">
            <CircleDot size={13} className="text-success" />
            {data.coaching.weeklyLabel}
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <HeaderCard
          icon={TrendingUp}
          label="Dev"
          value={data.cadences.dev.cadence}
          sub={`${data.sales.periodLabel}: ${compact(data.sales.stageAdvances)} stage advances`}
        />
        <HeaderCard
          icon={Users}
          label="Coaching"
          value={data.cadences.coaching.cadence}
          sub={`${data.coaching.activeTerritories} active territories · John and Erin`}
          tone="green"
        />
        <HeaderCard
          icon={Home}
          label="Buying Target"
          value={`${compact(data.coaching.purchases)}`}
          sub={`Network purchases this month · target is 1 per territory`}
          tone={data.coaching.purchases >= data.coaching.activeTerritories ? "green" : "amber"}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
        <SectionShell
          label="FranDev Sales"
          title="Biweekly sales operating view"
          action={
            <span className="rounded-full bg-nah-blue/10 px-3 py-1 text-caption font-semibold text-nah-blue">
              Chad requested
            </span>
          }
        >
          <div className="grid gap-4 sm:grid-cols-4">
            <MiniMetric
              icon={Users}
              label="Active Prospects"
              value={compact(data.sales.activeProspects)}
              sub="in sales pipeline"
            />
            <MiniMetric
              icon={TrendingUp}
              label="New Prospects"
              value={compact(data.sales.newProspects)}
              sub={data.sales.periodLabel}
            />
            <MiniMetric
              icon={ArrowUpRight}
              label="Stage Advances"
              value={compact(data.sales.stageAdvances)}
              sub={data.sales.periodLabel}
            />
            <MiniMetric
              icon={AlertTriangle}
              label="Stalled"
              value={compact(data.sales.stalledProspects)}
              sub="7+ days no stage move"
            />
          </div>
          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <BarChart3 size={17} className="text-nah-blue" />
                <h3 className="text-body-sm font-semibold text-text-primary">Prospect pipeline shape</h3>
              </div>
              <SalesFunnel stages={data.sales.stageTotals} />
            </div>
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Gauge size={17} className="text-warning" />
                <h3 className="text-body-sm font-semibold text-text-primary">People to focus on</h3>
              </div>
              <FocusRepList reps={data.sales.focusReps} />
            </div>
          </div>
        </SectionShell>

        <SectionShell label="Coaching" title="Weekly MasterSuite metrics">
          <div className="grid gap-4 sm:grid-cols-2">
            <MiniMetric
              icon={Target}
              label="Lead List Inserted"
              value={compact(data.coaching.leadListInserted)}
              sub="Stage 0 aggregate this month"
            />
            <MiniMetric
              icon={CheckCircle2}
              label="Stage 1 True Leads"
              value={compact(data.coaching.stage1)}
              sub={`${compact(data.coaching.stage1Target)} per territory target`}
            />
            <MiniMetric
              icon={ArrowUpRight}
              label="Stage 4 Offers"
              value={compact(data.coaching.stage4)}
              sub={`${compact(data.coaching.stage4Target)} per territory target`}
            />
            <MiniMetric
              icon={Home}
              label="Purchases"
              value={compact(data.coaching.purchases)}
              sub={`${compact(data.coaching.purchaseTarget)} per territory target`}
            />
          </div>
          <div className="mt-5">
            <BenchmarkTable data={data.coaching} />
          </div>
        </SectionShell>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(360px,0.95fr)_minmax(0,1.05fr)]">
        <SectionShell label="Coaching Focus" title="Territories to talk about first">
          <TerritoryFocus territories={data.coaching.focusTerritories} />
        </SectionShell>

        <SectionShell label="Network Detail" title="Territory metric board">
          <TerritoryTable territories={sortedTerritories} />
        </SectionShell>
      </div>
    </div>
  );
}
