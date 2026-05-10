export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

/**
 * GET /api/territories/:TerritorySlug/performance
 *
 * Coaching dashboard: property funnel, financial KPIs, and construction EOS summary.
 * Minimal data for coaches to quickly see where a franchisee stands.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ TerritorySlug: string }> }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const { TerritorySlug } = await params;
  const supabase = createServerClient();

  // 1. Property funnel counts by status
  const { data: properties } = await supabase
    .from("ms_properties")
    .select("PropertyId, Status")
    .eq("TerritorySlug", TerritorySlug);

  const funnel: Record<string, number> = {};
  const activeStatuses = ["1", "2", "3", "4", "5 Contract", "6 Purchase"];
  const deadStatuses = ["0 No Deal", "0 No Offer", "0 Sell Later", "0 Trash", "0 Unresponsive"];
  let activeCount = 0;
  let deadCount = 0;

  for (const p of properties ?? []) {
    funnel[p.Status] = (funnel[p.Status] || 0) + 1;
    if (activeStatuses.includes(p.Status)) activeCount++;
    if (deadStatuses.includes(p.Status)) deadCount++;
  }

  // 2. Financial KPIs from calculations (for purchased properties)
  const purchasedIds = (properties ?? []).filter((p) => p.Status === "6 Purchase").map((p) => p.PropertyId);

  let avgProfit = 0;
  let totalProfit = 0;
  let profitCount = 0;
  let avgInventoryValue = 0;

  if (purchasedIds.length > 0) {
    const { data: calcs } = await supabase
      .from("ms_property_calculations")
      .select("PropertyId, Calculated_Inv_Profit, Calculated_Arv")
      .in("PropertyId", purchasedIds);

    for (const c of calcs ?? []) {
      if (c.Calculated_Inv_Profit != null) {
        totalProfit += Number(c.Calculated_Inv_Profit);
        profitCount++;
      }
      if (c.Calculated_Arv != null) {
        avgInventoryValue += Number(c.Calculated_Arv);
      }
    }
    avgProfit = profitCount > 0 ? totalProfit / profitCount : 0;
  }

  // 3. Inventory timeline — purchased properties with dates
  const { data: inventory } =
    purchasedIds.length > 0
      ? await supabase
          .from("ms_property_inventory")
          .select("PropertyId, Inv_PurchaseDate, Inv_SellDate, Inv_ConstructionStartDate, Inv_CompletionDate")
          .in("PropertyId", purchasedIds.slice(0, 200))
      : { data: [] };

  let soldCount = 0;
  let activeDealCount = 0;
  const cycleDays: number[] = [];
  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const ytdStart = new Date(now.getFullYear(), 0, 1);
  let purchasedYTD = 0;
  let soldYTD = 0;

  for (const inv of inventory ?? []) {
    const purchaseDate = inv.Inv_PurchaseDate ? new Date(inv.Inv_PurchaseDate) : null;
    const sellDate = inv.Inv_SellDate ? new Date(inv.Inv_SellDate) : null;

    if (sellDate) {
      soldCount++;
      if (sellDate >= ytdStart) soldYTD++;
      if (purchaseDate) {
        const days = Math.round((sellDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
        if (days > 0) cycleDays.push(days);
      }
    } else {
      activeDealCount++;
    }

    if (purchaseDate && purchaseDate >= ytdStart) purchasedYTD++;
  }

  // Median cycle days
  cycleDays.sort((a, b) => a - b);
  const medianCycleDays = cycleDays.length > 0 ? cycleDays[Math.floor(cycleDays.length / 2)] : null;

  // 4. Lead velocity — count of Stage 1+ properties by insertion date
  const { data: recentLeads } = await supabase
    .from("ms_properties")
    .select("Inserted")
    .eq("TerritorySlug", TerritorySlug)
    .gte("Inserted", threeMonthsAgo.toISOString())
    .not("Status", "like", "0%");

  const leadsT3 = recentLeads?.length ?? 0;

  // 5. Conversion rate: properties that reached stage 4+ / total stage 1+
  const stage1Plus = activeStatuses.reduce((sum, s) => sum + (funnel[s] || 0), 0);
  const stage4Plus = (funnel["4"] || 0) + (funnel["5 Contract"] || 0) + (funnel["6 Purchase"] || 0);
  const conversionRate = stage1Plus > 0 ? ((stage4Plus / stage1Plus) * 100).toFixed(1) : null;

  // 6. Construction EOS summary
  const [{ data: cRocks }, { data: cTodos }, { data: cIssues }, { data: cHabits }] = await Promise.all([
    supabase.from("ms_eos_construction_rocks").select("Id, Rock, Status").eq("TerritorySlug", TerritorySlug),
    supabase.from("ms_eos_construction_todos").select("Id, Todo, Done").eq("TerritorySlug", TerritorySlug),
    supabase.from("ms_eos_construction_issues").select("Id, Issue, Done").eq("TerritorySlug", TerritorySlug),
    supabase.from("ms_eos_construction_habits").select("*").eq("TerritorySlug", TerritorySlug).single(),
  ]);

  return NextResponse.json({
    funnel,
    kpis: {
      totalProperties: properties?.length ?? 0,
      activeDeals: activeDealCount,
      purchasedYTD,
      soldYTD,
      soldAllTime: soldCount,
      totalProfit: Math.round(totalProfit),
      avgProfit: Math.round(avgProfit),
      avgInventoryValue: Math.round(avgInventoryValue),
      medianCycleDays,
      leadsT3,
      conversionRate: conversionRate ? Number(conversionRate) : null,
    },
    constructionEos: {
      rocks: cRocks ?? [],
      todos: cTodos ?? [],
      issues: cIssues ?? [],
      habits: cHabits ?? null,
    },
  });
}
