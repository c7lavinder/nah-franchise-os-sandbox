export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

/**
 * GET /api/territories/:TerritorySlug/performance?period=t1|t3|t12
 *
 * Returns KPIs, funnel, and property lists for the Performance tab.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ TerritorySlug: string }> }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const { TerritorySlug } = await params;
  const period = request.nextUrl.searchParams.get("period") ?? "t3";
  const supabase = createServerClient();

  // Date range
  const now = new Date();
  let periodStart: Date;
  if (period === "t1") periodStart = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  else if (period === "t12") periodStart = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  else periodStart = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
  const periodStartISO = periodStart.toISOString();

  // 1. All non-archived properties (paginate in 1000-row chunks)
  type PropRow = {
    PropertyId: number;
    Status: string;
    Inserted: string | null;
    Address1: string | null;
    LeadCategory: string | null;
  };
  let properties: PropRow[] = [];
  let offset = 0;
  while (true) {
    const { data: page } = await supabase
      .from("ms_properties")
      .select("PropertyId, Status, Inserted, Address1, LeadCategory")
      .eq("TerritorySlug", TerritorySlug)
      .eq("Archived", false)
      .order("PropertyId")
      .range(offset, offset + 999);
    if (!page || page.length === 0) break;
    properties = properties.concat(page as PropRow[]);
    if (page.length < 1000) break;
    offset += 1000;
  }

  const propertyIds = properties.map((p) => p.PropertyId);
  const propMap = new Map(properties.map((p) => [p.PropertyId, p]));

  if (propertyIds.length === 0) {
    return NextResponse.json({
      kpis: null,
      funnel: [],
      soldProperties: [],
      inventoryProperties: [],
      leadCategories: {},
      period,
    });
  }

  // 2. Inventory rows with purchase dates
  type InvRow = { PropertyId: number; Inv_PurchaseDate: string; Inv_SellDate: string | null };
  let inventory: InvRow[] = [];
  for (let i = 0; i < propertyIds.length; i += 500) {
    const { data: page } = await supabase
      .from("ms_property_inventory")
      .select("PropertyId, Inv_PurchaseDate, Inv_SellDate")
      .in("PropertyId", propertyIds.slice(i, i + 500))
      .not("Inv_PurchaseDate", "is", null);
    if (page) inventory = inventory.concat(page as InvRow[]);
  }

  // 3. Status history for funnel + leads entered
  type HistRow = { PropertyId: number; NewStatus: string | null; Inserted: string };
  let statusHistory: HistRow[] = [];
  for (let i = 0; i < propertyIds.length; i += 500) {
    const { data: page } = await supabase
      .from("ms_property_status_history")
      .select("PropertyId, NewStatus, Inserted")
      .in("PropertyId", propertyIds.slice(i, i + 500))
      .gte("Inserted", periodStartISO);
    if (page) statusHistory = statusHistory.concat(page as HistRow[]);
  }

  // 4. Leads Entered = unique properties that entered Stage 1 during the period
  const enteredStage1 = new Set<number>();
  for (const h of statusHistory) {
    if (h.NewStatus === "1") enteredStage1.add(h.PropertyId);
  }
  const leadsEntered = enteredStage1.size;

  // 5. Funnel — cumulative reach
  const stageOrder = ["1", "2", "3", "4", "5 Contract", "6 Purchase"];
  const stageRank: Record<string, number> = {};
  stageOrder.forEach((s, i) => {
    stageRank[s] = i;
  });

  const highestStageByProperty = new Map<number, number>();
  for (const h of statusHistory) {
    const rank = stageRank[h.NewStatus ?? ""];
    if (rank !== undefined) {
      const current = highestStageByProperty.get(h.PropertyId) ?? -1;
      if (rank > current) highestStageByProperty.set(h.PropertyId, rank);
    }
  }

  const funnelStages = stageOrder.map((stage, i) => {
    const count = [...highestStageByProperty.values()].filter((r) => r >= i).length;
    return { stage, count };
  });

  // 6. Sold in period + Active Inventory
  const soldInPeriod: InvRow[] = [];
  const activeInventoryRows: InvRow[] = [];
  for (const inv of inventory) {
    const sellDate = inv.Inv_SellDate ? new Date(inv.Inv_SellDate) : null;
    if (sellDate && sellDate >= periodStart) soldInPeriod.push(inv);
    if (!inv.Inv_SellDate) activeInventoryRows.push(inv);
  }

  // 7. Profit — for properties sold in the PERIOD (not YTD)
  const soldPeriodIds = soldInPeriod.map((s) => s.PropertyId);
  type CalcRow = { PropertyId: number; Calculated_Inv_Profit: number | null; Calculated_Arv: number | null };
  let soldCalcs: CalcRow[] = [];
  if (soldPeriodIds.length > 0) {
    for (let i = 0; i < soldPeriodIds.length; i += 500) {
      const { data: page } = await supabase
        .from("ms_property_calculations")
        .select("PropertyId, Calculated_Inv_Profit, Calculated_Arv")
        .in("PropertyId", soldPeriodIds.slice(i, i + 500));
      if (page) soldCalcs = soldCalcs.concat(page as CalcRow[]);
    }
  }
  const calcMap = new Map(soldCalcs.map((c) => [c.PropertyId, c]));

  let totalProfit = 0;
  let profitCount = 0;
  for (const c of soldCalcs) {
    if (c.Calculated_Inv_Profit != null) {
      totalProfit += Number(c.Calculated_Inv_Profit);
      profitCount++;
    }
  }
  const avgProfit = profitCount > 0 ? Math.round(totalProfit / profitCount) : null;

  // 8. Inventory calcs (for ARV on inventory list)
  let invCalcs: CalcRow[] = [];
  const invIds = activeInventoryRows.map((r) => r.PropertyId);
  if (invIds.length > 0) {
    for (let i = 0; i < invIds.length; i += 500) {
      const { data: page } = await supabase
        .from("ms_property_calculations")
        .select("PropertyId, Calculated_Inv_Profit, Calculated_Arv")
        .in("PropertyId", invIds.slice(i, i + 500));
      if (page) invCalcs = invCalcs.concat(page as CalcRow[]);
    }
  }
  const invCalcMap = new Map(invCalcs.map((c) => [c.PropertyId, c]));

  // 9. Cycle days
  const cycleDays: number[] = [];
  for (const inv of inventory) {
    if (inv.Inv_PurchaseDate && inv.Inv_SellDate) {
      const days = Math.round(
        (new Date(inv.Inv_SellDate).getTime() - new Date(inv.Inv_PurchaseDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (days > 0) cycleDays.push(days);
    }
  }
  cycleDays.sort((a, b) => a - b);

  // 10. Lead category breakdown (for properties that entered stage 1+ in period)
  const leadCategories: Record<string, number> = {};
  for (const pid of enteredStage1) {
    const prop = propMap.get(pid);
    const cat = prop?.LeadCategory || "Unknown";
    leadCategories[cat] = (leadCategories[cat] || 0) + 1;
  }

  // 11. Build sold property list
  const soldProperties = soldInPeriod.map((inv) => {
    const prop = propMap.get(inv.PropertyId);
    const calc = calcMap.get(inv.PropertyId);
    const daysHeld = Math.round(
      (new Date(inv.Inv_SellDate!).getTime() - new Date(inv.Inv_PurchaseDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    return {
      propertyId: inv.PropertyId,
      address: prop?.Address1 ?? "Unknown",
      purchaseDate: inv.Inv_PurchaseDate,
      sellDate: inv.Inv_SellDate,
      daysHeld,
      profit: calc?.Calculated_Inv_Profit != null ? Math.round(Number(calc.Calculated_Inv_Profit)) : null,
      arv: calc?.Calculated_Arv != null ? Math.round(Number(calc.Calculated_Arv)) : null,
      leadCategory: prop?.LeadCategory ?? null,
    };
  });

  // 12. Build inventory property list
  const inventoryProperties = activeInventoryRows.map((inv) => {
    const prop = propMap.get(inv.PropertyId);
    const calc = invCalcMap.get(inv.PropertyId);
    const daysHeld = Math.round((now.getTime() - new Date(inv.Inv_PurchaseDate).getTime()) / (1000 * 60 * 60 * 24));
    return {
      propertyId: inv.PropertyId,
      address: prop?.Address1 ?? "Unknown",
      purchaseDate: inv.Inv_PurchaseDate,
      daysHeld,
      arv: calc?.Calculated_Arv != null ? Math.round(Number(calc.Calculated_Arv)) : null,
      projectedProfit: calc?.Calculated_Inv_Profit != null ? Math.round(Number(calc.Calculated_Inv_Profit)) : null,
      leadCategory: prop?.LeadCategory ?? null,
    };
  });

  return NextResponse.json({
    kpis: {
      leadsEntered,
      activeInventory: activeInventoryRows.length,
      soldInPeriod: soldInPeriod.length,
      avgProfit,
      totalProfit: profitCount > 0 ? Math.round(totalProfit) : null,
      medianCycleDays: cycleDays.length > 0 ? cycleDays[Math.floor(cycleDays.length / 2)] : null,
      conversionRate:
        enteredStage1.size > 0
          ? Number(
              (([...highestStageByProperty.values()].filter((r) => r >= 3).length / enteredStage1.size) * 100).toFixed(
                1
              )
            )
          : null,
    },
    funnel: funnelStages,
    soldProperties,
    inventoryProperties,
    leadCategories,
    period,
  });
}
