/**
 * Scout general-purpose data tools.
 *
 * Three primitives that subsume the old per-question tools:
 *   - get_entity(type, id)            → rich profile for one entity
 *   - query(entity, filter, limit?)   → structured filter on a collection
 *   - aggregate(entity, group_by, metric, filter?) → counts/avgs/sums
 *
 * The whitelist of entities + filterable / groupable fields lives here
 * so the LLM never assembles raw SQL. Adding a new field is a code
 * change, not a prompt change.
 */

import * as ghl from "@/lib/ghl";
import { createServerClient } from "@/lib/supabase/server";
import { generateFlags } from "@/lib/intelligence/flags";
import { getScoreRecommendations } from "@/lib/intelligence/recommendations";
import type { CandidateIntelligence, CallLog, ObjectionRegistry } from "@/lib/intelligence/types";

// ════════════════════════════════════════════════════════════════════
// SHARED TYPES
// ════════════════════════════════════════════════════════════════════

export type EntityType = "contact" | "territory" | "journey" | "opportunity";

export type QueryEntity =
  | "contacts"
  | "journeys"
  | "territories"
  | "opportunities"
  | "call_logs"
  | "alerts"
  | "objections"
  | "workflow_enrollments"
  | "inventory"
  | "properties";

export interface FilterOp {
  field: string;
  op: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "in" | "ilike" | "is_null" | "not_null";
  value?: unknown;
}

export interface QuerySpec {
  entity: QueryEntity;
  filters?: FilterOp[];
  order_by?: { field: string; direction: "asc" | "desc" };
  limit?: number;
}

export interface AggregateSpec {
  entity: QueryEntity;
  metric: "count" | "avg" | "sum" | "min" | "max";
  metric_field?: string; // required for non-count metrics
  group_by?: string;
  filters?: FilterOp[];
  period?: { field: string; from: string; to: string };
}

// ════════════════════════════════════════════════════════════════════
// FIELD WHITELIST — what the LLM can filter / group / order by
// ════════════════════════════════════════════════════════════════════

interface EntityConfig {
  table: string;
  /** Field name → Supabase column. Lets us alias logical → physical names. */
  filterable: Record<string, string>;
  groupable: string[];
  aggregatable: string[];
  defaultOrder: { field: string; direction: "asc" | "desc" };
}

const ENTITIES: Record<QueryEntity, EntityConfig> = {
  contacts: {
    table: "contacts",
    filterable: {
      ghl_contact_id: "ghl_contact_id",
      first_name: "first_name",
      last_name: "last_name",
      email: "email",
      phone: "phone",
      city: "city",
      state: "state",
      opportunity_source: "opportunity_source",
      created_at: "created_at",
      updated_at: "updated_at",
    },
    groupable: ["opportunity_source", "city", "state"],
    aggregatable: [],
    defaultOrder: { field: "updated_at", direction: "desc" },
  },
  journeys: {
    table: "journeys",
    filterable: {
      status: "status",
      primary_contact_id: "primary_contact_id",
      created_at: "created_at",
      updated_at: "updated_at",
    },
    groupable: ["status", "close_reason"],
    aggregatable: [],
    defaultOrder: { field: "updated_at", direction: "desc" },
  },
  territories: {
    table: "territories",
    filterable: {
      TerritorySlug: "TerritorySlug",
      Nickname: "Nickname",
      region: "region",
      status: "status",
      FranchiseAgreementDate: "FranchiseAgreementDate",
    },
    groupable: ["status", "region"],
    aggregatable: [],
    defaultOrder: { field: "Nickname", direction: "asc" },
  },
  opportunities: {
    // GHL-backed — query() short-circuits to a GHL fetch for this one
    table: "_ghl_opportunities",
    filterable: {
      pipeline_id: "pipelineId",
      stage_id: "stageId",
      status: "status",
    },
    groupable: ["status"],
    aggregatable: [],
    defaultOrder: { field: "updatedAt", direction: "desc" },
  },
  call_logs: {
    table: "call_logs",
    filterable: {
      contact_id: "contact_id",
      call_type: "call_type",
      called_at: "called_at",
      rep_confidence: "rep_confidence",
      red_flags_raised: "red_flags_raised",
    },
    groupable: ["call_type", "red_flags_raised"],
    aggregatable: ["rep_confidence"],
    defaultOrder: { field: "called_at", direction: "desc" },
  },
  alerts: {
    table: "inactivity_alerts",
    filterable: {
      alert_type: "alert_type",
      severity: "severity",
      user_id: "user_id",
      ghl_contact_id: "ghl_contact_id",
      pipeline_stage: "pipeline_stage",
      is_resolved: "is_resolved",
      created_at: "created_at",
    },
    groupable: ["alert_type", "severity", "pipeline_stage", "is_resolved"],
    aggregatable: [],
    defaultOrder: { field: "created_at", direction: "desc" },
  },
  objections: {
    table: "objection_registry",
    filterable: {
      contact_id: "contact_id",
      objection_type: "objection_type",
      stage_at_time: "stage_at_time",
      resolved: "resolved",
      created_at: "created_at",
    },
    groupable: ["objection_type", "stage_at_time", "resolved"],
    aggregatable: ["score_impact", "resolved"],
    defaultOrder: { field: "created_at", direction: "desc" },
  },
  workflow_enrollments: {
    table: "workflow_enrollments",
    filterable: {
      contact_id: "contact_id",
      workflow_id: "workflow_id",
      status: "status",
      current_day: "current_day",
      goal_achieved: "goal_achieved",
      enrolled_at: "enrolled_at",
    },
    groupable: ["status", "goal_achieved", "workflow_id"],
    aggregatable: ["current_day"],
    defaultOrder: { field: "enrolled_at", direction: "desc" },
  },
  inventory: {
    table: "ms_property_inventory",
    filterable: {
      TerritorySlug: "TerritorySlug",
      PropertyId: "PropertyId",
      Inv_Status: "Inv_Status",
      Inv_PurchaseDate: "Inv_PurchaseDate",
      Inv_SellDate: "Inv_SellDate",
      Inv_ConstructionStartDate: "Inv_ConstructionStartDate",
      Inv_CompletionDate: "Inv_CompletionDate",
      Inv_ListDate: "Inv_ListDate",
    },
    groupable: ["TerritorySlug", "Inv_Status"],
    aggregatable: ["PropertyId"],
    defaultOrder: { field: "Inv_PurchaseDate", direction: "desc" },
  },
  properties: {
    table: "ms_properties",
    filterable: {
      TerritorySlug: "TerritorySlug",
      PropertyId: "PropertyId",
      LeadCategory: "LeadCategory",
      LeadType: "LeadType",
      Status: "Status",
      Archived: "Archived",
      Inserted: "Inserted",
      PropertyType: "PropertyType",
    },
    groupable: ["TerritorySlug", "LeadCategory", "LeadType", "PropertyType"],
    aggregatable: ["Stage1Arv", "Stage1Price"],
    defaultOrder: { field: "Inserted", direction: "desc" },
  },
};

// ════════════════════════════════════════════════════════════════════
// query() — flexible filter, returns rows
// ════════════════════════════════════════════════════════════════════

export async function executeQuery(spec: QuerySpec): Promise<string> {
  const cfg = ENTITIES[spec.entity];
  if (!cfg) {
    return JSON.stringify({
      error: `Unknown entity '${spec.entity}'. Allowed: ${Object.keys(ENTITIES).join(", ")}`,
    });
  }

  // Opportunities live in GHL, not Supabase.
  if (spec.entity === "opportunities") {
    return executeOpportunityQuery(spec, cfg);
  }

  const supabase = createServerClient();
  let q = supabase.from(cfg.table).select("*");

  // Apply filters
  for (const f of spec.filters ?? []) {
    const col = cfg.filterable[f.field];
    if (!col) {
      return JSON.stringify({
        error: `Field '${f.field}' is not filterable on '${spec.entity}'. Allowed: ${Object.keys(cfg.filterable).join(", ")}`,
      });
    }
    q = applyFilter(q, col, f);
  }

  // Order
  const order = spec.order_by ?? cfg.defaultOrder;
  if (order) {
    const orderCol = cfg.filterable[order.field] ?? order.field;
    q = q.order(orderCol, { ascending: order.direction === "asc" });
  }

  // Limit (cap at 100)
  q = q.limit(Math.min(spec.limit ?? 25, 100));

  const { data, error } = await q;
  if (error) return JSON.stringify({ error: error.message });

  return JSON.stringify({
    entity: spec.entity,
    count: data?.length ?? 0,
    rows: data ?? [],
  });
}

async function executeOpportunityQuery(spec: QuerySpec, _cfg: EntityConfig): Promise<string> {
  // GHL search supports a small subset of filters
  const params: Parameters<typeof ghl.searchOpportunities>[0] = {};
  for (const f of spec.filters ?? []) {
    if (f.field === "pipeline_id" && f.op === "eq") params.pipelineId = String(f.value);
    if (f.field === "stage_id" && f.op === "eq") params.stageId = String(f.value);
    if (f.field === "status" && f.op === "eq") {
      params.status = String(f.value) as "open" | "won" | "lost" | "abandoned";
    }
  }
  const opps = await ghl.searchOpportunities(params);
  const limited = opps.slice(0, Math.min(spec.limit ?? 25, 100));
  return JSON.stringify({
    entity: "opportunities",
    count: limited.length,
    rows: limited,
  });
}

// ════════════════════════════════════════════════════════════════════
// aggregate() — count/avg/sum/min/max with optional grouping
// ════════════════════════════════════════════════════════════════════

export async function executeAggregate(spec: AggregateSpec): Promise<string> {
  const cfg = ENTITIES[spec.entity];
  if (!cfg) {
    return JSON.stringify({
      error: `Unknown entity '${spec.entity}'. Allowed: ${Object.keys(ENTITIES).join(", ")}`,
    });
  }

  // Validate group_by
  if (spec.group_by && !cfg.groupable.includes(spec.group_by)) {
    return JSON.stringify({
      error: `Cannot group '${spec.entity}' by '${spec.group_by}'. Allowed: ${cfg.groupable.join(", ") || "(none)"}`,
    });
  }

  // Validate metric field
  if (spec.metric !== "count") {
    if (!spec.metric_field) {
      return JSON.stringify({ error: `metric_field is required for ${spec.metric}` });
    }
    if (!cfg.aggregatable.includes(spec.metric_field)) {
      return JSON.stringify({
        error: `Field '${spec.metric_field}' is not aggregatable on '${spec.entity}'. Allowed: ${cfg.aggregatable.join(", ") || "(none)"}`,
      });
    }
  }

  // Opportunities aren't aggregated server-side (would require pulling everything from GHL).
  if (spec.entity === "opportunities") {
    return JSON.stringify({
      error:
        "Aggregations on 'opportunities' aren't supported — use query() then summarize, or use a Supabase-backed entity.",
    });
  }

  const supabase = createServerClient();

  // Build a SELECT that pulls just the columns we need.
  const selectCols: string[] = [];
  if (spec.group_by) selectCols.push(spec.group_by);
  if (spec.metric !== "count" && spec.metric_field) selectCols.push(spec.metric_field);
  if (selectCols.length === 0) selectCols.push("id");

  let q = supabase.from(cfg.table).select(selectCols.join(", "));

  for (const f of spec.filters ?? []) {
    const col = cfg.filterable[f.field];
    if (!col) {
      return JSON.stringify({
        error: `Field '${f.field}' is not filterable on '${spec.entity}'. Allowed: ${Object.keys(cfg.filterable).join(", ")}`,
      });
    }
    q = applyFilter(q, col, f);
  }

  // Period filter (date range on a specified column)
  if (spec.period) {
    const periodCol = cfg.filterable[spec.period.field] ?? spec.period.field;
    q = q.gte(periodCol, spec.period.from).lte(periodCol, spec.period.to);
  }

  const { data, error } = await q.limit(10000);
  if (error) return JSON.stringify({ error: error.message });

  const rows = (data ?? []) as unknown as Record<string, unknown>[];

  // Group + reduce in JS — avoids needing SQL aggregation primitives.
  if (spec.group_by) {
    const groups: Record<string, number[]> = {};
    for (const r of rows) {
      const key = String(r[spec.group_by] ?? "(null)");
      if (!groups[key]) groups[key] = [];
      const v = spec.metric === "count" ? 1 : Number(r[spec.metric_field!] ?? 0);
      groups[key].push(v);
    }
    const result = Object.entries(groups)
      .map(([k, vals]) => ({ key: k, value: reduce(spec.metric, vals) }))
      .sort((a, b) => b.value - a.value);
    return JSON.stringify({
      entity: spec.entity,
      metric: spec.metric,
      group_by: spec.group_by,
      groups: result,
    });
  }

  // Ungrouped: single number
  const vals = spec.metric === "count" ? rows.map(() => 1) : rows.map((r) => Number(r[spec.metric_field!] ?? 0));
  return JSON.stringify({
    entity: spec.entity,
    metric: spec.metric,
    value: reduce(spec.metric, vals),
  });
}

function reduce(metric: AggregateSpec["metric"], vals: number[]): number {
  if (vals.length === 0) return 0;
  switch (metric) {
    case "count":
      return vals.length;
    case "sum":
      return vals.reduce((a, b) => a + b, 0);
    case "avg":
      return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
    case "min":
      return Math.min(...vals);
    case "max":
      return Math.max(...vals);
  }
}

// ════════════════════════════════════════════════════════════════════
// Filter application — translates FilterOp → Supabase chain
//
// Supabase's PostgrestFilterBuilder narrows its generic on every chained
// call which makes a typed wrapper effectively impossible to compose.
// We accept a loosely-typed builder here — the field whitelist above
// is the real safety boundary, not the TS types.
// ════════════════════════════════════════════════════════════════════

interface FilterBuilder {
  eq(col: string, val: unknown): FilterBuilder;
  neq(col: string, val: unknown): FilterBuilder;
  gt(col: string, val: unknown): FilterBuilder;
  gte(col: string, val: unknown): FilterBuilder;
  lt(col: string, val: unknown): FilterBuilder;
  lte(col: string, val: unknown): FilterBuilder;
  in(col: string, vals: unknown[]): FilterBuilder;
  ilike(col: string, pattern: string): FilterBuilder;
  is(col: string, val: null | boolean): FilterBuilder;
  not(col: string, op: string, val: unknown): FilterBuilder;
}

function applyFilter<T extends FilterBuilder>(q: T, col: string, f: FilterOp): T {
  switch (f.op) {
    case "eq":
      return q.eq(col, f.value) as T;
    case "ne":
      return q.neq(col, f.value) as T;
    case "gt":
      return q.gt(col, f.value) as T;
    case "gte":
      return q.gte(col, f.value) as T;
    case "lt":
      return q.lt(col, f.value) as T;
    case "lte":
      return q.lte(col, f.value) as T;
    case "in":
      return q.in(col, Array.isArray(f.value) ? f.value : [f.value]) as T;
    case "ilike":
      return q.ilike(col, `%${String(f.value)}%`) as T;
    case "is_null":
      return q.is(col, null) as T;
    case "not_null":
      return q.not(col, "is", null) as T;
    default:
      return q;
  }
}

// ════════════════════════════════════════════════════════════════════
// get_entity() — rich profile for one entity
// ════════════════════════════════════════════════════════════════════

export async function executeGetEntity(type: EntityType, id: string): Promise<string> {
  switch (type) {
    case "contact":
      return getContactProfile(id);
    case "territory":
      return getTerritoryProfile(id);
    case "journey":
      return getJourneyProfile(id);
    case "opportunity":
      return getOpportunityProfile(id);
    default: {
      const _exhaustive: never = type;
      return JSON.stringify({ error: `Unknown entity type '${_exhaustive}'` });
    }
  }
}

async function getContactProfile(contactId: string): Promise<string> {
  try {
    const contact = await ghl.getContact(contactId);
    const supabase = createServerClient();

    const [intelRes, callsRes, objRes, journeysRes] = await Promise.all([
      supabase.from("candidate_intelligence").select("*").eq("contact_id", contactId).single(),
      supabase
        .from("call_logs")
        .select("*")
        .eq("contact_id", contactId)
        .order("called_at", { ascending: false })
        .limit(5),
      supabase.from("objection_registry").select("*").eq("contact_id", contactId).eq("resolved", false),
      supabase
        .from("journey_contacts")
        .select("journey_id, role, is_primary_decision_maker")
        .eq("contact_id", contactId)
        .is("left_at", null),
    ]);

    const out: Record<string, unknown> = { ghl: contact };

    if (intelRes.data) {
      const profile = intelRes.data as CandidateIntelligence;
      out.intelligence = {
        score: {
          total: profile.current_score,
          financial: profile.score_financial,
          operational: profile.score_operational,
          engagement: profile.score_engagement,
          momentum: profile.score_momentum,
        },
        flags: generateFlags(profile).map((f) => ({ text: f.text, severity: f.severity, category: f.category })),
        topRecommendations: getScoreRecommendations(profile)
          .slice(0, 3)
          .map((r) => ({ action: r.action, potentialPoints: r.potentialPoints, priority: r.priority })),
        liquidCapital: profile.liquid_capital,
        fundingPath: profile.funding_path,
        urgency: profile.urgency,
        trainualCompletion: profile.trainual_completion_pct,
      };
    }

    if (callsRes.data && callsRes.data.length > 0) {
      out.recentCalls = (callsRes.data as CallLog[]).map((c) => ({
        callType: c.call_type,
        calledAt: c.called_at,
        repConfidence: c.rep_confidence,
        redFlagsRaised: c.red_flags_raised,
      }));
    }

    if (objRes.data && objRes.data.length > 0) {
      out.unresolvedObjections = (objRes.data as ObjectionRegistry[]).map((o) => ({
        type: o.objection_type,
        detail: o.objection_detail,
        stage: o.stage_at_time,
      }));
    }

    if (journeysRes.data && journeysRes.data.length > 0) {
      out.journeys = journeysRes.data;
    }

    return JSON.stringify(out);
  } catch (err) {
    return JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" });
  }
}

async function getTerritoryProfile(slug: string): Promise<string> {
  try {
    const supabase = createServerClient();
    const [
      territoryRes,
      ownersRes,
      marketRes,
      goalsRes,
      scorecardRes,
      habitsRes,
      rocksRes,
      issuesRes,
      todosRes,
      statesRes,
      inventoryRes,
    ] = await Promise.all([
      supabase.from("territories").select("*").eq("TerritorySlug", slug).single(),
      supabase
        .from("territory_owners")
        .select("ghl_contact_id, role, start_date, end_date, transfer_notes")
        .eq("TerritorySlug", slug)
        .is("end_date", null),
      supabase
        .from("territory_market_data")
        .select("field_name, field_value, source, source_date")
        .eq("TerritorySlug", slug),
      supabase.from("eos_territory_goals").select("*").eq("TerritorySlug", slug),
      supabase.from("eos_territory_scorecard").select("*").eq("TerritorySlug", slug).order("sort_order"),
      supabase.from("eos_territory_habits").select("*").eq("TerritorySlug", slug).order("sort_order"),
      supabase
        .from("eos_territory_rocks")
        .select("*")
        .eq("TerritorySlug", slug)
        .order("created_at", { ascending: false }),
      supabase.from("eos_territory_issues").select("*").eq("TerritorySlug", slug).eq("is_done", false),
      supabase.from("eos_territory_todos").select("*").eq("TerritorySlug", slug).eq("is_done", false),
      supabase
        .from("journey_pipeline_state")
        .select("journey_id, current_stage_id, entered_current_stage_at, pipeline_stages(name), pipelines(name)")
        .eq("TerritorySlug", slug)
        .eq("is_active", true),
      // Performance summary: recent inventory for T12 snapshot
      supabase
        .from("ms_property_inventory")
        .select("PropertyId, Inv_PurchaseDate, Inv_SellDate, Inv_Status")
        .eq("TerritorySlug", slug)
        .not("Inv_PurchaseDate", "is", null)
        .order("Inv_PurchaseDate", { ascending: false })
        .limit(500),
    ]);

    if (territoryRes.error || !territoryRes.data) {
      return JSON.stringify({ error: `Territory '${slug}' not found` });
    }

    // Compute performance summary from inventory
    const now = new Date();
    const t12Start = new Date(now.getFullYear(), now.getMonth() - 12, now.getDate());
    const invRows = (inventoryRes.data ?? []) as {
      PropertyId: number;
      Inv_PurchaseDate: string;
      Inv_SellDate: string | null;
      Inv_Status: string | null;
    }[];
    const t12Purchases = invRows.filter((i) => new Date(i.Inv_PurchaseDate) >= t12Start).length;
    const t12Sales = invRows.filter((i) => i.Inv_SellDate && new Date(i.Inv_SellDate) >= t12Start).length;
    const activeInventory = invRows.filter((i) => !i.Inv_SellDate).length;

    return JSON.stringify({
      territory: territoryRes.data,
      activeOwners: ownersRes.data ?? [],
      performanceSummary: {
        t12Purchases,
        t12Sales,
        activeInventory,
        isHighPerformer: t12Purchases >= 10,
        highPerformerThreshold: "10+ purchases in trailing 12 months",
      },
      marketData: (marketRes.data ?? []).reduce<Record<string, unknown>>((acc, r) => {
        const row = r as { field_name: string; field_value: string };
        acc[row.field_name] = row.field_value;
        return acc;
      }, {}),
      eos: {
        goals: goalsRes.data ?? [],
        scorecard: scorecardRes.data ?? [],
        habits: habitsRes.data ?? [],
        rocks: rocksRes.data ?? [],
        openIssues: issuesRes.data ?? [],
        openTodos: todosRes.data ?? [],
      },
      activeJourneys: statesRes.data ?? [],
    });
  } catch (err) {
    return JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" });
  }
}

async function getJourneyProfile(journeyId: string): Promise<string> {
  try {
    const supabase = createServerClient();
    const [journeyRes, contactsRes, statesRes, enrollmentsRes] = await Promise.all([
      supabase.from("journeys").select("*").eq("id", journeyId).single(),
      supabase
        .from("journey_contacts")
        .select(
          "contact_id, role, is_primary_decision_maker, role_notes, joined_at, contacts(first_name, last_name, email, phone)"
        )
        .eq("journey_id", journeyId)
        .is("left_at", null),
      supabase
        .from("journey_pipeline_state")
        .select(
          "TerritorySlug, current_stage_id, entered_current_stage_at, entered_pipeline_at, pipeline_stages(name), pipelines(name)"
        )
        .eq("journey_id", journeyId)
        .eq("is_active", true),
      supabase
        .from("workflow_enrollments")
        .select("workflow_id, status, current_day, goal_achieved, enrolled_at, last_step_at")
        .eq("journey_id", journeyId),
    ]);

    if (journeyRes.error || !journeyRes.data) {
      return JSON.stringify({ error: `Journey '${journeyId}' not found` });
    }

    const states = (statesRes.data ?? []) as Array<{ entered_current_stage_at: string }>;
    const now = Date.now();

    return JSON.stringify({
      journey: journeyRes.data,
      contacts: contactsRes.data ?? [],
      pipelineStates: states.map((s) => ({
        ...s,
        days_in_current_stage: Math.floor(
          (now - new Date(s.entered_current_stage_at).getTime()) / (1000 * 60 * 60 * 24)
        ),
      })),
      workflowEnrollments: enrollmentsRes.data ?? [],
    });
  } catch (err) {
    return JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" });
  }
}

async function getOpportunityProfile(opportunityId: string): Promise<string> {
  try {
    // GHL doesn't expose getOpportunityById directly — search and filter.
    const opps = await ghl.searchOpportunities({ status: "open" });
    const opp = opps.find((o) => o.id === opportunityId);
    if (!opp) {
      return JSON.stringify({ error: `Opportunity '${opportunityId}' not found in open opportunities` });
    }
    const pipelines = await ghl.getPipelines();
    const pipeline = pipelines.find((p) => p.id === opp.pipelineId);
    const stage = pipeline?.stages.find((s) => s.id === opp.pipelineStageId);

    return JSON.stringify({
      opportunity: opp,
      pipeline: pipeline?.name,
      stage: stage?.name,
      contactId: opp.contactId,
    });
  } catch (err) {
    return JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" });
  }
}
