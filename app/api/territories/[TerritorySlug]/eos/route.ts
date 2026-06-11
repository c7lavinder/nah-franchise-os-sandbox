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
const VISIBLE_LEAD_CHANNELS: { name: string; aliases?: string[] }[] = [
  { name: "Prospect Now", aliases: ["Digital Prospect Now"] },
  { name: "Vacants" },
  { name: "High Equity" },
  { name: "Absentee Owners" },
  { name: "Probates" },
  { name: "Evictions" },
  { name: "City Citations" },
  { name: "Distressed Rentals" },
  { name: "Divorces" },
  { name: "Social Platforms" },
  { name: "Birddogs" },
  { name: "Agent Listed" },
  { name: "FSBO" },
  { name: "Foreclosures" },
  { name: "Brokered Auctions" },
  { name: "Wholesalers" },
  { name: "Agents", aliases: ["Agents Industry Network"] },
  { name: "Industry Network", aliases: ["Agents Industry Network"] },
  { name: "Homelight" },
  { name: "Asset Managers" },
  { name: "Facebook Ads" },
  { name: "Google Ads" },
  { name: "Google Retargeting" },
  { name: "Organic Search" },
  { name: "Google Map Pack" },
  { name: "Google Business" },
  { name: "Facebook" },
  { name: "Instagram" },
  { name: "TikTok" },
  { name: "YouTube" },
  { name: "Google Business Profile" },
  { name: "Other Social Media" },
] as const;
const MONTHLY_SPEND_ORDER = [
  "Digital Storefront",
  "Lead Manager",
  "Direct Mail",
  "Acquisitions Manager",
  "Launch Control",
  "Deal Machine",
];

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

function isMonthlySpendRow(description: string) {
  return !/\b(budget|target)\b/i.test(description);
}

function monthlySpendSortIndex(description: string) {
  const index = MONTHLY_SPEND_ORDER.findIndex((item) => item.toLowerCase() === description.toLowerCase());
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
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
  const leadChannelsByName = new Map((leadChannels.data ?? []).map((channel) => [channel.channel_name, channel]));
  const visibleLeadChannels = VISIBLE_LEAD_CHANNELS.map((channel, index) => {
    const names = [channel.name, ...(channel.aliases ?? [])];
    const source = names.map((name) => leadChannelsByName.get(name)).find(Boolean);
    const isActive = names.some((name) => leadChannelsByName.get(name)?.is_active);

    return {
      ...(source ?? {
        id: `${TerritorySlug}-${channel.name}`,
        TerritorySlug,
        updated_at: null,
      }),
      channel_name: channel.name,
      is_active: isActive,
      sort_order: index + 1,
    };
  });
  const visibleBudgets = (budgets.data ?? [])
    .filter((budget) => isMonthlySpendRow(budget.description))
    .sort((a, b) => {
      const orderDiff = monthlySpendSortIndex(a.description) - monthlySpendSortIndex(b.description);
      if (orderDiff !== 0) return orderDiff;
      return (a.ms_id ?? 0) - (b.ms_id ?? 0);
    });
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
    budgets: visibleBudgets,
    leadChannels: visibleLeadChannels,
    habits: habits.data ?? [],
    rocks: rocks.data ?? [],
    issues: issues.data ?? [],
    todos: todos.data ?? [],
  });
}
