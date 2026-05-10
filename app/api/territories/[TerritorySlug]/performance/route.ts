export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

/**
 * GET /api/territories/:TerritorySlug/performance?period=t1|t3|t12
 *
 * Coaching dashboard with time-filtered KPIs:
 * - T1: last 1 month
 * - T3: last 3 months (default)
 * - T12: last 12 months
 *
 * KPIs:
 * - Purchased: properties with Inv_PurchaseDate in period
 * - Sold: properties with Inv_SellDate in period
 * - Active Inventory: purchased but not sold (all time)
 * - Avg Profit: average Calculated_Inv_Profit for properties sold in period
 * - Leads Entered: properties inserted in period (non-dead)
 * - Conversion: properties reaching stage 4+ / total stage 1+ in period
 *
 * Funnel: counts from ms_property_status_history — how many entered each stage in period
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ TerritorySlug: string }> }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const { TerritorySlug } = await params;
  const period = request.nextUrl.searchParams.get("period") ?? "t3";
  const supabase = createServerClient();

  // Calculate date range
  const now = new Date();
  let periodStart: Date;
  if (period === "t1") {
    periodStart = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  } else if (period === "t12") {
    periodStart = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  } else {
    periodStart = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
  }
  const periodStartISO = periodStart.toISOString();
  const ytdStart = new Date(now.getFullYear(), 0, 1).toISOString();

  // 1. Get all properties for this territory
  const { data: properties } = await supabase
    .from("ms_properties")
    .select("PropertyId, Status, Inserted")
    .eq("TerritorySlug", TerritorySlug);

  const propertyIds = (properties ?? []).map((p) => p.PropertyId);

  if (propertyIds.length === 0) {
    return NextResponse.json({
      kpis: {
        purchasedYTD: 0,
        soldYTD: 0,
        activeInventory: 0,
        avgProfit: 0,
        totalProfit: 0,
        leadsInPeriod: 0,
        conversionRate: null,
        medianCycleDays: null,
      },
      funnel: {},
      period,
    });
  }

  // 2. Fetch inventory data for all properties in this territory
  const { data: inventory } = await supabase
    .from("ms_property_inventory")
    .select("PropertyId, Inv_PurchaseDate, Inv_SellDate")
    .in("PropertyId", propertyIds);

  // 3. Compute KPIs from inventory dates
  let purchasedYTD = 0;
  let soldYTD = 0;
  let activeInventory = 0;
  const soldYTDPropertyIds: number[] = [];

  for (const inv of inventory ?? []) {
    const purchaseDate = inv.Inv_PurchaseDate ? new Date(inv.Inv_PurchaseDate) : null;
    const sellDate = inv.Inv_SellDate ? new Date(inv.Inv_SellDate) : null;

    // Purchased YTD: has purchase date in this calendar year
    if (purchaseDate && purchaseDate >= new Date(ytdStart)) {
      purchasedYTD++;
    }

    // Sold YTD: has sell date in this calendar year
    if (sellDate && sellDate >= new Date(ytdStart)) {
      soldYTD++;
      soldYTDPropertyIds.push(inv.PropertyId);
    }

    // Active Inventory: purchased but not sold
    if (purchaseDate && !sellDate) {
      activeInventory++;
    }
  }

  // 4. Avg Profit — only for properties sold YTD
  let avgProfit = 0;
  let totalProfit = 0;
  if (soldYTDPropertyIds.length > 0) {
    const { data: calcs } = await supabase
      .from("ms_property_calculations")
      .select("Calculated_Inv_Profit")
      .in("PropertyId", soldYTDPropertyIds.slice(0, 500))
      .not("Calculated_Inv_Profit", "is", null);

    for (const c of calcs ?? []) {
      totalProfit += Number(c.Calculated_Inv_Profit ?? 0);
    }
    avgProfit = soldYTDPropertyIds.length > 0 ? Math.round(totalProfit / soldYTDPropertyIds.length) : 0;
    totalProfit = Math.round(totalProfit);
  }

  // 5. Cycle days for sold properties (purchase → sell)
  const cycleDays: number[] = [];
  for (const inv of inventory ?? []) {
    if (inv.Inv_PurchaseDate && inv.Inv_SellDate) {
      const days = Math.round(
        (new Date(inv.Inv_SellDate).getTime() - new Date(inv.Inv_PurchaseDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (days > 0) cycleDays.push(days);
    }
  }
  cycleDays.sort((a, b) => a - b);
  const medianCycleDays = cycleDays.length > 0 ? cycleDays[Math.floor(cycleDays.length / 2)] : null;

  // 6. Leads entered in period (non-dead properties inserted in time window)
  const leadsInPeriod = (properties ?? []).filter((p) => {
    if (!p.Inserted) return false;
    return new Date(p.Inserted) >= periodStart && !p.Status.startsWith("0");
  }).length;

  // 7. Conversion rate for the period
  // Properties that entered stage 4+ in period / properties that entered stage 1+ in period
  const { data: statusHistory } = await supabase
    .from("ms_property_status_history")
    .select("PropertyId, NewStatus, Inserted")
    .in("PropertyId", propertyIds)
    .gte("Inserted", periodStartISO);

  // Unique properties that hit each milestone in period
  const hitStage1Plus = new Set<number>();
  const hitStage4Plus = new Set<number>();
  for (const h of statusHistory ?? []) {
    const s = h.NewStatus;
    if (s && !s.startsWith("0")) {
      hitStage1Plus.add(h.PropertyId);
    }
    if (s === "4" || s === "5 Contract" || s === "6 Purchase") {
      hitStage4Plus.add(h.PropertyId);
    }
  }
  const conversionRate =
    hitStage1Plus.size > 0 ? Number(((hitStage4Plus.size / hitStage1Plus.size) * 100).toFixed(1)) : null;

  // 8. Funnel — count properties that entered each stage in the period
  const funnel: Record<string, number> = {};
  const stageOrder = ["0 Lead List", "1", "2", "3", "4", "5 Contract", "6 Purchase"];
  for (const stage of stageOrder) {
    funnel[stage] = 0;
  }
  for (const h of statusHistory ?? []) {
    if (h.NewStatus && stageOrder.includes(h.NewStatus)) {
      funnel[h.NewStatus] = (funnel[h.NewStatus] || 0) + 1;
    }
  }

  return NextResponse.json({
    kpis: {
      purchasedYTD,
      soldYTD,
      activeInventory,
      avgProfit,
      totalProfit,
      leadsInPeriod,
      conversionRate,
      medianCycleDays,
    },
    funnel,
    period,
  });
}
