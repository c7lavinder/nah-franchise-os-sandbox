"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

import { useState, useEffect, useCallback } from "react";
import { Loader2, X, Hammer } from "lucide-react";
import TerritoryEosGoals from "@/components/territories/eos/TerritoryEosGoals";
import TerritoryEosScorecard from "@/components/territories/eos/TerritoryEosScorecard";
import TerritoryEosMonthlySpend from "@/components/territories/eos/TerritoryEosMonthlySpend";
import TerritoryEosLeadChannels from "@/components/territories/eos/TerritoryEosLeadChannels";
import TerritoryEosHabits from "@/components/territories/eos/TerritoryEosHabits";
import TerritoryEosRocks from "@/components/territories/eos/TerritoryEosRocks";
import TerritoryEosIssues from "@/components/territories/eos/TerritoryEosIssues";
import TerritoryEosTodos from "@/components/territories/eos/TerritoryEosTodos";

import type {
  EosTerritoryGoal,
  EosTerritoryScorecard,
  EosTerritoryBudget,
  EosTerritoryLeadChannel,
  EosTerritoryHabit,
  EosTerritoryRock,
  EosTerritoryIssue,
  EosTerritoryTodo,
} from "@/types/database";

interface ConstructionEos {
  rocks: Array<{ Id: number; Rock: string | null; Status: string | null }>;
  todos: Array<{ Id: number; Todo: string | null; Done: boolean }>;
  issues: Array<{ Id: number; Issue: string | null; Done: boolean }>;
  habits: Record<string, string | null> | null;
}

interface EosData {
  goals: EosTerritoryGoal[];
  scorecard: EosTerritoryScorecard[];
  scorecardActuals?: Record<string, string>;
  budgets: EosTerritoryBudget[];
  leadChannels: EosTerritoryLeadChannel[];
  habits: EosTerritoryHabit[];
  rocks: EosTerritoryRock[];
  issues: EosTerritoryIssue[];
  todos: EosTerritoryTodo[];
}

interface Props {
  TerritorySlug: string;
  carriedFromContactName?: string | null;
}

const BANNER_KEY_PREFIX = "eos_carry_dismissed_";

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

export default function TerritoryEosTab({ TerritorySlug, carriedFromContactName }: Props) {
  const [data, setData] = useState<EosData | null>(null);
  const [constructionEos, setConstructionEos] = useState<ConstructionEos | null>(null);
  const [msSyncedAt, setMsSyncedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBanner, setShowBanner] = useState(false);

  const fetchData = useCallback(async () => {
    const [eosRes, perfRes, territoryRes] = await Promise.all([
      apiFetch(`/api/territories/${TerritorySlug}/eos`),
      apiFetch(`/api/territories/${TerritorySlug}/construction-eos`).catch(() => null),
      apiFetch(`/api/territories/${TerritorySlug}`).catch(() => null),
    ]);
    if (eosRes.ok) {
      const d: EosData = await eosRes.json();
      setData(d);

      // Show carry-forward banner if there are carried items and not yet dismissed
      if (carriedFromContactName) {
        const dismissed = localStorage.getItem(`${BANNER_KEY_PREFIX}${TerritorySlug}`);
        const hasCarried =
          d.issues.some((i) => i.source === "carried_forward") || d.todos.some((t) => t.source === "carried_forward");
        if (hasCarried && !dismissed) setShowBanner(true);
      }
    }
    if (perfRes?.ok) {
      const pd = await perfRes.json();
      setConstructionEos(pd);
    }
    if (territoryRes?.ok) {
      const td = await territoryRes.json();
      setMsSyncedAt(td?.territory?.ms_synced_at ?? null);
    }
    setLoading(false);
  }, [TerritorySlug, carriedFromContactName]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function dismissBanner() {
    setShowBanner(false);
    localStorage.setItem(`${BANNER_KEY_PREFIX}${TerritorySlug}`, "1");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-text-tertiary" />
      </div>
    );
  }

  if (!data) {
    return <div className="text-center py-12 text-text-tertiary text-body-sm">Failed to load EOS data.</div>;
  }

  return (
    <div className="space-y-4">
      {showBanner && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-body-sm text-amber-800">
            EOS seeded from <span className="font-semibold">{carriedFromContactName}</span>&apos;s sales profile —
            review and update below.
          </p>
          <button onClick={dismissBanner} className="text-amber-600 hover:text-amber-800 shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="rounded-xl border border-border-primary bg-bg-primary p-4 shadow-card">
        <TerritoryEosGoals goals={data.goals} />
      </div>

      <div className="rounded-xl border border-border-primary bg-bg-primary p-4 shadow-card">
        <TerritoryEosScorecard scorecard={data.scorecard} actuals={data.scorecardActuals} />
      </div>

      <div className="rounded-xl border border-border-primary bg-bg-primary p-4 shadow-card">
        <TerritoryEosMonthlySpend budgets={data.budgets} />
      </div>

      <div className="rounded-xl border border-border-primary bg-bg-primary p-4 shadow-card">
        <TerritoryEosLeadChannels channels={data.leadChannels} />
      </div>

      <div className="rounded-xl border border-border-primary bg-bg-primary p-4 shadow-card">
        <TerritoryEosHabits habits={data.habits} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        <div className="rounded-xl border border-border-primary bg-bg-primary p-4 shadow-card">
          <TerritoryEosRocks rocks={data.rocks} />
        </div>

        <div className="rounded-xl border border-border-primary bg-bg-primary p-4 shadow-card">
          <TerritoryEosIssues issues={data.issues} />
        </div>

        <div className="rounded-xl border border-border-primary bg-bg-primary p-4 shadow-card">
          <TerritoryEosTodos todos={data.todos} />
        </div>
      </div>

      {/* Construction EOS */}
      {constructionEos &&
        (constructionEos.rocks.length > 0 ||
          constructionEos.todos.length > 0 ||
          constructionEos.issues.length > 0 ||
          constructionEos.habits) && (
          <div className="rounded-xl border border-border-primary bg-bg-primary p-4 shadow-card">
            <div className="flex items-center gap-2 mb-4">
              <Hammer size={16} className="text-text-tertiary" />
              <h3 className="text-body-sm font-semibold text-text-primary">Construction EOS</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                          {t.Done ? "\u2713" : ""}
                        </span>
                        <span
                          className={`${t.Done ? "line-through text-text-tertiary" : "text-text-primary"} truncate`}
                        >
                          {t.Todo || "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
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
                          {i.Done ? "\u2713" : "!"}
                        </span>
                        <span
                          className={`${i.Done ? "line-through text-text-tertiary" : "text-text-primary"} truncate`}
                        >
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

      {msSyncedAt && (
        <p className="text-caption text-text-tertiary text-right">
          Last synced from MasterSuite: {new Date(msSyncedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}
