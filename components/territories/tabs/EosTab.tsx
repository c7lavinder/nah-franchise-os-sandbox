"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, X } from "lucide-react";
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

interface EosData {
  goals: EosTerritoryGoal[];
  scorecard: EosTerritoryScorecard[];
  budgets: EosTerritoryBudget[];
  leadChannels: EosTerritoryLeadChannel[];
  habits: EosTerritoryHabit[];
  rocks: EosTerritoryRock[];
  issues: EosTerritoryIssue[];
  todos: EosTerritoryTodo[];
}

interface Props {
  msSlug: string;
  carriedFromContactName?: string | null;
}

const BANNER_KEY_PREFIX = "eos_carry_dismissed_";

export default function TerritoryEosTab({ msSlug, carriedFromContactName }: Props) {
  const [data, setData] = useState<EosData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBanner, setShowBanner] = useState(false);

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/territories/${msSlug}/eos`);
    if (res.ok) {
      const d: EosData = await res.json();
      setData(d);

      // Show carry-forward banner if there are carried items and not yet dismissed
      if (carriedFromContactName) {
        const dismissed = localStorage.getItem(`${BANNER_KEY_PREFIX}${msSlug}`);
        const hasCarried =
          d.issues.some((i) => i.source === "carried_forward") ||
          d.todos.some((t) => t.source === "carried_forward");
        if (hasCarried && !dismissed) setShowBanner(true);
      }
    }
    setLoading(false);
  }, [msSlug, carriedFromContactName]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function dismissBanner() {
    setShowBanner(false);
    localStorage.setItem(`${BANNER_KEY_PREFIX}${msSlug}`, "1");
  }

  // no-op refresh — child components manage their own local state
  // but we keep the callback for future use if needed
  const handleUpdate = useCallback(() => {}, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-text-tertiary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-text-tertiary text-body-sm">
        Failed to load EOS data.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showBanner && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-body-sm text-amber-800">
            EOS seeded from <span className="font-semibold">{carriedFromContactName}</span>&apos;s sales profile — review and update below.
          </p>
          <button onClick={dismissBanner} className="text-amber-600 hover:text-amber-800 shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="rounded-xl border border-border-primary bg-bg-primary p-4 shadow-card">
        <TerritoryEosGoals msSlug={msSlug} goals={data.goals} onUpdate={handleUpdate} />
      </div>

      <div className="rounded-xl border border-border-primary bg-bg-primary p-4 shadow-card">
        <TerritoryEosScorecard msSlug={msSlug} scorecard={data.scorecard} onUpdate={handleUpdate} />
      </div>

      <div className="rounded-xl border border-border-primary bg-bg-primary p-4 shadow-card">
        <TerritoryEosMonthlySpend msSlug={msSlug} budgets={data.budgets} onUpdate={handleUpdate} />
      </div>

      <div className="rounded-xl border border-border-primary bg-bg-primary p-4 shadow-card">
        <TerritoryEosLeadChannels msSlug={msSlug} channels={data.leadChannels} onUpdate={handleUpdate} />
      </div>

      <div className="rounded-xl border border-border-primary bg-bg-primary p-4 shadow-card">
        <TerritoryEosHabits msSlug={msSlug} habits={data.habits} onUpdate={handleUpdate} />
      </div>

      <div className="rounded-xl border border-border-primary bg-bg-primary p-4 shadow-card">
        <TerritoryEosRocks msSlug={msSlug} rocks={data.rocks} onUpdate={handleUpdate} />
      </div>

      <div className="rounded-xl border border-border-primary bg-bg-primary p-4 shadow-card">
        <TerritoryEosIssues msSlug={msSlug} issues={data.issues} onUpdate={handleUpdate} />
      </div>

      <div className="rounded-xl border border-border-primary bg-bg-primary p-4 shadow-card">
        <TerritoryEosTodos msSlug={msSlug} todos={data.todos} onUpdate={handleUpdate} />
      </div>
    </div>
  );
}
