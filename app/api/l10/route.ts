export const dynamic = "force-dynamic";

/**
 * GET /api/l10
 *
 * Team-wide L10 operating view for FranDev sales + franchisee coaching.
 * This intentionally uses aggregate MasterSuite tables for Stage 0 lead-list
 * work so the page does not scan the raw 900k+ lead-list property set.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { quartileScoringAgent } from "@/lib/agents/quartile-scoring-agent";

type Territory = { TerritorySlug: string; Nickname: string | null; region: string | null };
type ScorecardMetric = { TerritorySlug: string; goal: string | null; actual: string | null };
type Rock = { TerritorySlug: string; status: string | null };
type Issue = {
  TerritorySlug: string;
  title: string;
  priority: string | null;
  status: string | null;
  created_at: string | null;
};
type Todo = { TerritorySlug: string; title: string; assignee: string | null; due_date: string | null; done: boolean };
type HistRow = { PropertyId: number; NewStatus: string | null; Inserted: string };
type PropertyRow = { PropertyId: number; TerritorySlug: string };
type InventoryRow = { PropertyId: number; Inv_ContractedPurchaseDate: string | null; Inv_PurchaseDate: string | null };
type L10PeriodKey = "T1" | "T3" | "T6" | "T12";

const PERIODS: Record<L10PeriodKey, { label: string; days: number }> = {
  T1: { label: "T1", days: 30 },
  T3: { label: "T3", days: 90 },
  T6: { label: "T6", days: 180 },
  T12: { label: "T12", days: 365 },
};

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

function monthStart(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function numberValue(value: string | null): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function periodFromRequest(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get("period")?.toUpperCase();
  if (requested === "T3" || requested === "T6" || requested === "T12") return requested;
  return "T1";
}

function monthlyPace(value: number, periodDays: number) {
  return Math.round((value / periodDays) * 30);
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

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const supabase = createServerClient();
  const now = new Date();
  const periodKey = periodFromRequest(request);
  const period = PERIODS[periodKey];
  const periodStart = daysAgo(period.days);
  const leadListPeriodMonthStart = monthStart(periodStart);
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const { data: territories, error: territoryError } = await supabase
    .from("territories")
    .select("TerritorySlug, Nickname, region")
    .eq("status", "active")
    .order("Nickname");

  if (territoryError) return NextResponse.json({ error: territoryError.message }, { status: 500 });

  const activeTerritories = (territories ?? []) as Territory[];
  const activeSlugs = activeTerritories.map((t) => t.TerritorySlug);

  if (activeSlugs.length === 0) {
    return NextResponse.json(
      {
        generatedAt: now.toISOString(),
        period: { key: periodKey, label: period.label, days: period.days },
        devSales: {
          activeProspects: 0,
          newProspectsPeriod: 0,
          movedPeriod: 0,
          stalledProspects: 0,
          stageCounts: [],
          repsToFocus: [],
        },
        coaching: {
          activeTerritories: 0,
          leadListInsertedMonth: 0,
          stage1Last30d: 0,
          stage3Last30d: 0,
          stage4Last30d: 0,
          contractsLast30d: 0,
          purchasesLast30d: 0,
          medianPurchasesT12: null,
          highPerformersT12: 0,
          territories: [],
          focusTerritories: [],
          opportunityTerritories: [],
        },
        operatingHealth: { avgScorecardHealth: null, openIssues: 0, openTodos: 0, rocksOnTrack: 0, rocksOffTrack: 0 },
        issues: [],
        todos: [],
      },
      { headers: NO_STORE_HEADERS }
    );
  }

  const [
    pipelinesRes,
    stagesRes,
    scorecardRes,
    rocksRes,
    issuesRes,
    todosRes,
    leadListRes,
    inventory30Res,
    inventoryT12Res,
  ] = await Promise.all([
    supabase.from("pipelines").select("id, slug").in("slug", ["sales", "runway", "onboarding"]),
    supabase.from("pipeline_stages").select("id, pipeline_id, slug, name, sort_order, is_terminal").order("sort_order"),
    supabase.from("eos_territory_scorecard").select("TerritorySlug, goal, actual").in("TerritorySlug", activeSlugs),
    supabase.from("eos_territory_rocks").select("TerritorySlug, status").in("TerritorySlug", activeSlugs),
    supabase
      .from("eos_territory_issues")
      .select("TerritorySlug, title, priority, status, created_at")
      .in("TerritorySlug", activeSlugs)
      .eq("status", "open")
      .order("created_at", { ascending: true }),
    supabase
      .from("eos_territory_todos")
      .select("TerritorySlug, title, assignee, due_date, done")
      .in("TerritorySlug", activeSlugs)
      .eq("done", false)
      .order("due_date", { ascending: true }),
    supabase
      .from("ms_lead_list_counts")
      .select("TerritorySlug, count")
      .in("TerritorySlug", activeSlugs)
      .gte("month", leadListPeriodMonthStart.toISOString().slice(0, 10)),
    supabase
      .from("ms_property_inventory")
      .select("PropertyId, Inv_ContractedPurchaseDate, Inv_PurchaseDate")
      .or(
        `Inv_ContractedPurchaseDate.gte.${periodStart.toISOString()},Inv_PurchaseDate.gte.${periodStart.toISOString()}`
      ),
    supabase
      .from("ms_property_inventory")
      .select("PropertyId, Inv_ContractedPurchaseDate, Inv_PurchaseDate")
      .not("Inv_PurchaseDate", "is", null)
      .gte("Inv_PurchaseDate", twelveMonthsAgo.toISOString()),
  ]);

  const pipelines = pipelinesRes.data ?? [];
  const stages = stagesRes.data ?? [];
  const pipelineIdBySlug = new Map(pipelines.map((p) => [p.slug, p.id]));
  const salesPipelineId = pipelineIdBySlug.get("sales") ?? "__none__";
  const salesStages = stages.filter((s) => s.pipeline_id === salesPipelineId && !s.is_terminal);
  const salesStageIds = salesStages.map((s) => s.id);

  const salesRows =
    salesStageIds.length > 0
      ? await fetchPaged<any>((from, to) =>
          supabase
            .from("journey_pipeline_state")
            .select("id, current_stage_id, entered_pipeline_at, entered_current_stage_at, updated_at, assigned_user_id")
            .eq("is_active", true)
            .in("current_stage_id", salesStageIds)
            .range(from, to)
        )
      : [];

  const assignedUserIds = [...new Set(salesRows.map((r) => r.assigned_user_id).filter(Boolean) as string[])];
  const { data: users } =
    assignedUserIds.length > 0
      ? await supabase.from("users").select("id, full_name").in("id", assignedUserIds)
      : { data: [] as { id: string; full_name: string | null }[] };
  const userNameById = new Map((users ?? []).map((u) => [u.id, u.full_name ?? "Unassigned"]));

  const stageCounts = salesStages.map((stage) => ({
    stage: stage.name,
    count: salesRows.filter((row) => row.current_stage_id === stage.id).length,
  }));
  const newProspectsPeriod = salesRows.filter((row) => new Date(row.entered_pipeline_at) >= periodStart).length;
  const moved14d = salesRows.filter(
    (row) => new Date(row.entered_current_stage_at ?? row.updated_at) >= periodStart
  ).length;
  const stalledRows = salesRows.filter((row) => new Date(row.entered_current_stage_at ?? row.updated_at) < periodStart);
  const stalledByRep = new Map<string, number>();
  for (const row of stalledRows) {
    const name = row.assigned_user_id ? (userNameById.get(row.assigned_user_id) ?? "Assigned") : "Unassigned";
    stalledByRep.set(name, (stalledByRep.get(name) ?? 0) + 1);
  }

  const scorecardBySlug = new Map<string, ScorecardMetric[]>();
  for (const metric of (scorecardRes.data ?? []) as ScorecardMetric[]) {
    if (!scorecardBySlug.has(metric.TerritorySlug)) scorecardBySlug.set(metric.TerritorySlug, []);
    scorecardBySlug.get(metric.TerritorySlug)!.push(metric);
  }

  const healthBySlug = new Map<string, number | null>();
  for (const territory of activeTerritories) {
    const metrics = scorecardBySlug.get(territory.TerritorySlug) ?? [];
    const measurable = metrics.filter((m) => numberValue(m.goal) != null && numberValue(m.actual) != null);
    const atGoal = measurable.filter((m) => numberValue(m.actual)! >= numberValue(m.goal)!).length;
    healthBySlug.set(
      territory.TerritorySlug,
      measurable.length > 0 ? Math.round((atGoal / measurable.length) * 100) : null
    );
  }

  const leadListBySlug = new Map<string, number>();
  for (const row of (leadListRes.data ?? []) as { TerritorySlug: string; count: number }[]) {
    leadListBySlug.set(row.TerritorySlug, (leadListBySlug.get(row.TerritorySlug) ?? 0) + Number(row.count ?? 0));
  }

  const history30 = await fetchPaged<HistRow>((from, to) =>
    supabase
      .from("ms_property_status_history")
      .select("PropertyId, NewStatus, Inserted")
      .gte("Inserted", periodStart.toISOString())
      .range(from, to)
  );
  const historyPropertyIds = [...new Set(history30.map((h) => h.PropertyId))];
  const inventoryPropertyIds = [
    ...new Set([...(inventory30Res.data ?? []), ...(inventoryT12Res.data ?? [])].map((row) => row.PropertyId)),
  ];
  const propertyIdsToLookup = [...new Set([...historyPropertyIds, ...inventoryPropertyIds])];
  const propertyById = new Map<number, PropertyRow>();
  for (let i = 0; i < propertyIdsToLookup.length; i += 500) {
    const { data: props } = await supabase
      .from("ms_properties")
      .select("PropertyId, TerritorySlug")
      .in("PropertyId", propertyIdsToLookup.slice(i, i + 500))
      .in("TerritorySlug", activeSlugs)
      .eq("Archived", false);
    for (const prop of (props ?? []) as PropertyRow[]) propertyById.set(prop.PropertyId, prop);
  }

  const stage1BySlug = new Map<string, Set<number>>();
  const stage3BySlug = new Map<string, Set<number>>();
  const stage4BySlug = new Map<string, Set<number>>();
  for (const row of history30) {
    const prop = propertyById.get(row.PropertyId);
    if (!prop) continue;
    const key = stageKey(row.NewStatus);
    if (key === "1") {
      if (!stage1BySlug.has(prop.TerritorySlug)) stage1BySlug.set(prop.TerritorySlug, new Set());
      stage1BySlug.get(prop.TerritorySlug)!.add(row.PropertyId);
    }
    if (key === "3") {
      if (!stage3BySlug.has(prop.TerritorySlug)) stage3BySlug.set(prop.TerritorySlug, new Set());
      stage3BySlug.get(prop.TerritorySlug)!.add(row.PropertyId);
    }
    if (key === "4") {
      if (!stage4BySlug.has(prop.TerritorySlug)) stage4BySlug.set(prop.TerritorySlug, new Set());
      stage4BySlug.get(prop.TerritorySlug)!.add(row.PropertyId);
    }
  }

  const contracts30BySlug = new Map<string, number>();
  const purchases30BySlug = new Map<string, number>();
  for (const row of (inventory30Res.data ?? []) as InventoryRow[]) {
    const prop = propertyById.get(row.PropertyId);
    if (!prop) continue;
    if (row.Inv_ContractedPurchaseDate && new Date(row.Inv_ContractedPurchaseDate) >= periodStart) {
      contracts30BySlug.set(prop.TerritorySlug, (contracts30BySlug.get(prop.TerritorySlug) ?? 0) + 1);
    }
    if (row.Inv_PurchaseDate && new Date(row.Inv_PurchaseDate) >= periodStart) {
      purchases30BySlug.set(prop.TerritorySlug, (purchases30BySlug.get(prop.TerritorySlug) ?? 0) + 1);
    }
  }

  const purchasesT12BySlug = new Map<string, number>();
  for (const row of (inventoryT12Res.data ?? []) as InventoryRow[]) {
    const prop = propertyById.get(row.PropertyId);
    if (!prop) continue;
    purchasesT12BySlug.set(prop.TerritorySlug, (purchasesT12BySlug.get(prop.TerritorySlug) ?? 0) + 1);
  }

  const issues = (issuesRes.data ?? []) as Issue[];
  const todos = (todosRes.data ?? []) as Todo[];
  const issuesBySlug = new Map<string, number>();
  for (const issue of issues) issuesBySlug.set(issue.TerritorySlug, (issuesBySlug.get(issue.TerritorySlug) ?? 0) + 1);
  const todosBySlug = new Map<string, number>();
  for (const todo of todos) todosBySlug.set(todo.TerritorySlug, (todosBySlug.get(todo.TerritorySlug) ?? 0) + 1);

  const territoryDiagnostics = activeTerritories.map((territory) => {
    const slug = territory.TerritorySlug;
    const health = healthBySlug.get(slug) ?? null;
    const purchasesT12 = purchasesT12BySlug.get(slug) ?? 0;
    const purchases30 = purchases30BySlug.get(slug) ?? 0;
    const stage1 = stage1BySlug.get(slug)?.size ?? 0;
    const stage4 = stage4BySlug.get(slug)?.size ?? 0;
    const leadList = leadListBySlug.get(slug) ?? 0;
    const openIssues = issuesBySlug.get(slug) ?? 0;
    const openTodos = todosBySlug.get(slug) ?? 0;
    const severity =
      (purchases30 === 0 ? 4 : 0) +
      (purchasesT12 < 3 ? 3 : purchasesT12 < 10 ? 1 : 0) +
      (health != null && health < 60 ? 2 : 0) +
      openIssues +
      Math.min(openTodos, 2);

    return {
      slug,
      name: territory.Nickname || slug,
      region: territory.region,
      health,
      leadListInsertedMonth: leadList,
      stage1Last30d: stage1,
      stage3Last30d: stage3BySlug.get(slug)?.size ?? 0,
      stage4Last30d: stage4,
      contractsLast30d: contracts30BySlug.get(slug) ?? 0,
      purchasesLast30d: purchases30,
      purchasesT12,
      openIssues,
      openTodos,
      severity,
      opportunityScore: leadList + stage1 * 10 + stage4 * 20 - purchases30 * 50,
    };
  });
  const diagnosticsBySlug = new Map(territoryDiagnostics.map((territory) => [territory.slug, territory]));
  const scoringDiagnostics = territoryDiagnostics.map((territory) => ({
    ...territory,
    leadListInsertedMonth: monthlyPace(territory.leadListInsertedMonth, period.days),
    stage1Last30d: monthlyPace(territory.stage1Last30d, period.days),
    stage3Last30d: monthlyPace(territory.stage3Last30d, period.days),
    stage4Last30d: monthlyPace(territory.stage4Last30d, period.days),
    contractsLast30d: monthlyPace(territory.contractsLast30d, period.days),
    purchasesLast30d: monthlyPace(territory.purchasesLast30d, period.days),
  }));
  const scoredTerritories = quartileScoringAgent.assignQuartiles(scoringDiagnostics).map((territory) => ({
    ...territory,
    ...diagnosticsBySlug.get(territory.slug),
    quartile: territory.quartile,
    score: territory.score,
    rank: territory.rank,
    status: territory.status,
    leadWorkRate: territory.leadWorkRate,
    coachingFlag: territory.coachingFlag,
    coachingReason: territory.coachingReason,
    scoreFactors: territory.scoreFactors,
  }));

  const rockRows = (rocksRes.data ?? []) as Rock[];
  const healthValues = [...healthBySlug.values()].filter((v): v is number => v !== null);
  const purchasesT12Values = scoredTerritories.map((t) => t.purchasesT12);

  return NextResponse.json(
    {
      generatedAt: now.toISOString(),
      period: { key: periodKey, label: period.label, days: period.days },
      devSales: {
        activeProspects: salesRows.length,
        newProspectsPeriod,
        movedPeriod: moved14d,
        stalledProspects: stalledRows.length,
        stageCounts,
        repsToFocus: [...stalledByRep.entries()]
          .map(([name, stalled]) => ({ name, stalled }))
          .sort((a, b) => b.stalled - a.stalled)
          .slice(0, 5),
      },
      coaching: {
        activeTerritories: activeTerritories.length,
        leadListInsertedMonth: sum([...leadListBySlug.values()]),
        stage1Last30d: sum([...stage1BySlug.values()].map((set) => set.size)),
        stage3Last30d: sum([...stage3BySlug.values()].map((set) => set.size)),
        stage4Last30d: sum([...stage4BySlug.values()].map((set) => set.size)),
        contractsLast30d: sum([...contracts30BySlug.values()]),
        purchasesLast30d: sum([...purchases30BySlug.values()]),
        medianPurchasesT12: median(purchasesT12Values),
        highPerformersT12: scoredTerritories.filter((t) => t.purchasesT12 >= 10).length,
        territories: scoredTerritories,
        focusTerritories: [...scoredTerritories].sort((a, b) => b.severity - a.severity).slice(0, 6),
        opportunityTerritories: [...scoredTerritories]
          .filter((t) => t.leadListInsertedMonth > 0 || t.stage1Last30d > 0 || t.stage4Last30d > 0)
          .sort((a, b) => b.opportunityScore - a.opportunityScore)
          .slice(0, 6),
      },
      operatingHealth: {
        avgScorecardHealth: healthValues.length > 0 ? Math.round(sum(healthValues) / healthValues.length) : null,
        openIssues: issues.length,
        openTodos: todos.length,
        rocksOnTrack: rockRows.filter((rock) => rock.status === "on_track").length,
        rocksOffTrack: rockRows.filter((rock) => rock.status === "off_track").length,
      },
      issues: issues.slice(0, 10),
      todos: todos.slice(0, 10),
    },
    { headers: NO_STORE_HEADERS }
  );
}
