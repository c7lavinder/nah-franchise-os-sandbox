export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { EosTerritoryLeadChannel } from "@/types/database";

type PropertyRow = {
  PropertyId: number;
};

type InventoryRow = {
  PropertyId: number;
  Inv_PurchaseDate: string | null;
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

const APPROVED_SCORECARD_KEYS = [
  "t3_leads_entered",
  "t3_s1_to_s4_pct",
  "t3_purchased",
  "t3_avg_inventory",
  "t12_median_cycle_days",
  "t3_gross_profit",
  "t3_compliance_score",
];

const SCORECARD_PERCENT_KEYS = new Set(["t3_s1_to_s4_pct", "t3_compliance_score"]);
const SCORECARD_CURRENCY_KEYS = new Set(["t3_gross_profit"]);

const LEAD_CHANNEL_ORDER = [
  "Prospect Now",
  "Vacants",
  "High Equity",
  "Absentee Owners",
  "Probates",
  "Evictions",
  "City Citations",
  "Distressed Rentals",
  "Divorces",
  "Social Platforms",
  "Birddogs",
  "Agent Listed",
  "FSBO",
  "Foreclosures",
  "Brokered Auctions",
  "Wholesalers",
  "Agents",
  "Industry Network",
  "Homelight",
  "Asset Managers",
  "Facebook Ads",
  "Google Ads",
  "Google Retargeting",
  "Organic Search",
  "Google Map Pack",
  "Google Business",
  "Facebook",
  "Instagram",
  "TikTok",
  "YouTube",
  "Google Business Profile",
  "Other Social Media",
];

function normalizeLeadChannelName(name: string): string {
  if (name === "Digital Prospect Now") return "Prospect Now";
  return name;
}

function scorecardSort(key: string): number {
  const index = APPROVED_SCORECARD_KEYS.indexOf(key);
  return index === -1 ? 999 : index + 1;
}

function leadChannelSort(name: string): number {
  const index = LEAD_CHANNEL_ORDER.indexOf(name);
  return index === -1 ? 999 : index + 1;
}

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

function isInRange(value: string | null, start: Date, endExclusive: Date): boolean {
  if (!value) return false;
  const date = new Date(value);
  return date >= start && date < endExclusive;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(1));
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

function formatScorecardValue(metricKey: string, value: string | null): string | null {
  if (value == null || value === "") return value;
  const numeric = Number(value);

  if (SCORECARD_CURRENCY_KEYS.has(metricKey) && Number.isFinite(numeric)) {
    return `$${numeric.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }

  if (SCORECARD_PERCENT_KEYS.has(metricKey)) {
    if (!Number.isFinite(numeric)) return value.endsWith("%") ? value : `${value}%`;
    const pct = metricKey === "t3_compliance_score" && numeric <= 1 ? numeric * 100 : numeric;
    return `${pct.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
  }

  return value;
}

async function computeScorecardActuals(
  supabase: SupabaseClient,
  TerritorySlug: string
): Promise<Record<string, string>> {
  const actuals: Record<string, string> = {};
  const now = new Date();
  const todayEndExclusive = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const t3Start = new Date(now);
  t3Start.setDate(t3Start.getDate() - 90);
  const t12Start = new Date(now);
  t12Start.setMonth(t12Start.getMonth() - 12);

  const props = await fetchPaged<PropertyRow>((from, to) =>
    supabase
      .from("ms_properties")
      .select("PropertyId")
      .eq("TerritorySlug", TerritorySlug)
      .eq("Archived", false)
      .order("PropertyId")
      .range(from, to)
  );

  if (props.length === 0) return actuals;

  const propertyIds = props.map((p) => p.PropertyId);

  let currentHistory: StatusHistoryRow[] = [];
  for (let i = 0; i < propertyIds.length; i += 500) {
    currentHistory = currentHistory.concat(
      await fetchPaged<StatusHistoryRow>((from, to) =>
        supabase
          .from("ms_property_status_history")
          .select("PropertyId, NewStatus, Inserted")
          .in("PropertyId", propertyIds.slice(i, i + 500))
          .gte("Inserted", t3Start.toISOString())
          .lt("Inserted", todayEndExclusive.toISOString())
          .order("Inserted")
          .range(from, to)
      )
    );
  }

  const enteredStage1 = new Set<number>();
  const reachedStage4Plus = new Set<number>();
  for (const row of currentHistory) {
    const stage = stageKey(row.NewStatus);
    if (stage === "1") enteredStage1.add(row.PropertyId);
    if (stage === "4" || stage === "5 Contract" || stage === "6 Purchase") reachedStage4Plus.add(row.PropertyId);
  }

  // T3 Leads Entered — leads that hit Stage 1 in this territory in the last 90 days.
  actuals["t3_leads_entered"] = String(enteredStage1.size);

  const convertedT3 = [...enteredStage1].filter((id) => reachedStage4Plus.has(id)).length;
  if (enteredStage1.size > 0) {
    actuals["t3_s1_to_s4_pct"] = `${((convertedT3 / enteredStage1.size) * 100).toFixed(1)}%`;
  }

  let inventory: InventoryRow[] = [];
  for (let i = 0; i < propertyIds.length; i += 500) {
    const { data } = await supabase
      .from("ms_property_inventory")
      .select("PropertyId, Inv_PurchaseDate, Inv_SellDate")
      .in("PropertyId", propertyIds.slice(i, i + 500))
      .not("Inv_PurchaseDate", "is", null);
    if (data) inventory = inventory.concat(data as InventoryRow[]);
  }

  const purchasedT3 = inventory.filter((row) => isInRange(row.Inv_PurchaseDate, t3Start, todayEndExclusive));
  actuals["t3_purchased"] = String(purchasedT3.length);

  const activeInventory = inventory.filter((row) => !row.Inv_SellDate);
  actuals["t3_avg_inventory"] = String(activeInventory.length);

  const soldT3 = inventory.filter((row) => isInRange(row.Inv_SellDate, t3Start, todayEndExclusive));
  const soldT3Ids = soldT3.map((row) => row.PropertyId);
  if (soldT3Ids.length > 0) {
    let calcs: CalculationRow[] = [];
    for (let i = 0; i < soldT3Ids.length; i += 500) {
      const { data } = await supabase
        .from("ms_property_calculations")
        .select("PropertyId, Calculated_Inv_Profit")
        .in("PropertyId", soldT3Ids.slice(i, i + 500))
        .not("Calculated_Inv_Profit", "is", null);
      if (data) calcs = calcs.concat(data as CalculationRow[]);
    }

    const totalProfit = calcs.reduce((sum, c) => sum + Number(c.Calculated_Inv_Profit ?? 0), 0);
    actuals["t3_gross_profit"] = `$${Math.round(totalProfit).toLocaleString()}`;
  } else {
    actuals["t3_gross_profit"] = "$0";
  }

  const cycleDays = inventory
    .filter((row) => isInRange(row.Inv_SellDate, t12Start, todayEndExclusive))
    .map((row) => {
      if (!row.Inv_PurchaseDate || !row.Inv_SellDate) return null;
      const days = Math.round(
        (new Date(row.Inv_SellDate).getTime() - new Date(row.Inv_PurchaseDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      return days > 0 ? days : null;
    })
    .filter((days): days is number => days != null);
  const medianCycleDays = median(cycleDays);
  if (medianCycleDays != null) {
    actuals["t12_median_cycle_days"] = String(medianCycleDays);
  }

  // Compliance score from territory
  const { data: territory } = await supabase
    .from("territories")
    .select("ComplianceScore")
    .eq("TerritorySlug", TerritorySlug)
    .single();

  if (territory?.ComplianceScore != null) {
    actuals["t3_compliance_score"] =
      formatScorecardValue("t3_compliance_score", String(territory.ComplianceScore)) ?? "";
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

  const approvedScorecard = (scorecard.data ?? [])
    .filter((row) => APPROVED_SCORECARD_KEYS.includes(row.metric_key))
    .map((row) => ({
      ...row,
      goal_value: formatScorecardValue(row.metric_key, row.goal_value),
      sort_order: scorecardSort(row.metric_key),
    }))
    .sort((a, b) => a.sort_order - b.sort_order);

  const filteredBudgets = (budgets.data ?? []).filter((row) => {
    const description = row.description.toLowerCase();
    return !description.includes("budget") && !description.includes("target");
  });

  const channelMap = new Map<string, EosTerritoryLeadChannel>();
  for (const row of leadChannels.data ?? []) {
    const channelName = normalizeLeadChannelName(row.channel_name);
    if (!LEAD_CHANNEL_ORDER.includes(channelName)) continue;
    const existing = channelMap.get(channelName);
    channelMap.set(channelName, {
      ...row,
      channel_name: channelName,
      is_active: Boolean(existing?.is_active || row.is_active),
      sort_order: leadChannelSort(channelName),
    });
  }

  const normalizedLeadChannels = LEAD_CHANNEL_ORDER.map((channelName) => channelMap.get(channelName)).filter(Boolean);

  return NextResponse.json({
    goals: goals.data ?? [],
    scorecard: approvedScorecard,
    scorecardActuals,
    budgets: filteredBudgets,
    leadChannels: normalizedLeadChannels,
    habits: habits.data ?? [],
    rocks: rocks.data ?? [],
    issues: issues.data ?? [],
    todos: todos.data ?? [],
  });
}
