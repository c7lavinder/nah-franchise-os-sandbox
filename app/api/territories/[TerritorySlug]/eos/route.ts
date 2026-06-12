export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { EosTerritoryLeadChannel } from "@/types/database";

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
  "High Equity",
  "Absentee Owners",
  "Probates",
  "Evictions",
  "City Citations",
  "Distressed Rentals",
  "Divorces",
  "Prospect Now",
  "Vacants",
  "Agent Listed",
  "FSBO",
  "Foreclosures",
  "Brokered Auctions",
  "Wholesalers",
  "Agents",
  "Industry Network",
  "Homelight",
  "Asset Managers",
  "Birddogs",
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
  "Social Platforms",
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
  const t3Start = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString();

  // Fetch all properties for this territory
  const { data: props } = await supabase
    .from("ms_properties")
    .select("PropertyId, Status, Inserted")
    .eq("TerritorySlug", TerritorySlug);

  if (!props || props.length === 0) return actuals;

  // T3 Leads Entered — properties inserted in last 3 months
  const leadsT3 = props.filter((p) => p.Inserted && p.Inserted >= t3Start).length;
  actuals["t3_leads_entered"] = String(leadsT3);

  // Active funnel counts
  const activeStatuses = ["1", "2", "3", "4", "5 Contract", "6 Purchase"];
  const stage1Plus = props.filter((p) => activeStatuses.includes(p.Status)).length;
  const stage4Plus = props.filter((p) => ["4", "5 Contract", "6 Purchase"].includes(p.Status)).length;

  // T3 S1 to S4 %
  if (stage1Plus > 0) {
    actuals["t3_s1_to_s4_pct"] = `${((stage4Plus / stage1Plus) * 100).toFixed(1)}%`;
  }

  // T3 Purchased — status "6 Purchase"
  const purchasedIds = props.filter((p) => p.Status === "6 Purchase").map((p) => p.PropertyId);
  actuals["t3_purchased"] = String(purchasedIds.length);

  // T3 AVG Inventory — active purchased (no sell date)
  if (purchasedIds.length > 0) {
    const { data: invRows } = await supabase
      .from("ms_property_inventory")
      .select("PropertyId, Inv_SellDate")
      .in("PropertyId", purchasedIds.slice(0, 500));

    const activeInv = (invRows ?? []).filter((r) => !r.Inv_SellDate).length;
    actuals["t3_avg_inventory"] = String(activeInv);

    // Cycle days from sold properties
    const soldRows = (invRows ?? []).filter((r) => r.Inv_SellDate);
    actuals["t3_purchased"] = String(purchasedIds.length);

    // T3 Gross Profit — from calculations
    const { data: calcs } = await supabase
      .from("ms_property_calculations")
      .select("Calculated_Inv_Profit")
      .in("PropertyId", purchasedIds.slice(0, 500))
      .not("Calculated_Inv_Profit", "is", null);

    const totalProfit = (calcs ?? []).reduce((sum, c) => sum + Number(c.Calculated_Inv_Profit ?? 0), 0);
    actuals["t3_gross_profit"] = `$${Math.round(totalProfit).toLocaleString()}`;
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
