export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

import type { SupabaseClient } from "@supabase/supabase-js";

const CANONICAL_SCORECARD_KEYS = [
  "t3_leads_entered",
  "t3_s1_to_s4_pct",
  "t3_purchased",
  "t3_avg_inventory",
  "t12_median_cycle_days",
  "t3_gross_profit",
  "t3_compliance_score",
] as const;

const CANONICAL_SCORECARD_KEY_SET = new Set<string>(CANONICAL_SCORECARD_KEYS);

type PropertyRow = {
  PropertyId: number;
  Inserted: string | null;
};

type InventoryRow = {
  PropertyId: number;
  Inv_PurchaseDate: string;
  Inv_SellDate: string | null;
};

type StatusHistoryRow = {
  PropertyId: number;
  NewStatus: string | null;
  Inserted: string;
};

type CalculationRow = {
  PropertyId: number;
  Calculated_Inv_Profit: number | null;
};

function stageKey(status: string | null): string | null {
  if (!status) return null;
  const trimmed = status.trim();
  if (trimmed === "1" || trimmed.startsWith("1 ")) return "1";
  if (trimmed === "2" || trimmed.startsWith("2 ")) return "2";
  if (trimmed === "3" || trimmed.startsWith("3 ")) return "3";
  if (trimmed === "4" || trimmed.startsWith("4 ")) return "4";
  if (trimmed === "5" || trimmed.startsWith("5 ")) return "5 Contract";
  if (trimmed === "6" || trimmed.startsWith("6 ")) return "6 Purchase";
  return null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(1));
}

function formatMoney(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1).replace(/\.0$/, "")}%`;
}

function formatCompliancePercent(value: number): string {
  const percent = value <= 1 ? value * 100 : value;
  return formatPercent(percent);
}

function formatScorecardGoal(metricKey: string, goalValue: string | null): string | null {
  if (goalValue == null) return goalValue;
  const numeric = Number(goalValue);
  if (!Number.isFinite(numeric)) return goalValue;
  if (metricKey === "t3_compliance_score" || metricKey === "t3_s1_to_s4_pct") {
    return formatCompliancePercent(numeric);
  }
  return goalValue;
}

async function fetchPaged<T>(queryFactory: (from: number, to: number) => PromiseLike<{ data: T[] | null }>) {
  const rows: T[] = [];
  let offset = 0;
  while (true) {
    const { data } = await queryFactory(offset, offset + 999);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  return rows;
}

function averageDailyInventory(rows: InventoryRow[], start: Date, endExclusive: Date): number | null {
  let total = 0;
  let days = 0;

  for (const day = new Date(start); day < endExclusive; day.setDate(day.getDate() + 1)) {
    const count = rows.filter((row) => {
      const purchaseDate = new Date(row.Inv_PurchaseDate);
      const sellDate = row.Inv_SellDate ? new Date(row.Inv_SellDate) : null;
      return purchaseDate <= day && (!sellDate || sellDate > day);
    }).length;

    total += count;
    days += 1;
  }

  return days > 0 ? total / days : null;
}

async function computeScorecardActuals(
  supabase: SupabaseClient,
  TerritorySlug: string
): Promise<Record<string, string>> {
  const actuals: Record<string, string> = {};
  const now = new Date();
  const todayEndExclusive = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const t3Start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
  const t12Start = new Date(now.getFullYear(), now.getMonth() - 12, now.getDate());
  const t3StartISO = t3Start.toISOString();
  const t12StartISO = t12Start.toISOString();
  const endISO = todayEndExclusive.toISOString();

  const propertyRows = await fetchPaged<PropertyRow>((from, to) =>
    supabase
      .from("ms_properties")
      .select("PropertyId, Inserted")
      .eq("TerritorySlug", TerritorySlug)
      .eq("Archived", false)
      .order("PropertyId")
      .range(from, to)
  );

  if (propertyRows.length === 0) return actuals;
  const propertyIds = propertyRows.map((p) => p.PropertyId);

  let t3History: StatusHistoryRow[] = [];
  for (let i = 0; i < propertyIds.length; i += 500) {
    const { data: page } = await supabase
      .from("ms_property_status_history")
      .select("PropertyId, NewStatus, Inserted")
      .in("PropertyId", propertyIds.slice(i, i + 500))
      .gte("Inserted", t3StartISO)
      .lt("Inserted", endISO);
    if (page) t3History = t3History.concat(page as StatusHistoryRow[]);
  }

  const enteredStage1 = new Set<number>();
  const reachedStage4 = new Set<number>();
  for (const row of t3History) {
    const stage = stageKey(row.NewStatus);
    if (stage === "1") enteredStage1.add(row.PropertyId);
    if (stage === "4" || stage === "5 Contract" || stage === "6 Purchase") reachedStage4.add(row.PropertyId);
  }

  const stage1ToStage4 = [...enteredStage1].filter((id) => reachedStage4.has(id)).length;
  actuals["t3_leads_entered"] = String(enteredStage1.size);
  actuals["t3_s1_to_s4_pct"] =
    enteredStage1.size > 0 ? formatPercent((stage1ToStage4 / enteredStage1.size) * 100) : "0%";

  let inventoryRows: InventoryRow[] = [];
  for (let i = 0; i < propertyIds.length; i += 500) {
    const { data: page } = await supabase
      .from("ms_property_inventory")
      .select("PropertyId, Inv_PurchaseDate, Inv_SellDate")
      .in("PropertyId", propertyIds.slice(i, i + 500))
      .not("Inv_PurchaseDate", "is", null);
    if (page) inventoryRows = inventoryRows.concat(page as InventoryRow[]);
  }

  const t3PurchasedRows = inventoryRows.filter((row) => {
    const purchaseDate = new Date(row.Inv_PurchaseDate);
    return purchaseDate >= t3Start && purchaseDate < todayEndExclusive;
  });
  const t3SoldRows = inventoryRows.filter((row) => {
    if (!row.Inv_SellDate) return false;
    const sellDate = new Date(row.Inv_SellDate);
    return sellDate >= t3Start && sellDate < todayEndExclusive;
  });
  const t3SoldIds = t3SoldRows.map((row) => row.PropertyId);
  actuals["t3_purchased"] = String(t3PurchasedRows.length);
  const t3AverageInventory = averageDailyInventory(inventoryRows, t3Start, todayEndExclusive);
  actuals["t3_avg_inventory"] = t3AverageInventory == null ? "—" : String(Math.round(t3AverageInventory));

  const t12CycleDays = inventoryRows
    .filter(
      (row) =>
        row.Inv_SellDate && new Date(row.Inv_SellDate) >= t12Start && new Date(row.Inv_SellDate) < todayEndExclusive
    )
    .map((row) =>
      Math.round(
        (new Date(row.Inv_SellDate!).getTime() - new Date(row.Inv_PurchaseDate).getTime()) / (1000 * 60 * 60 * 24)
      )
    )
    .filter((days) => days > 0);
  const t12MedianCycleDays = median(t12CycleDays);
  actuals["t12_median_cycle_days"] = t12MedianCycleDays == null ? "—" : String(t12MedianCycleDays);

  if (t3SoldIds.length > 0) {
    let calcRows: CalculationRow[] = [];
    for (let i = 0; i < t3SoldIds.length; i += 500) {
      const { data: page } = await supabase
        .from("ms_property_calculations")
        .select("PropertyId, Calculated_Inv_Profit")
        .in("PropertyId", t3SoldIds.slice(i, i + 500))
        .not("Calculated_Inv_Profit", "is", null);
      if (page) calcRows = calcRows.concat(page as CalculationRow[]);
    }

    const totalProfit = calcRows.reduce((sum, row) => sum + Number(row.Calculated_Inv_Profit ?? 0), 0);
    actuals["t3_gross_profit"] = formatMoney(totalProfit);
  } else {
    actuals["t3_gross_profit"] = "$0";
  }

  // Compliance score from territory
  const { data: territory } = await supabase
    .from("territories")
    .select("ComplianceScore")
    .eq("TerritorySlug", TerritorySlug)
    .single();

  if (territory?.ComplianceScore != null) {
    actuals["t3_compliance_score"] = formatCompliancePercent(Number(territory.ComplianceScore));
  }

  return actuals;
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
  const scorecardActuals = await computeScorecardActuals(supabase, TerritorySlug);
  const canonicalScorecard = (scorecard.data ?? [])
    .filter((row) => CANONICAL_SCORECARD_KEY_SET.has(row.metric_key))
    .map((row) => ({
      ...row,
      goal_value: formatScorecardGoal(row.metric_key, row.goal_value),
    }));

  return NextResponse.json({
    goals: goals.data ?? [],
    scorecard: canonicalScorecard,
    scorecardActuals,
    budgets: budgets.data ?? [],
    leadChannels: leadChannels.data ?? [],
    habits: habits.data ?? [],
    rocks: rocks.data ?? [],
    issues: issues.data ?? [],
    todos: todos.data ?? [],
  });
}
