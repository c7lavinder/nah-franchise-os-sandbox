export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { computeTerritoryScorecardActuals } from "@/lib/territories/scorecard-actuals";

const GOAL_TYPES = ["houses_purchased", "gross_profit", "quality_of_life"] as const;

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
  const scorecardGoalByKey = new Map((scorecard.data ?? []).map((metric) => [metric.metric_key, metric.goal_value]));
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
    scorecard: scorecard.data ?? [],
    scorecardActuals,
    budgets: budgets.data ?? [],
    leadChannels: leadChannels.data ?? [],
    habits: habits.data ?? [],
    rocks: rocks.data ?? [],
    issues: issues.data ?? [],
    todos: todos.data ?? [],
  });
}
