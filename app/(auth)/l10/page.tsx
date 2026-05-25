"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { apiFetch } from "@/lib/auth/api-fetch";
import { BarChart3, Target, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

interface ScorecardMetric {
  TerritorySlug: string;
  metric_key: string;
  metric_label: string;
  goal: string | null;
  actual: string | null;
  unit: string | null;
}

interface TerritoryRow {
  slug: string;
  nickname: string;
  region: string | null;
  scorecard: ScorecardMetric[];
  scorecardHealth: number | null;
  rocks: { total: number; onTrack: number; offTrack: number };
}

interface Issue {
  TerritorySlug: string;
  title: string;
  priority: string;
  status: string;
}

interface Todo {
  TerritorySlug: string;
  title: string;
  assignee: string | null;
  due_date: string | null;
  done: boolean;
}

interface NetworkSummary {
  totalTerritories: number;
  avgScorecardHealth: number | null;
  totalOpenIssues: number;
  totalOpenTodos: number;
  totalRocksOnTrack: number;
  totalRocksOffTrack: number;
}

interface L10Data {
  territories: TerritoryRow[];
  openIssues: Issue[];
  openTodos: Todo[];
  networkSummary: NetworkSummary;
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-400">{label}</span>
        <div className={`rounded-lg p-2 ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3">
        <span className="text-3xl font-bold text-white">{value}</span>
      </div>
    </div>
  );
}

function healthColor(health: number | null): string {
  if (health === null) return "text-zinc-500";
  if (health >= 80) return "text-green-400";
  if (health >= 50) return "text-yellow-400";
  return "text-red-400";
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
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [user]);

  if (!user || user.role !== "admin") return null;

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (error || !data) {
    return <div className="p-8 text-red-400">Failed to load L10 data: {error ?? "Unknown error"}</div>;
  }

  const { territories, openIssues, openTodos, networkSummary } = data;

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold text-white">L10 Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-400">Network-wide EOS scorecard, rocks, issues, and todos</p>
      </div>

      {/* Network summary cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <SummaryCard
          label="Active Territories"
          value={networkSummary.totalTerritories}
          icon={BarChart3}
          color="bg-blue-500/10 text-blue-400"
        />
        <SummaryCard
          label="Avg Scorecard Health"
          value={networkSummary.avgScorecardHealth != null ? `${networkSummary.avgScorecardHealth}%` : "—"}
          icon={Target}
          color="bg-green-500/10 text-green-400"
        />
        <SummaryCard
          label="Open Issues"
          value={networkSummary.totalOpenIssues}
          icon={AlertTriangle}
          color="bg-yellow-500/10 text-yellow-400"
        />
        <SummaryCard
          label="Open Todos"
          value={networkSummary.totalOpenTodos}
          icon={CheckCircle2}
          color="bg-purple-500/10 text-purple-400"
        />
      </div>

      {/* Rocks summary */}
      {(networkSummary.totalRocksOnTrack > 0 || networkSummary.totalRocksOffTrack > 0) && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="mb-3 text-lg font-semibold text-white">Rocks</h2>
          <div className="flex gap-6">
            <div>
              <span className="text-2xl font-bold text-green-400">{networkSummary.totalRocksOnTrack}</span>
              <span className="ml-2 text-sm text-zinc-400">on track</span>
            </div>
            <div>
              <span className="text-2xl font-bold text-red-400">{networkSummary.totalRocksOffTrack}</span>
              <span className="ml-2 text-sm text-zinc-400">off track</span>
            </div>
          </div>
        </div>
      )}

      {/* Territory scorecard table */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60">
        <div className="border-b border-zinc-800 p-5">
          <h2 className="text-lg font-semibold text-white">Territory Scorecard</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-zinc-400">
                <th className="px-5 py-3 font-medium">Territory</th>
                <th className="px-5 py-3 font-medium">Region</th>
                <th className="px-5 py-3 font-medium text-center">Health</th>
                <th className="px-5 py-3 font-medium text-center">Rocks</th>
                <th className="px-5 py-3 font-medium text-center">Metrics</th>
              </tr>
            </thead>
            <tbody>
              {territories.map((t) => (
                <tr key={t.slug} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                  <td className="px-5 py-3">
                    <a href={`/territories/${t.slug}`} className="font-medium text-white hover:text-blue-400">
                      {t.nickname || t.slug}
                    </a>
                  </td>
                  <td className="px-5 py-3 text-zinc-400">{t.region ?? "—"}</td>
                  <td className={`px-5 py-3 text-center font-bold ${healthColor(t.scorecardHealth)}`}>
                    {t.scorecardHealth != null ? `${t.scorecardHealth}%` : "—"}
                  </td>
                  <td className="px-5 py-3 text-center">
                    {t.rocks.total > 0 ? (
                      <span>
                        <span className="text-green-400">{t.rocks.onTrack}</span>
                        {t.rocks.offTrack > 0 && (
                          <>
                            {" / "}
                            <span className="text-red-400">{t.rocks.offTrack}</span>
                          </>
                        )}
                      </span>
                    ) : (
                      <span className="text-zinc-500">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-center text-zinc-400">
                    {t.scorecard.length > 0 ? t.scorecard.length : "—"}
                  </td>
                </tr>
              ))}
              {territories.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-zinc-500">
                    No active territories
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Open issues */}
      {openIssues.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60">
          <div className="border-b border-zinc-800 p-5">
            <h2 className="text-lg font-semibold text-white">Open Issues ({openIssues.length})</h2>
          </div>
          <div className="divide-y divide-zinc-800/50">
            {openIssues.slice(0, 20).map((issue, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3">
                <div>
                  <span className="text-white">{issue.title}</span>
                  <span className="ml-2 text-xs text-zinc-500">{issue.TerritorySlug}</span>
                </div>
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${
                    issue.priority === "high"
                      ? "bg-red-500/10 text-red-400"
                      : issue.priority === "medium"
                        ? "bg-yellow-500/10 text-yellow-400"
                        : "bg-zinc-500/10 text-zinc-400"
                  }`}
                >
                  {issue.priority}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Open todos */}
      {openTodos.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60">
          <div className="border-b border-zinc-800 p-5">
            <h2 className="text-lg font-semibold text-white">Open Todos ({openTodos.length})</h2>
          </div>
          <div className="divide-y divide-zinc-800/50">
            {openTodos.slice(0, 20).map((todo, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3">
                <div>
                  <span className="text-white">{todo.title}</span>
                  <span className="ml-2 text-xs text-zinc-500">{todo.TerritorySlug}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-zinc-400">
                  {todo.assignee && <span>{todo.assignee}</span>}
                  {todo.due_date && <span>{todo.due_date.split("T")[0]}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
