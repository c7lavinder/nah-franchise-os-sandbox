"use client";
import { apiFetch } from "@/lib/auth/api-fetch";
import { useState, useEffect } from "react";
import { Loader2, TrendingUp, Home, DollarSign, Clock, Target, Hammer } from "lucide-react";

interface KPIs {
  totalProperties: number;
  activeDeals: number;
  purchasedYTD: number;
  soldYTD: number;
  soldAllTime: number;
  totalProfit: number;
  avgProfit: number;
  avgInventoryValue: number;
  medianCycleDays: number | null;
  leadsT3: number;
  conversionRate: number | null;
}

interface ConstructionEos {
  rocks: Array<{ Id: number; Rock: string | null; Status: string | null }>;
  todos: Array<{ Id: number; Todo: string | null; Done: boolean }>;
  issues: Array<{ Id: number; Issue: string | null; Done: boolean }>;
  habits: Record<string, string | null> | null;
}

interface PerformanceData {
  funnel: Record<string, number>;
  kpis: KPIs;
  constructionEos: ConstructionEos;
}

function Stat({
  label,
  value,
  icon: Icon,
  sub,
}: {
  label: string;
  value: string | number;
  icon?: React.ElementType;
  sub?: string;
}) {
  return (
    <div className="bg-bg-secondary rounded-lg p-3">
      <div className="flex items-center gap-1.5 text-caption text-text-tertiary mb-1">
        {Icon && <Icon size={12} />}
        {label}
      </div>
      <div className="text-lg font-bold text-text-primary">{value}</div>
      {sub && <div className="text-caption text-text-tertiary">{sub}</div>}
    </div>
  );
}

const FUNNEL_STAGES = [
  { key: "1", label: "Stage 1", color: "bg-blue-400" },
  { key: "2", label: "Stage 2", color: "bg-blue-500" },
  { key: "3", label: "Stage 3", color: "bg-indigo-500" },
  { key: "4", label: "Stage 4", color: "bg-purple-500" },
  { key: "5 Contract", label: "Contract", color: "bg-orange-500" },
  { key: "6 Purchase", label: "Purchased", color: "bg-green-500" },
];

const DEAD_STAGES = [
  { key: "0 No Offer", label: "No Offer" },
  { key: "0 No Deal", label: "No Deal" },
  { key: "0 Unresponsive", label: "Unresponsive" },
  { key: "0 Sell Later", label: "Sell Later" },
  { key: "0 Trash", label: "Trash" },
];

const HABIT_LABELS: Record<string, string> = {
  WeeklyBudgetMeeting: "Weekly Budget Meeting",
  AltaWeeklyVideoUpdates: "Alta Weekly Video Updates",
  Phase1Walkthroughs: "Phase 1 Walkthroughs",
  PropertyAutopsies: "Property Autopsies",
  QuarterlyIndexUpdate: "Quarterly Index Update",
};

function gradeColor(g: string | null): string {
  if (!g) return "text-text-tertiary";
  if (g === "A") return "text-green-600";
  if (g === "B") return "text-blue-600";
  if (g === "C") return "text-yellow-600";
  if (g === "D") return "text-orange-600";
  return "text-red-600";
}

export default function PerformanceTab({ TerritorySlug }: { TerritorySlug: string }) {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/api/territories/${TerritorySlug}/performance`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [TerritorySlug]);

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin" size={24} />
      </div>
    );
  if (!data) return <div className="text-text-secondary py-6">No performance data available.</div>;

  const { funnel, kpis, constructionEos } = data;
  const maxFunnel = Math.max(...FUNNEL_STAGES.map((s) => funnel[s.key] || 0), 1);

  return (
    <div className="space-y-6">
      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Purchased YTD" value={kpis.purchasedYTD} icon={Home} />
        <Stat label="Sold YTD" value={kpis.soldYTD} icon={TrendingUp} />
        <Stat label="Active Deals" value={kpis.activeDeals} icon={Target} />
        <Stat
          label="Avg Profit"
          value={kpis.avgProfit > 0 ? `$${kpis.avgProfit.toLocaleString()}` : "—"}
          icon={DollarSign}
        />
        <Stat
          label="Total Profit"
          value={kpis.totalProfit > 0 ? `$${kpis.totalProfit.toLocaleString()}` : "—"}
          icon={DollarSign}
        />
        <Stat label="Cycle Days" value={kpis.medianCycleDays ?? "—"} icon={Clock} sub="median" />
        <Stat label="T3 Leads" value={kpis.leadsT3} icon={TrendingUp} sub="last 3 months" />
        <Stat
          label="Conversion"
          value={kpis.conversionRate != null ? `${kpis.conversionRate}%` : "—"}
          icon={Target}
          sub="S1+ → S4+"
        />
      </div>

      {/* Property Funnel */}
      <div className="bg-bg-primary border border-border-default rounded-lg p-5">
        <h3 className="text-body-sm font-semibold text-text-primary mb-4">Property Funnel</h3>
        <div className="space-y-2">
          {FUNNEL_STAGES.map((stage) => {
            const count = funnel[stage.key] || 0;
            const pct = (count / maxFunnel) * 100;
            return (
              <div key={stage.key} className="flex items-center gap-3">
                <span className="w-20 text-caption text-text-tertiary text-right shrink-0">{stage.label}</span>
                <div className="flex-1 bg-bg-secondary rounded-full h-5 overflow-hidden">
                  <div
                    className={`h-full ${stage.color} rounded-full transition-all`}
                    style={{ width: `${Math.max(pct, count > 0 ? 3 : 0)}%` }}
                  />
                </div>
                <span className="w-8 text-body-sm font-medium text-text-primary text-right">{count}</span>
              </div>
            );
          })}
        </div>
        {/* Dead leads summary — collapsed */}
        <div className="mt-3 pt-3 border-t border-border-default">
          <div className="flex flex-wrap gap-3 text-caption text-text-tertiary">
            {DEAD_STAGES.map((s) =>
              funnel[s.key] ? (
                <span key={s.key}>
                  {s.label}: {funnel[s.key]}
                </span>
              ) : null
            )}
          </div>
        </div>
      </div>

      {/* Construction EOS */}
      {(constructionEos.rocks.length > 0 ||
        constructionEos.todos.length > 0 ||
        constructionEos.issues.length > 0 ||
        constructionEos.habits) && (
        <div className="bg-bg-primary border border-border-default rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <Hammer size={16} className="text-text-tertiary" />
            <h3 className="text-body-sm font-semibold text-text-primary">Construction EOS</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Habits */}
            {constructionEos.habits && (
              <div>
                <h4 className="text-caption font-medium text-text-tertiary mb-2">Habits</h4>
                <div className="space-y-1">
                  {Object.entries(HABIT_LABELS).map(([key, label]) => {
                    const grade = constructionEos.habits?.[key] ?? null;
                    return (
                      <div key={key} className="flex items-center justify-between text-body-sm">
                        <span className="text-text-secondary">{label}</span>
                        <span className={`font-bold ${gradeColor(grade)}`}>{grade || "—"}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Rocks */}
            {constructionEos.rocks.length > 0 && (
              <div>
                <h4 className="text-caption font-medium text-text-tertiary mb-2">Rocks</h4>
                <ul className="space-y-1">
                  {constructionEos.rocks.map((r) => (
                    <li key={r.Id} className="flex items-center gap-2 text-body-sm">
                      <span
                        className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          r.Status?.toLowerCase() === "complete"
                            ? "bg-green-100 text-green-700"
                            : r.Status?.toLowerCase() === "on track"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {r.Status || "—"}
                      </span>
                      <span className="text-text-primary truncate">{r.Rock || "—"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Todos */}
            {constructionEos.todos.length > 0 && (
              <div>
                <h4 className="text-caption font-medium text-text-tertiary mb-2">Todos</h4>
                <ul className="space-y-1">
                  {constructionEos.todos.map((t) => (
                    <li key={t.Id} className="flex items-center gap-2 text-body-sm">
                      <span
                        className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
                          t.Done ? "bg-green-100 border-green-400 text-green-700" : "border-border-default"
                        }`}
                      >
                        {t.Done ? "✓" : ""}
                      </span>
                      <span className={`${t.Done ? "line-through text-text-tertiary" : "text-text-primary"} truncate`}>
                        {t.Todo || "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Issues */}
            {constructionEos.issues.length > 0 && (
              <div>
                <h4 className="text-caption font-medium text-text-tertiary mb-2">Issues</h4>
                <ul className="space-y-1">
                  {constructionEos.issues.map((i) => (
                    <li key={i.Id} className="flex items-center gap-2 text-body-sm">
                      <span
                        className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
                          i.Done ? "bg-green-100 border-green-400 text-green-700" : "border-red-300 bg-red-50"
                        }`}
                      >
                        {i.Done ? "✓" : "!"}
                      </span>
                      <span className={`${i.Done ? "line-through text-text-tertiary" : "text-text-primary"} truncate`}>
                        {i.Issue || "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
