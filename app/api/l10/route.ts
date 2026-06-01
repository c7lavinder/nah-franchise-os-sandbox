export const dynamic = "force-dynamic";

/**
 * GET /api/l10
 *
 * Leadership L10 view for FranDev:
 * - Dev sales cadence is biweekly.
 * - Coaching cadence is weekly.
 * - Stage 0 lead-list volume uses the aggregate ms_lead_list_counts table so
 *   the page does not need to scan the raw 900k+ MasterSuite property list.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

type Territory = {
  TerritorySlug: string;
  Nickname: string | null;
  region: string | null;
};

type PipelineStateRow = {
  assigned_user_id: string | null;
  current_stage_id: string | null;
  entered_pipeline_at: string | null;
  entered_current_stage_at: string | null;
};

type StageRow = {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
  is_terminal: boolean;
};

type HistoryRow = {
  moved_by_user_id: string | null;
  to_stage_id: string | null;
  created_at: string;
};

type UserRow = {
  id: string;
  full_name: string | null;
  role: string | null;
};

type PropertyRow = {
  PropertyId: number;
  TerritorySlug: string | null;
};

type StatusHistoryRow = {
  PropertyId: number;
  NewStatus: string | null;
  Inserted: string | null;
};

type InventoryRow = {
  PropertyId: number;
  Inv_PurchaseDate: string | null;
};

type LeadListRow = {
  TerritorySlug: string;
  month: string;
  count: number;
};

const SALES_PIPELINE_ID = "a0000000-0000-0000-0000-000000000001";
const MONTHLY_STAGE1_TARGET = 30;
const MONTHLY_STAGE4_TARGET = 10;
const MONTHLY_PURCHASE_TARGET = 1;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
};

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
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

function pct(actual: number, goal: number): number {
  if (goal <= 0) return 0;
  return Math.round((actual / goal) * 100);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[mid];
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function displayName(first?: string | null, last?: string | null): string | null {
  const name = [first, last].filter(Boolean).join(" ").trim();
  return name || null;
}

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const supabase = createServerClient();
  const now = new Date();
  const todayEnd = addDays(startOfDay(now), 1);
  const coachingStart = addDays(todayEnd, -7);
  const devStart = addDays(todayEnd, -14);
  const monthStart = startOfMonth(now);

  const [
    territoriesRes,
    ownersRes,
    fallbackOwnersRes,
    salesStagesRes,
    salesStatesRes,
    salesHistoryRes,
    usersRes,
    leadListRes,
  ] = await Promise.all([
    supabase
      .from("territories")
      .select("TerritorySlug, Nickname, region")
      .eq("status", "active")
      .eq("ExcludeFromGlobalCalculations", false)
      .order("Nickname"),
    supabase
      .from("current_territory_owners")
      .select("TerritorySlug, first_name, last_name, role")
      .eq("territory_status", "active"),
    supabase.from("franchise_owners").select("TerritorySlug, full_name").eq("status", "active"),
    supabase
      .from("pipeline_stages")
      .select("id, slug, name, sort_order, is_terminal")
      .eq("pipeline_id", SALES_PIPELINE_ID)
      .order("sort_order"),
    supabase
      .from("journey_pipeline_state")
      .select("assigned_user_id, current_stage_id, entered_pipeline_at, entered_current_stage_at")
      .eq("pipeline_id", SALES_PIPELINE_ID)
      .eq("is_active", true),
    supabase
      .from("pipeline_stage_history")
      .select("moved_by_user_id, to_stage_id, created_at")
      .gte("created_at", devStart.toISOString())
      .eq("was_revert", false),
    supabase.from("users").select("id, full_name, role").eq("is_active", true).eq("is_real_user", true),
    supabase
      .from("ms_lead_list_counts")
      .select("TerritorySlug, month, count")
      .gte("month", monthStart.toISOString().slice(0, 10)),
  ]);

  if (territoriesRes.error) return NextResponse.json({ error: territoriesRes.error.message }, { status: 500 });

  const territories = ((territoriesRes.data ?? []) as Territory[]).filter((t) => Boolean(t.TerritorySlug));
  const activeSlugs = territories.map((t) => t.TerritorySlug);
  const activeSlugSet = new Set(activeSlugs);

  const users = (usersRes.data ?? []) as UserRow[];
  const userNameById = new Map(users.map((u) => [u.id, u.full_name || "Unassigned"]));
  const stageRows = (salesStagesRes.data ?? []) as StageRow[];
  const stageById = new Map(stageRows.map((s) => [s.id, s]));
  const nonTerminalStageIds = new Set(stageRows.filter((s) => !s.is_terminal).map((s) => s.id));
  const salesStates = ((salesStatesRes.data ?? []) as PipelineStateRow[]).filter((s) =>
    s.current_stage_id ? nonTerminalStageIds.has(s.current_stage_id) : true
  );
  const salesHistory = ((salesHistoryRes.data ?? []) as HistoryRow[]).filter((row) =>
    row.to_stage_id ? stageById.has(row.to_stage_id) : false
  );

  const ownerNamesByTerritory = new Map<string, string[]>();
  for (const row of (ownersRes.data ?? []) as Array<{
    TerritorySlug: string;
    first_name: string | null;
    last_name: string | null;
    role: string | null;
  }>) {
    const name = displayName(row.first_name, row.last_name);
    if (!name || !activeSlugSet.has(row.TerritorySlug)) continue;
    const list = ownerNamesByTerritory.get(row.TerritorySlug) ?? [];
    if (!list.includes(name)) list.push(name);
    ownerNamesByTerritory.set(row.TerritorySlug, list);
  }
  for (const row of (fallbackOwnersRes.data ?? []) as Array<{ TerritorySlug: string; full_name: string | null }>) {
    if (!row.full_name || !activeSlugSet.has(row.TerritorySlug) || ownerNamesByTerritory.has(row.TerritorySlug)) {
      continue;
    }
    ownerNamesByTerritory.set(row.TerritorySlug, [row.full_name]);
  }

  const activeProspectsByRep = new Map<string, number>();
  const stalledByRep = new Map<string, number>();
  const newProspectsByRep = new Map<string, number>();
  const stageCounts = new Map<string, number>();
  const stalledCutoff = addDays(todayEnd, -7);

  for (const state of salesStates) {
    const userId = state.assigned_user_id ?? "unassigned";
    activeProspectsByRep.set(userId, (activeProspectsByRep.get(userId) ?? 0) + 1);

    if (state.current_stage_id) {
      const stage = stageById.get(state.current_stage_id);
      const stageName = stage?.name ?? "Unmapped";
      stageCounts.set(stageName, (stageCounts.get(stageName) ?? 0) + 1);
    }

    if (state.entered_pipeline_at && new Date(state.entered_pipeline_at) >= devStart) {
      newProspectsByRep.set(userId, (newProspectsByRep.get(userId) ?? 0) + 1);
    }
    if (state.entered_current_stage_at && new Date(state.entered_current_stage_at) < stalledCutoff) {
      stalledByRep.set(userId, (stalledByRep.get(userId) ?? 0) + 1);
    }
  }

  const advancesByRep = new Map<string, number>();
  for (const move of salesHistory) {
    const userId = move.moved_by_user_id ?? "unassigned";
    advancesByRep.set(userId, (advancesByRep.get(userId) ?? 0) + 1);
  }

  const repIds = new Set<string>([
    ...activeProspectsByRep.keys(),
    ...stalledByRep.keys(),
    ...newProspectsByRep.keys(),
    ...advancesByRep.keys(),
  ]);
  const repRows = [...repIds]
    .map((id) => ({
      userId: id,
      name: id === "unassigned" ? "Unassigned" : (userNameById.get(id) ?? "Unknown"),
      activeProspects: activeProspectsByRep.get(id) ?? 0,
      newProspects: newProspectsByRep.get(id) ?? 0,
      stageAdvances: advancesByRep.get(id) ?? 0,
      stalledProspects: stalledByRep.get(id) ?? 0,
    }))
    .sort((a, b) => b.stalledProspects - a.stalledProspects || b.activeProspects - a.activeProspects);

  const stageTotals = [...stageCounts.entries()]
    .map(([stage, count]) => ({ stage, count }))
    .sort((a, b) => {
      const aStage = stageRows.find((s) => s.name === a.stage)?.sort_order ?? 999;
      const bStage = stageRows.find((s) => s.name === b.stage)?.sort_order ?? 999;
      return aStage - bStage;
    });

  const territoryByPropertyId = new Map<number, string>();
  let monthHistory: StatusHistoryRow[] = [];
  const purchaseIds = new Set<number>();
  let inventoryRows: InventoryRow[] = [];

  let offset = 0;
  while (true) {
    const { data: rows } = await supabase
      .from("ms_property_status_history")
      .select("PropertyId, NewStatus, Inserted")
      .gte("Inserted", monthStart.toISOString())
      .lt("Inserted", todayEnd.toISOString())
      .order("Inserted")
      .range(offset, offset + 999);
    if (!rows || rows.length === 0) break;
    monthHistory = monthHistory.concat(rows as StatusHistoryRow[]);
    if (rows.length < 1000) break;
    offset += 1000;
  }

  offset = 0;
  while (true) {
    const { data: rows } = await supabase
      .from("ms_property_inventory")
      .select("PropertyId, Inv_PurchaseDate")
      .not("Inv_PurchaseDate", "is", null)
      .gte("Inv_PurchaseDate", monthStart.toISOString())
      .lt("Inv_PurchaseDate", todayEnd.toISOString())
      .order("Inv_PurchaseDate")
      .range(offset, offset + 999);
    if (!rows || rows.length === 0) break;
    inventoryRows = inventoryRows.concat(rows as InventoryRow[]);
    if (rows.length < 1000) break;
    offset += 1000;
  }

  for (const row of inventoryRows) {
    if (row.PropertyId) purchaseIds.add(row.PropertyId);
  }

  const metricPropertyIds = [
    ...new Set([...monthHistory.map((row) => row.PropertyId), ...inventoryRows.map((row) => row.PropertyId)]),
  ];
  for (let i = 0; i < metricPropertyIds.length; i += 500) {
    const { data: props } = await supabase
      .from("ms_properties")
      .select("PropertyId, TerritorySlug")
      .in("PropertyId", metricPropertyIds.slice(i, i + 500))
      .eq("Archived", false);
    for (const prop of (props ?? []) as PropertyRow[]) {
      if (!prop.TerritorySlug || !activeSlugSet.has(prop.TerritorySlug)) continue;
      territoryByPropertyId.set(prop.PropertyId, prop.TerritorySlug);
    }
  }

  const stage1ByTerritory = new Map<string, Set<number>>();
  const stage4ByTerritory = new Map<string, Set<number>>();
  for (const row of monthHistory) {
    const territorySlug = territoryByPropertyId.get(row.PropertyId);
    if (!territorySlug || !activeSlugSet.has(territorySlug)) continue;
    const key = stageKey(row.NewStatus);
    if (key === "1") {
      const set = stage1ByTerritory.get(territorySlug) ?? new Set<number>();
      set.add(row.PropertyId);
      stage1ByTerritory.set(territorySlug, set);
    }
    if (key === "4" || key === "5 Contract" || key === "6 Purchase") {
      const set = stage4ByTerritory.get(territorySlug) ?? new Set<number>();
      set.add(row.PropertyId);
      stage4ByTerritory.set(territorySlug, set);
    }
  }

  const leadListByTerritory = new Map<string, number>();
  for (const row of (leadListRes.data ?? []) as LeadListRow[]) {
    if (!activeSlugSet.has(row.TerritorySlug)) continue;
    leadListByTerritory.set(
      row.TerritorySlug,
      (leadListByTerritory.get(row.TerritorySlug) ?? 0) + Number(row.count ?? 0)
    );
  }

  const purchasesByTerritory = new Map<string, number>();
  if (purchaseIds.size > 0) {
    const ids = [...purchaseIds];
    for (let i = 0; i < ids.length; i += 500) {
      const { data: props } = await supabase
        .from("ms_properties")
        .select("PropertyId, TerritorySlug")
        .in("PropertyId", ids.slice(i, i + 500));
      for (const prop of (props ?? []) as PropertyRow[]) {
        if (!prop.TerritorySlug || !activeSlugSet.has(prop.TerritorySlug)) continue;
        purchasesByTerritory.set(prop.TerritorySlug, (purchasesByTerritory.get(prop.TerritorySlug) ?? 0) + 1);
      }
    }
  }

  const territoryRows = territories.map((t) => {
    const stage1 = stage1ByTerritory.get(t.TerritorySlug)?.size ?? 0;
    const stage4 = stage4ByTerritory.get(t.TerritorySlug)?.size ?? 0;
    const purchases = purchasesByTerritory.get(t.TerritorySlug) ?? 0;
    const leadListInserted = leadListByTerritory.get(t.TerritorySlug) ?? 0;
    let focusReason = "On track";
    if (purchases < MONTHLY_PURCHASE_TARGET) focusReason = "No purchase this month";
    if (stage1 < MONTHLY_STAGE1_TARGET) focusReason = "Lead quantity below target";
    if (stage1 >= MONTHLY_STAGE1_TARGET && stage4 < MONTHLY_STAGE4_TARGET) {
      focusReason = "Offer volume below target";
    }
    if (stage4 >= MONTHLY_STAGE4_TARGET && purchases < MONTHLY_PURCHASE_TARGET) {
      focusReason = "Closing or purchase execution";
    }

    return {
      slug: t.TerritorySlug,
      nickname: t.Nickname ?? t.TerritorySlug,
      region: t.region,
      owners: ownerNamesByTerritory.get(t.TerritorySlug) ?? [],
      leadListInserted,
      stage1,
      stage4,
      purchases,
      stage1Target: MONTHLY_STAGE1_TARGET,
      stage4Target: MONTHLY_STAGE4_TARGET,
      purchaseTarget: MONTHLY_PURCHASE_TARGET,
      stage1Pace: pct(stage1, MONTHLY_STAGE1_TARGET),
      stage4Pace: pct(stage4, MONTHLY_STAGE4_TARGET),
      purchasePace: pct(purchases, MONTHLY_PURCHASE_TARGET),
      focusReason,
    };
  });

  const focusTerritories = [...territoryRows]
    .filter((t) => t.focusReason !== "On track")
    .sort((a, b) => {
      if (a.purchases !== b.purchases) return a.purchases - b.purchases;
      if (a.stage4Pace !== b.stage4Pace) return a.stage4Pace - b.stage4Pace;
      return a.stage1Pace - b.stage1Pace;
    })
    .slice(0, 8);

  const stage1Values = territoryRows.map((t) => t.stage1);
  const stage4Values = territoryRows.map((t) => t.stage4);
  const purchaseValues = territoryRows.map((t) => t.purchases);

  return NextResponse.json(
    {
      cadences: {
        dev: { label: "Dev", cadence: "Biweekly", days: 14 },
        coaching: { label: "Coaching", cadence: "Weekly", days: 7, coaches: ["John", "Erin"] },
      },
      sales: {
        periodLabel: "Last 14 days",
        activeProspects: salesStates.length,
        newProspects: [...newProspectsByRep.values()].reduce((sum, value) => sum + value, 0),
        stageAdvances: salesHistory.length,
        stalledProspects: [...stalledByRep.values()].reduce((sum, value) => sum + value, 0),
        stageTotals,
        focusReps: repRows.slice(0, 5),
      },
      coaching: {
        periodLabel: "This month",
        weeklyLabel: "Weekly with John and Erin",
        activeTerritories: territoryRows.length,
        leadListInserted: territoryRows.reduce((sum, t) => sum + t.leadListInserted, 0),
        stage1: territoryRows.reduce((sum, t) => sum + t.stage1, 0),
        stage4: territoryRows.reduce((sum, t) => sum + t.stage4, 0),
        purchases: territoryRows.reduce((sum, t) => sum + t.purchases, 0),
        medianStage1: median(stage1Values),
        medianStage4: median(stage4Values),
        medianPurchases: median(purchaseValues),
        stage1Target: MONTHLY_STAGE1_TARGET,
        stage4Target: MONTHLY_STAGE4_TARGET,
        purchaseTarget: MONTHLY_PURCHASE_TARGET,
        focusTerritories,
      },
      territories: territoryRows,
      generatedAt: now.toISOString(),
      windows: {
        devStart: devStart.toISOString(),
        coachingStart: coachingStart.toISOString(),
        monthStart: monthStart.toISOString(),
      },
    },
    { headers: NO_STORE_HEADERS }
  );
}
