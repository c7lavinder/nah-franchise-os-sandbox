export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

type PropRow = {
  PropertyId: number;
  TerritorySlug?: string | null;
  Status: string;
  Inserted: string | null;
  Address1: string | null;
  LeadCategory: string | null;
  LeadType?: string | null;
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
type LeadListPropertyRow = { PropertyId: number; LeadType: string | null; Inserted: string };
type Stage0OriginRow = { PropertyId: number; original_stage0_inserted_at: string };

const STAGE_ORDER = ["1", "2", "3", "4", "5 Contract", "6 Purchase"];
const MONTHLY_STAGE_BENCHMARKS: Partial<Record<string, number>> = {
  "1": 30,
  "4": 10,
  "5 Contract": 1,
  "6 Purchase": 1,
};
const MONTHLY_LEAD_LIST_BENCHMARK = 1000;
const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
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

function computeFunnel(history: HistRow[], propertyFilter?: Set<number>) {
  const stageRank: Record<string, number> = {};
  STAGE_ORDER.forEach((s, i) => {
    stageRank[s] = i;
  });

  const highest = new Map<number, number>();
  for (const h of history) {
    if (propertyFilter && !propertyFilter.has(h.PropertyId)) continue;
    const key = stageKey(h.NewStatus);
    if (!key) continue;
    const rank = stageRank[key];
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

function benchmarkMultiplier(period: string, now: Date): number | null {
  if (period === "t1") return 1;
  if (period === "t3") return 3;
  if (period === "t12") return 12;
  if (period === "ytd") return now.getMonth() + 1;
  return null;
}

function buildBenchmark(stage: string, period: string, now: Date): number | null {
  const monthly = MONTHLY_STAGE_BENCHMARKS[stage];
  const multiplier = benchmarkMultiplier(period, now);
  if (monthly == null || multiplier == null) return null;
  return monthly * multiplier;
}

function buildLeadListBenchmark(period: string, now: Date): number | null {
  const multiplier = benchmarkMultiplier(period, now);
  if (multiplier == null) return null;
  return MONTHLY_LEAD_LIST_BENCHMARK * multiplier;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ TerritorySlug: string }> }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const { TerritorySlug } = await params;
  const period = request.nextUrl.searchParams.get("period") ?? "t3";
  const leadCategoryFilter = request.nextUrl.searchParams.get("leadCategory") ?? null;
  const supabase = createServerClient();

  const now = new Date();
  const todayEndExclusive = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  let periodStart: Date;
  let periodEndExclusive: Date;
  let prevPeriodStart: Date;
  let prevPeriodEndExclusive: Date;

  if (period === "all") {
    periodStart = new Date(2000, 0, 1);
    periodEndExclusive = todayEndExclusive;
    prevPeriodStart = new Date(2000, 0, 1);
    prevPeriodEndExclusive = periodStart;
  } else if (period === "ytd") {
    periodStart = new Date(now.getFullYear(), 0, 1);
    periodEndExclusive = todayEndExclusive;
    prevPeriodStart = new Date(now.getFullYear() - 1, 0, 1);
    prevPeriodEndExclusive = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate() + 1);
  } else {
    const periodMonths = period === "t1" ? 1 : period === "t12" ? 12 : 3;
    periodStart = new Date(now.getFullYear(), now.getMonth() - periodMonths, now.getDate());
    periodEndExclusive = todayEndExclusive;
    prevPeriodStart = new Date(now.getFullYear(), now.getMonth() - periodMonths * 2, now.getDate());
    prevPeriodEndExclusive = periodStart;
  }
  const periodStartISO = periodStart.toISOString();
  const prevPeriodStartISO = prevPeriodStart.toISOString();
  const periodEndExclusiveISO = periodEndExclusive.toISOString();
  const prevPeriodEndExclusiveISO = prevPeriodEndExclusive.toISOString();
  const shouldCapStatusHistory = period !== "all" && period !== "ytd";

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
    return NextResponse.json(
      {
        kpis: null,
        funnel: [],
        prevFunnel: [],
        soldProperties: [],
        inventoryProperties: [],
        leadCategories: {},
        leadListBuilding: {
          total: 0,
          benchmark: buildLeadListBenchmark(period, now),
          benchmarkMonthly: MONTHLY_LEAD_LIST_BENCHMARK,
          leadTypes: {},
        },
        period,
      },
      { headers: NO_STORE_HEADERS }
    );
  }

  // Lead category filter — build a set of matching property IDs
  let filteredPropertyIds: Set<number> | undefined;
  if (leadCategoryFilter) {
    filteredPropertyIds = new Set<number>();
    for (const p of properties) {
      if ((p.LeadCategory || "Unknown") === leadCategoryFilter) filteredPropertyIds.add(p.PropertyId);
    }
  }

  // Stage 0 / Lead List Building — kept separate from the Stage 1+ performance funnel.
  const rawLeadListRows = await fetchPaged<LeadListPropertyRow>((from, to) =>
    supabase
      .from("ms_lead_list_properties")
      .select("PropertyId, LeadType, Inserted")
      .eq("TerritorySlug", TerritorySlug)
      .gte("Inserted", periodStartISO)
      .lt("Inserted", periodEndExclusiveISO)
      .range(from, to)
  );
  const stage0OriginRows = await fetchPaged<Stage0OriginRow>((from, to) =>
    supabase
      .from("ms_property_stage0_origins")
      .select("PropertyId, original_stage0_inserted_at")
      .eq("TerritorySlug", TerritorySlug)
      .gte("original_stage0_inserted_at", periodStartISO)
      .lt("original_stage0_inserted_at", periodEndExclusiveISO)
      .range(from, to)
  );

  const leadListTypeByPropertyId = new Map<number, string>();
  for (const row of rawLeadListRows) {
    leadListTypeByPropertyId.set(row.PropertyId, row.LeadType || "Unknown");
  }

  const originIdsMissingRawLeadType = stage0OriginRows
    .map((row) => row.PropertyId)
    .filter((id) => !leadListTypeByPropertyId.has(id));

  for (let i = 0; i < originIdsMissingRawLeadType.length; i += 500) {
    const { data: originProps } = await supabase
      .from("ms_properties")
      .select("PropertyId, LeadType")
      .in("PropertyId", originIdsMissingRawLeadType.slice(i, i + 500));
    for (const prop of (originProps ?? []) as Pick<PropRow, "PropertyId" | "LeadType">[]) {
      leadListTypeByPropertyId.set(prop.PropertyId, prop.LeadType || "Unknown");
    }
  }

  const leadListTypes: Record<string, number> = {};
  for (const leadType of leadListTypeByPropertyId.values()) {
    leadListTypes[leadType] = (leadListTypes[leadType] || 0) + 1;
  }
  const leadListBenchmark = buildLeadListBenchmark(period, now);

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

  // 3. Status history — fetch current and previous windows separately.
  // Supabase caps each select at 1,000 rows by default; paginate so YTD does not
  // truncate early in high-volume territories.
  async function fetchStatusHistory(startISO: string, endISO?: string): Promise<HistRow[]> {
    let history: HistRow[] = [];
    for (let i = 0; i < propertyIds.length; i += 500) {
      let offset = 0;
      while (true) {
        let historyQuery = supabase
          .from("ms_property_status_history")
          .select("PropertyId, NewStatus, Inserted")
          .in("PropertyId", propertyIds.slice(i, i + 500))
          .gte("Inserted", startISO)
          .order("Inserted")
          .range(offset, offset + 999);
        if (endISO) historyQuery = historyQuery.lt("Inserted", endISO);
        const { data: page } = await historyQuery;
        if (!page || page.length === 0) break;
        history = history.concat(page as HistRow[]);
        if (page.length < 1000) break;
        offset += 1000;
      }
    }
    return history;
  }

  const currentHistory = await fetchStatusHistory(
    periodStartISO,
    shouldCapStatusHistory ? periodEndExclusiveISO : undefined
  );
  const prevHistory = await fetchStatusHistory(
    prevPeriodStartISO,
    shouldCapStatusHistory ? prevPeriodEndExclusiveISO : periodStartISO
  );

  // 4. Leads Entered = Stage 1 entries in current period
  const enteredStage1 = new Set<number>();
  for (const h of currentHistory) {
    if (stageKey(h.NewStatus) === "1") {
      if (!filteredPropertyIds || filteredPropertyIds.has(h.PropertyId)) {
        enteredStage1.add(h.PropertyId);
      }
    }
  }

  // 5. Funnels — scoped to Stage 1 entrants so counts match KPI cards
  const funnelFilter = new Set<number>();
  for (const id of enteredStage1) {
    if (!filteredPropertyIds || filteredPropertyIds.has(id)) funnelFilter.add(id);
  }
  const prevEnteredStage1 = new Set<number>();
  for (const h of prevHistory) {
    if (stageKey(h.NewStatus) === "1") {
      if (!filteredPropertyIds || filteredPropertyIds.has(h.PropertyId)) {
        prevEnteredStage1.add(h.PropertyId);
      }
    }
  }
  const funnel = computeFunnel(currentHistory, funnelFilter);
  const prevFunnel = computeFunnel(prevHistory, prevEnteredStage1);

  // Median comparison across active territories for the same period/category.
  const { data: activeTerritories } = await supabase
    .from("territories")
    .select("TerritorySlug")
    .eq("status", "active")
    .eq("ExcludeFromGlobalCalculations", false);
  const activeTerritorySlugs = ((activeTerritories ?? []) as { TerritorySlug: string }[])
    .map((t) => t.TerritorySlug)
    .filter(Boolean);

  let comparisonRows = STAGE_ORDER.map((stage) => ({
    stage,
    medianActiveTerritory: null as number | null,
    benchmark: buildBenchmark(stage, period, now),
  }));
  let activeTerritoryComparisonCount = 0;

  if (activeTerritorySlugs.length > 0) {
    let comparisonProperties: Pick<PropRow, "PropertyId" | "TerritorySlug" | "LeadCategory">[] = [];
    for (let i = 0; i < activeTerritorySlugs.length; i += 500) {
      const { data: page } = await supabase
        .from("ms_properties")
        .select("PropertyId, TerritorySlug, LeadCategory")
        .in("TerritorySlug", activeTerritorySlugs.slice(i, i + 500))
        .eq("Archived", false);
      if (page)
        comparisonProperties = comparisonProperties.concat(
          page as Pick<PropRow, "PropertyId" | "TerritorySlug" | "LeadCategory">[]
        );
    }

    const comparisonPropertyIds = comparisonProperties.map((p) => p.PropertyId);
    const comparisonPropMap = new Map(comparisonProperties.map((p) => [p.PropertyId, p]));

    let comparisonHistory: HistRow[] = [];
    for (let i = 0; i < comparisonPropertyIds.length; i += 500) {
      const { data: page } = await supabase
        .from("ms_property_status_history")
        .select("PropertyId, NewStatus, Inserted")
        .in("PropertyId", comparisonPropertyIds.slice(i, i + 500))
        .gte("Inserted", periodStart.toISOString())
        .lt("Inserted", periodEndExclusiveISO);
      if (page) comparisonHistory = comparisonHistory.concat(page as HistRow[]);
    }

    const historiesByTerritory = new Map<string, HistRow[]>();
    const enteredStage1ByTerritory = new Map<string, Set<number>>();

    for (const h of comparisonHistory) {
      const prop = comparisonPropMap.get(h.PropertyId);
      const territory = prop?.TerritorySlug;
      if (!territory) continue;
      if (leadCategoryFilter && (prop?.LeadCategory || "Unknown") !== leadCategoryFilter) continue;

      const rows = historiesByTerritory.get(territory) ?? [];
      rows.push(h);
      historiesByTerritory.set(territory, rows);

      if (stageKey(h.NewStatus) === "1") {
        const entered = enteredStage1ByTerritory.get(territory) ?? new Set<number>();
        entered.add(h.PropertyId);
        enteredStage1ByTerritory.set(territory, entered);
      }
    }

    const stageCountsByStage = new Map<string, number[]>();
    activeTerritoryComparisonCount = activeTerritorySlugs.length;

    for (const slug of activeTerritorySlugs) {
      const history = historiesByTerritory.get(slug) ?? [];
      const entrants = enteredStage1ByTerritory.get(slug) ?? new Set<number>();
      const territoryFunnel = computeFunnel(history, entrants);
      for (const row of territoryFunnel) {
        const counts = stageCountsByStage.get(row.stage) ?? [];
        counts.push(row.count);
        stageCountsByStage.set(row.stage, counts);
      }
    }

    comparisonRows = STAGE_ORDER.map((stage) => ({
      stage,
      medianActiveTerritory: median(stageCountsByStage.get(stage) ?? []),
      benchmark: buildBenchmark(stage, period, now),
    }));
  }

  // 6. Sold in period + Active Inventory
  const soldInPeriod: InvRow[] = [];
  const activeInventoryRows: InvRow[] = [];
  for (const inv of inventory) {
    if (filteredPropertyIds && !filteredPropertyIds.has(inv.PropertyId)) continue;
    const sellDate = inv.Inv_SellDate ? new Date(inv.Inv_SellDate) : null;
    if (sellDate && sellDate >= periodStart && sellDate < periodEndExclusive) soldInPeriod.push(inv);
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
    return isInRange(inv.Inv_PurchaseDate, periodStart, periodEndExclusive);
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
  const leadCategoryPropertyIds = new Set<number>();
  for (const h of currentHistory) {
    if (filteredPropertyIds && !filteredPropertyIds.has(h.PropertyId)) continue;
    if (stageKey(h.NewStatus) === "1" && !leadCategoryPropertyIds.has(h.PropertyId)) {
      leadCategoryPropertyIds.add(h.PropertyId);
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
        label: isSold ? "Sold" : inv.Inv_Status === "Rented" ? "Rented" : "Sold",
        date: inv.Inv_SellDate,
        days: dBtwn(inv.Inv_ListDate, inv.Inv_SellDate),
      },
    ];
    const currentStageEntry = [...stages].reverse().find((stage) => stage.date);
    const currentStage = currentStageEntry?.label ?? inv.Inv_Status ?? null;
    const currentStageDays = currentStageEntry?.date
      ? Math.max(0, Math.round((now.getTime() - new Date(currentStageEntry.date).getTime()) / (1000 * 60 * 60 * 24)))
      : totalDays;

    return { stages, currentPhase: currentStage, currentStageDays, totalDays, purchaseDate: inv.Inv_PurchaseDate };
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

  return NextResponse.json(
    {
      kpis: {
        leadsEntered: enteredStage1.size,
        leadProgression: conversionRate,
        avgLeadToPurchase,
        avgCycleDays,
        activeInventory: activeInventoryRows.length,
        purchasedInPeriod: purchasedInPeriod.length,
        soldInPeriod: soldInPeriod.length,
        avgProfit: profitCount > 0 ? Math.round(totalProfit / profitCount) : null,
        totalProfit: profitCount > 0 ? Math.round(totalProfit) : null,
        conversionRate,
      },
      funnel,
      prevFunnel,
      comparisonRows,
      activeTerritoryComparisonCount,
      soldProperties,
      inventoryProperties,
      leadCategories,
      leadListBuilding: {
        total: leadListTypeByPropertyId.size,
        benchmark: leadListBenchmark,
        benchmarkMonthly: MONTHLY_LEAD_LIST_BENCHMARK,
        leadTypes: leadListTypes,
      },
      leadCategoryFilter,
      period,
    },
    { headers: NO_STORE_HEADERS }
  );
}
