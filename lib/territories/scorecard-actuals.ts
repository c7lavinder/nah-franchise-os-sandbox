import type { SupabaseClient } from "@supabase/supabase-js";

type PropRow = {
  PropertyId: number;
  Status: string | null;
  Inserted: string | null;
  Archived?: boolean | null;
};

type HistRow = {
  PropertyId: number;
  NewStatus: string | null;
  Inserted: string;
};

type InvRow = {
  PropertyId: number;
  Inv_PurchaseDate: string;
  Inv_SellDate: string | null;
};

type CalcRow = {
  PropertyId: number;
  Calculated_Inv_Profit: number | null;
};

const STAGE_ORDER = ["1", "2", "3", "4", "5 Contract", "6 Purchase"];

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

function computeFunnel(history: HistRow[], propertyFilter: Set<number>) {
  const stageRank: Record<string, number> = {};
  STAGE_ORDER.forEach((stage, index) => {
    stageRank[stage] = index;
  });

  const highest = new Map<number, number>();
  for (const row of history) {
    if (!propertyFilter.has(row.PropertyId)) continue;
    const key = stageKey(row.NewStatus);
    if (!key) continue;
    const rank = stageRank[key];
    if (rank === undefined) continue;
    const current = highest.get(row.PropertyId) ?? -1;
    if (rank > current) highest.set(row.PropertyId, rank);
  }

  return STAGE_ORDER.map((stage, index) => ({
    stage,
    count: [...highest.values()].filter((rank) => rank >= index).length,
  }));
}

function formatCurrency(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function periodWindow(months: number, now = new Date()) {
  const endExclusive = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const start = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
  return { start, endExclusive };
}

function averageDailyInventory(inventory: InvRow[], start: Date, endExclusive: Date) {
  let total = 0;
  let days = 0;
  for (let day = new Date(start); day < endExclusive; day.setDate(day.getDate() + 1)) {
    const dayStart = new Date(day);
    const dayEnd = new Date(day);
    dayEnd.setDate(dayEnd.getDate() + 1);
    total += inventory.filter((row) => {
      const purchaseDate = new Date(row.Inv_PurchaseDate);
      const sellDate = row.Inv_SellDate ? new Date(row.Inv_SellDate) : null;
      return purchaseDate < dayEnd && (!sellDate || sellDate >= dayStart);
    }).length;
    days += 1;
  }
  return days > 0 ? Math.round(total / days) : 0;
}

export async function computeTerritoryScorecardActuals(
  supabase: SupabaseClient,
  TerritorySlug: string
): Promise<Record<string, string>> {
  const actuals: Record<string, string> = {};
  const t3 = periodWindow(3);
  const t12 = periodWindow(12);

  const properties = await fetchPaged<PropRow>((from, to) =>
    supabase
      .from("ms_properties")
      .select("PropertyId, Status, Inserted, Archived")
      .eq("TerritorySlug", TerritorySlug)
      .eq("Archived", false)
      .order("PropertyId")
      .range(from, to)
  );
  const propertyIds = properties.map((p) => p.PropertyId);
  if (propertyIds.length === 0) return actuals;

  let t3History: HistRow[] = [];
  for (let i = 0; i < propertyIds.length; i += 500) {
    const page = await fetchPaged<HistRow>((from, to) =>
      supabase
        .from("ms_property_status_history")
        .select("PropertyId, NewStatus, Inserted")
        .in("PropertyId", propertyIds.slice(i, i + 500))
        .gte("Inserted", t3.start.toISOString())
        .lt("Inserted", t3.endExclusive.toISOString())
        .order("Inserted")
        .range(from, to)
    );
    t3History = t3History.concat(page);
  }

  const enteredStage1 = new Set<number>();
  for (const row of t3History) {
    if (stageKey(row.NewStatus) === "1") enteredStage1.add(row.PropertyId);
  }
  actuals.t3_leads_entered = String(enteredStage1.size);

  const funnel = computeFunnel(t3History, enteredStage1);
  const s4Plus = funnel.find((row) => row.stage === "4")?.count ?? 0;
  if (enteredStage1.size > 0) {
    actuals.t3_s1_to_s4_pct = ((s4Plus / enteredStage1.size) * 100).toFixed(1);
  }

  let inventory: InvRow[] = [];
  for (let i = 0; i < propertyIds.length; i += 500) {
    const { data } = await supabase
      .from("ms_property_inventory")
      .select("PropertyId, Inv_PurchaseDate, Inv_SellDate")
      .in("PropertyId", propertyIds.slice(i, i + 500))
      .not("Inv_PurchaseDate", "is", null);
    if (data) inventory = inventory.concat(data as InvRow[]);
  }

  const purchasedT3 = inventory.filter((row) => {
    const purchaseDate = new Date(row.Inv_PurchaseDate);
    return purchaseDate >= t3.start && purchaseDate < t3.endExclusive;
  });
  actuals.t3_purchased = String(purchasedT3.length);

  actuals.t3_avg_inventory = String(averageDailyInventory(inventory, t3.start, t3.endExclusive));

  const soldT3 = inventory.filter((row) => {
    if (!row.Inv_SellDate) return false;
    const sellDate = new Date(row.Inv_SellDate);
    return sellDate >= t3.start && sellDate < t3.endExclusive;
  });

  let soldCalcs: CalcRow[] = [];
  const soldIds = soldT3.map((row) => row.PropertyId);
  for (let i = 0; i < soldIds.length; i += 500) {
    const { data } = await supabase
      .from("ms_property_calculations")
      .select("PropertyId, Calculated_Inv_Profit")
      .in("PropertyId", soldIds.slice(i, i + 500))
      .not("Calculated_Inv_Profit", "is", null);
    if (data) soldCalcs = soldCalcs.concat(data as CalcRow[]);
  }
  const totalProfit = soldCalcs.reduce((sum, row) => sum + Number(row.Calculated_Inv_Profit ?? 0), 0);
  if (soldCalcs.length > 0) actuals.t3_gross_profit = formatCurrency(totalProfit);

  const t12CycleDays = inventory
    .filter((row) => {
      if (!row.Inv_SellDate) return false;
      const sellDate = new Date(row.Inv_SellDate);
      return sellDate >= t12.start && sellDate < t12.endExclusive;
    })
    .map((row) =>
      Math.round((new Date(row.Inv_SellDate!).getTime() - new Date(row.Inv_PurchaseDate).getTime()) / 86400000)
    )
    .filter((days) => days > 0)
    .sort((a, b) => a - b);
  if (t12CycleDays.length > 0) {
    const middle = Math.floor(t12CycleDays.length / 2);
    const median =
      t12CycleDays.length % 2 === 1
        ? t12CycleDays[middle]
        : Math.round((t12CycleDays[middle - 1] + t12CycleDays[middle]) / 2);
    actuals.t12_median_cycle_days = String(median);
  }

  const { data: territory } = await supabase
    .from("territories")
    .select("ComplianceScore")
    .eq("TerritorySlug", TerritorySlug)
    .maybeSingle();
  if (territory?.ComplianceScore != null) {
    const complianceScore = Number(territory.ComplianceScore);
    if (Number.isFinite(complianceScore)) {
      actuals.t3_compliance_score = `${Math.round(complianceScore <= 1 ? complianceScore * 100 : complianceScore)}%`;
    }
  }

  return actuals;
}
