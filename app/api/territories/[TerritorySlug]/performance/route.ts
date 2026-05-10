export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

type PropRow = {
  PropertyId: number;
  Status: string;
  Inserted: string | null;
  Address1: string | null;
  LeadCategory: string | null;
};
type InvRow = {
  PropertyId: number;
  Inv_Status: string | null;
  Inv_PurchaseDate: string;
  Inv_ConstructionStartDate: string | null;
  Inv_CompletionDate: string | null;
  Inv_ListDate: string | null;
  Inv_SellDate: string | null;
};
type HistRow = { PropertyId: number; NewStatus: string | null; Inserted: string };
type CalcRow = { PropertyId: number; Calculated_Inv_Profit: number | null; Calculated_Arv: number | null };

const STAGE_ORDER = ["1", "2", "3", "4", "5 Contract", "6 Purchase"];

function computeFunnel(history: HistRow[], propertyFilter?: Set<number>) {
  const stageRank: Record<string, number> = {};
  STAGE_ORDER.forEach((s, i) => {
    stageRank[s] = i;
  });

  const highest = new Map<number, number>();
  for (const h of history) {
    if (propertyFilter && !propertyFilter.has(h.PropertyId)) continue;
    const rank = stageRank[h.NewStatus ?? ""];
    if (rank !== undefined) {
      const cur = highest.get(h.PropertyId) ?? -1;
      if (rank > cur) highest.set(h.PropertyId, rank);
    }
  }

  return STAGE_ORDER.map((stage, i) => ({
    stage,
    count: [...highest.values()].filter((r) => r >= i).length,
  }));
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ TerritorySlug: string }> }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const { TerritorySlug } = await params;
  const period = request.nextUrl.searchParams.get("period") ?? "t3";
  const leadCategoryFilter = request.nextUrl.searchParams.get("leadCategory") ?? null;
  const supabase = createServerClient();

  const now = new Date();
  let periodStart: Date;
  let prevPeriodStart: Date;

  if (period === "all") {
    periodStart = new Date(2000, 0, 1);
    prevPeriodStart = new Date(2000, 0, 1);
  } else if (period === "ytd") {
    periodStart = new Date(now.getFullYear(), 0, 1);
    prevPeriodStart = new Date(now.getFullYear() - 1, 0, 1);
  } else {
    const periodMonths = period === "t1" ? 1 : period === "t12" ? 12 : 3;
    periodStart = new Date(now.getFullYear(), now.getMonth() - periodMonths, now.getDate());
    prevPeriodStart = new Date(now.getFullYear(), now.getMonth() - periodMonths * 2, now.getDate());
  }
  const periodStartISO = periodStart.toISOString();
  const prevPeriodStartISO = prevPeriodStart.toISOString();

  // 1. All non-archived properties (paginate)
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
      prevFunnel: [],
      soldProperties: [],
      inventoryProperties: [],
      leadCategories: {},
      period,
    });
  }

  // Lead category filter — build a set of matching property IDs
  let filteredPropertyIds: Set<number> | undefined;
  if (leadCategoryFilter) {
    filteredPropertyIds = new Set<number>();
    for (const p of properties) {
      if ((p.LeadCategory || "Unknown") === leadCategoryFilter) filteredPropertyIds.add(p.PropertyId);
    }
  }

  // 2. Inventory rows with purchase dates
  let inventory: InvRow[] = [];
  for (let i = 0; i < propertyIds.length; i += 500) {
    const { data: page } = await supabase
      .from("ms_property_inventory")
      .select(
        "PropertyId, Inv_Status, Inv_PurchaseDate, Inv_ConstructionStartDate, Inv_CompletionDate, Inv_ListDate, Inv_SellDate"
      )
      .in("PropertyId", propertyIds.slice(i, i + 500))
      .not("Inv_PurchaseDate", "is", null);
    if (page) inventory = inventory.concat(page as InvRow[]);
  }

  // 3. Status history — fetch BOTH current AND previous period in one pass
  let allHistory: HistRow[] = [];
  for (let i = 0; i < propertyIds.length; i += 500) {
    const { data: page } = await supabase
      .from("ms_property_status_history")
      .select("PropertyId, NewStatus, Inserted")
      .in("PropertyId", propertyIds.slice(i, i + 500))
      .gte("Inserted", prevPeriodStartISO);
    if (page) allHistory = allHistory.concat(page as HistRow[]);
  }

  // Split into current and previous period
  const currentHistory = allHistory.filter((h) => new Date(h.Inserted) >= periodStart);
  const prevHistory = allHistory.filter((h) => {
    const d = new Date(h.Inserted);
    return d >= prevPeriodStart && d < periodStart;
  });

  // 4. Leads Entered = Stage 1 entries in current period
  const enteredStage1 = new Set<number>();
  for (const h of currentHistory) {
    if (h.NewStatus === "1") {
      if (!filteredPropertyIds || filteredPropertyIds.has(h.PropertyId)) {
        enteredStage1.add(h.PropertyId);
      }
    }
  }

  // 5. Funnels — current + previous, with optional lead category filter
  const funnel = computeFunnel(currentHistory, filteredPropertyIds);
  const prevFunnel = computeFunnel(prevHistory, filteredPropertyIds);

  // 6. Sold in period + Active Inventory
  const soldInPeriod: InvRow[] = [];
  const activeInventoryRows: InvRow[] = [];
  for (const inv of inventory) {
    if (filteredPropertyIds && !filteredPropertyIds.has(inv.PropertyId)) continue;
    const sellDate = inv.Inv_SellDate ? new Date(inv.Inv_SellDate) : null;
    if (sellDate && sellDate >= periodStart) soldInPeriod.push(inv);
    if (!inv.Inv_SellDate) activeInventoryRows.push(inv);
  }

  // 7. Profit for sold in period
  const soldPeriodIds = soldInPeriod.map((s) => s.PropertyId);
  let soldCalcs: CalcRow[] = [];
  for (let i = 0; i < soldPeriodIds.length; i += 500) {
    const { data: page } = await supabase
      .from("ms_property_calculations")
      .select("PropertyId, Calculated_Inv_Profit, Calculated_Arv")
      .in("PropertyId", soldPeriodIds.slice(i, i + 500));
    if (page) soldCalcs = soldCalcs.concat(page as CalcRow[]);
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

  // 8. Inventory calcs
  let invCalcs: CalcRow[] = [];
  const invIds = activeInventoryRows.map((r) => r.PropertyId);
  for (let i = 0; i < invIds.length; i += 500) {
    const { data: page } = await supabase
      .from("ms_property_calculations")
      .select("PropertyId, Calculated_Inv_Profit, Calculated_Arv")
      .in("PropertyId", invIds.slice(i, i + 500));
    if (page) invCalcs = invCalcs.concat(page as CalcRow[]);
  }
  const invCalcMap = new Map(invCalcs.map((c) => [c.PropertyId, c]));

  // 9. Cycle days (purchase → sell) for sold properties in period
  const cycleDays: number[] = [];
  for (const inv of soldInPeriod) {
    const days = Math.round(
      (new Date(inv.Inv_SellDate!).getTime() - new Date(inv.Inv_PurchaseDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (days > 0) cycleDays.push(days);
  }
  cycleDays.sort((a, b) => a - b);
  const avgCycleDays =
    cycleDays.length > 0 ? Math.round(cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length) : null;

  // 9b. Lead-to-purchase days (Inserted → Inv_PurchaseDate) for purchased in period
  const purchasedInPeriod = inventory.filter((inv) => {
    if (filteredPropertyIds && !filteredPropertyIds.has(inv.PropertyId)) return false;
    return new Date(inv.Inv_PurchaseDate) >= periodStart;
  });
  const leadToPurchaseDays: number[] = [];
  for (const inv of purchasedInPeriod) {
    const prop = propMap.get(inv.PropertyId);
    if (prop?.Inserted) {
      const days = Math.round(
        (new Date(inv.Inv_PurchaseDate).getTime() - new Date(prop.Inserted).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (days >= 0) leadToPurchaseDays.push(days);
    }
  }
  const avgLeadToPurchase =
    leadToPurchaseDays.length > 0
      ? Math.round(leadToPurchaseDays.reduce((a, b) => a + b, 0) / leadToPurchaseDays.length)
      : null;

  // 10. Lead category breakdown
  const leadCategories: Record<string, number> = {};
  for (const h of currentHistory) {
    if (h.NewStatus === "1") {
      const prop = propMap.get(h.PropertyId);
      const cat = prop?.LeadCategory || "Unknown";
      leadCategories[cat] = (leadCategories[cat] || 0) + 1;
    }
  }

  function dBtwn(a: string | null, b: string | null): number | null {
    if (!a || !b) return null;
    const d = Math.round((new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24));
    return d >= 0 ? d : null;
  }

  function buildJourney(inv: InvRow) {
    const totalDays = Math.round((now.getTime() - new Date(inv.Inv_PurchaseDate).getTime()) / (1000 * 60 * 60 * 24));
    const isSold = !!inv.Inv_SellDate;
    const status = inv.Inv_Status;

    const stages = [
      { label: "Purchased", date: inv.Inv_PurchaseDate, days: null as number | null },
      {
        label: "Construction",
        date: inv.Inv_ConstructionStartDate,
        days: dBtwn(inv.Inv_PurchaseDate, inv.Inv_ConstructionStartDate),
      },
      {
        label: "Complete",
        date: inv.Inv_CompletionDate,
        days: dBtwn(inv.Inv_ConstructionStartDate, inv.Inv_CompletionDate),
      },
      { label: "Listed", date: inv.Inv_ListDate, days: dBtwn(inv.Inv_CompletionDate, inv.Inv_ListDate) },
      {
        label: isSold ? "Sold" : status === "Rented" ? "Rented" : "Sold",
        date: inv.Inv_SellDate,
        days: dBtwn(inv.Inv_ListDate, inv.Inv_SellDate),
      },
    ];

    return { stages, currentPhase: status, totalDays, purchaseDate: inv.Inv_PurchaseDate };
  }

  // 11. Sold property list
  const soldProperties = soldInPeriod.map((inv) => {
    const prop = propMap.get(inv.PropertyId);
    const calc = calcMap.get(inv.PropertyId);
    const journey = buildJourney(inv);
    return {
      propertyId: inv.PropertyId,
      address: prop?.Address1 ?? "Unknown",
      ...journey,
      profit: calc?.Calculated_Inv_Profit != null ? Math.round(Number(calc.Calculated_Inv_Profit)) : null,
      arv: calc?.Calculated_Arv != null ? Math.round(Number(calc.Calculated_Arv)) : null,
      leadCategory: prop?.LeadCategory ?? null,
    };
  });

  // 12. Inventory property list
  const inventoryProperties = activeInventoryRows.map((inv) => {
    const prop = propMap.get(inv.PropertyId);
    const calc = invCalcMap.get(inv.PropertyId);
    const journey = buildJourney(inv);
    return {
      propertyId: inv.PropertyId,
      address: prop?.Address1 ?? "Unknown",
      ...journey,
      arv: calc?.Calculated_Arv != null ? Math.round(Number(calc.Calculated_Arv)) : null,
      projectedProfit: calc?.Calculated_Inv_Profit != null ? Math.round(Number(calc.Calculated_Inv_Profit)) : null,
      leadCategory: prop?.LeadCategory ?? null,
    };
  });

  // Conversion: S1 → S4+ in current period
  const s4PlusCount = funnel.find((f) => f.stage === "4")?.count ?? 0;
  const conversionRate = enteredStage1.size > 0 ? Number(((s4PlusCount / enteredStage1.size) * 100).toFixed(1)) : null;

  return NextResponse.json({
    kpis: {
      leadsEntered: enteredStage1.size,
      leadProgression: conversionRate,
      avgLeadToPurchase,
      avgCycleDays,
      activeInventory: activeInventoryRows.length,
      soldInPeriod: soldInPeriod.length,
      avgProfit: profitCount > 0 ? Math.round(totalProfit / profitCount) : null,
      totalProfit: profitCount > 0 ? Math.round(totalProfit) : null,
      conversionRate,
    },
    funnel,
    prevFunnel,
    soldProperties,
    inventoryProperties,
    leadCategories,
    leadCategoryFilter,
    period,
  });
}
