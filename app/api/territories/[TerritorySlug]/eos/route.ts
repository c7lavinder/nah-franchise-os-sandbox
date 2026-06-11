export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { computeTerritoryScorecardActuals } from "@/lib/territories/scorecard-actuals";

const GOAL_TYPES = ["houses_purchased", "gross_profit", "quality_of_life"] as const;
const VISIBLE_SCORECARD_KEYS = [
  "t3_leads_entered",
  "t3_s1_to_s4_pct",
  "t3_purchased",
  "t3_avg_inventory",
  "t12_median_cycle_days",
  "t3_gross_profit",
  "t3_compliance_score",
] as const;

function formatScorecardValue(metricKey: string, value: string | null) {
  if (!value) return value;
  if (metricKey === "t3_gross_profit") {
    const numeric = Number(String(value).replace(/[$,]/g, ""));
    return Number.isFinite(numeric) ? `$${Math.round(numeric).toLocaleString("en-US")}` : value;
  }
  if (metricKey === "t3_s1_to_s4_pct" || metricKey === "t3_compliance_score") {
    const numeric = Number(String(value).replace("%", ""));
    if (!Number.isFinite(numeric)) return value;
    const percent = numeric <= 1 ? numeric * 100 : numeric;
    return `${Math.round(percent)}%`;
  }
  return value;
}

/** GET — returns all territory EOS sections */
export async function GET(request: NextRequest, { params }: { params: Promise<{ TerritorySlug: string }> }) {
  const { TerritorySlug } = await params;
  const supabase = createServerClient();

  const [goals, scorecard, budgets, leadChannels, habits, rocks, issues, todos] = await Promise.all([
    supabase.from("eos_territory_goals").select("*").eq("TerritorySlug", TerritorySlug).order("goal_type"),
    supabase.from("eos_territory_scorecard").select("*").eq("TerritorySlug", TerritorySlug).order("sort_order"),
    supabase.from("eos_territory_budgets").select("*").eq("TerritorySlug", TerritorySlug).order("sort_order"),
    supabase.from("eos_territory_lead_channels").select("*").eq("TerritorySlug", TerritorySlug).order("sort_order"),
    supabase.from("eos_territory_habits").select("*").eq("TerritorySlug", TerritorySlug).order("sort_order"),
    supabase.from("eos_territory_rocks").select("*").eq("TerritorySlug", TerritorySlug).order("created_at"),
    supabase.from("eos_territory_issues").select("*").eq("TerritorySlug", TerritorySlug).order("created_at"),
    supabase.from("eos_territory_todos").select("*").eq("TerritorySlug", TerritorySlug).order("created_at"),
  ]);

  // Return first error if any query failed
  const firstError = [goals, scorecard, budgets, leadChannels, habits, rocks, issues, todos].find((r) => r.error);
  if (firstError?.error) {
    return NextResponse.json({ error: firstError.error.message }, { status: 500 });
  }

  // Compute scorecard actuals from ms_properties
  const scorecardActuals = await computeTerritoryScorecardActuals(supabase, TerritorySlug);
  const visibleScorecard = (scorecard.data ?? [])
    .filter((metric) => VISIBLE_SCORECARD_KEYS.includes(metric.metric_key as (typeof VISIBLE_SCORECARD_KEYS)[number]))
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((metric) => ({
      ...metric,
      goal_value: formatScorecardValue(metric.metric_key, metric.goal_value),
    }));
  const formattedScorecardActuals = Object.fromEntries(
    Object.entries(scorecardActuals).map(([metricKey, value]) => [metricKey, formatScorecardValue(metricKey, value)])
  );
  const scorecardGoalByKey = new Map(visibleScorecard.map((metric) => [metric.metric_key, metric.goal_value]));
  const goalsByType = new Map((goals.data ?? []).map((goal) => [goal.goal_type, goal]));
  const goalsWithDerivedValues = GOAL_TYPES.map((goalType) => {
    const existing = goalsByType.get(goalType);
    if (goalType === "houses_purchased") {
      return {
        id: existing?.id ?? goalType,
        TerritorySlug,
        goal_type: goalType,
        actual: existing?.actual ?? scorecardActuals.t3_purchased ?? null,
        current_year_goal: existing?.current_year_goal ?? scorecardGoalByKey.get("t3_purchased") ?? null,
        year_5_goal: existing?.year_5_goal ?? null,
        year_25_goal: existing?.year_25_goal ?? null,
        updated_at: existing?.updated_at ?? null,
      };
    }
    if (goalType === "gross_profit") {
      return {
        id: existing?.id ?? goalType,
        TerritorySlug,
        goal_type: goalType,
        actual: existing?.actual ?? scorecardActuals.t3_gross_profit ?? null,
        current_year_goal: existing?.current_year_goal ?? scorecardGoalByKey.get("t3_gross_profit") ?? null,
        year_5_goal: existing?.year_5_goal ?? null,
        year_25_goal: existing?.year_25_goal ?? null,
        updated_at: existing?.updated_at ?? null,
      };
    }
    return {
      id: existing?.id ?? goalType,
      TerritorySlug,
      goal_type: goalType,
      actual: existing?.actual ?? null,
      current_year_goal: existing?.current_year_goal ?? null,
      year_5_goal: existing?.year_5_goal ?? null,
      year_25_goal: existing?.year_25_goal ?? null,
      updated_at: existing?.updated_at ?? null,
    };
  });

  return NextResponse.json({
    goals: goalsWithDerivedValues,
    scorecard: visibleScorecard,
    scorecardActuals: formattedScorecardActuals,
    budgets: budgets.data ?? [],
    leadChannels: leadChannels.data ?? [],
    habits: habits.data ?? [],
    rocks: rocks.data ?? [],
    issues: issues.data ?? [],
    todos: todos.data ?? [],
  });
}
