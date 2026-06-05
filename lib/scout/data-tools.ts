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
import { calculateLookalikeScore, type LookalikeInput } from "@/lib/intelligence/lookalike-scoring";
import { getContactProfileFields } from "@/lib/profile/profile-fields";
import { generateAndStoreContactBrief } from "@/lib/briefs/contact-brief-generator";
import { generateAndStoreTerritoryBrief } from "@/lib/briefs/territory-brief-generator";
import type { CandidateIntelligence, CallLog, ObjectionRegistry } from "@/lib/intelligence/types";

// ════════════════════════════════════════════════════════════════════
// SHARED TYPES
// ════════════════════════════════════════════════════════════════════

export type EntityType = "contact" | "territory" | "journey" | "opportunity";

export type QueryEntity =
  | "contacts"
  | "journeys"
  | "pipeline_entries"
  | "territories"
  | "opportunities"
  | "call_logs"
  | "alerts"
  | "objections"
  | "workflow_enrollments"
  | "inventory"
  | "properties"
  | "royalty";

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
      source: "source",
      opportunity_source: "opportunity_source",
      ghl_date_added: "ghl_date_added",
      created_at: "created_at",
      updated_at: "updated_at",
    },
    groupable: ["opportunity_source", "source", "city", "state"],
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
  pipeline_entries: {
    table: "journey_pipeline_state",
    filterable: {
      pipeline_id: "pipeline_id",
      current_stage_id: "current_stage_id",
      is_active: "is_active",
      entered_pipeline_at: "entered_pipeline_at",
      entered_current_stage_at: "entered_current_stage_at",
      created_at: "created_at",
    },
    groupable: ["pipeline_id", "current_stage_id", "is_active"],
    aggregatable: [],
    defaultOrder: { field: "entered_pipeline_at", direction: "desc" },
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
  royalty: {
    table: "ms_property_royalty",
    filterable: {
      PropertyId: "PropertyId",
      AcquisitionRoyaltyPaid: "AcquisitionRoyaltyPaid",
      AcquisitionRoyaltyPaidDate: "AcquisitionRoyaltyPaidDate",
      Calculated_AcquisitionRoyaltyDue: "Calculated_AcquisitionRoyaltyDue",
      DispositionRoyaltyPaid: "DispositionRoyaltyPaid",
      DispositionRoyaltyPaidDate: "DispositionRoyaltyPaidDate",
      Calculated_DispositionRoyaltyDue: "Calculated_DispositionRoyaltyDue",
      DelayedRoyaltyFeePaid: "DelayedRoyaltyFeePaid",
      DelayedRoyaltyFeePaidDate: "DelayedRoyaltyFeePaidDate",
      Calculated_DelayedRoyaltyFeeDue: "Calculated_DelayedRoyaltyFeeDue",
      ms_synced_at: "ms_synced_at",
    },
    groupable: [],
    aggregatable: [
      "AcquisitionRoyaltyPaid",
      "Calculated_AcquisitionRoyaltyDue",
      "DispositionRoyaltyPaid",
      "Calculated_DispositionRoyaltyDue",
      "DelayedRoyaltyFeePaid",
      "Calculated_DelayedRoyaltyFeeDue",
    ],
    defaultOrder: { field: "PropertyId", direction: "desc" },
  },
};

// ════════════════════════════════════════════════════════════════════
// WORLD LABEL — which domain does this entity belong to?
// ════════════════════════════════════════════════════════════════════

const ACQUISITIONS_ENTITIES: ReadonlySet<string> = new Set(["inventory", "properties", "territories", "royalty"]);

function worldForEntity(entity: string): "frandev" | "acquisitions" {
  return ACQUISITIONS_ENTITIES.has(entity) ? "acquisitions" : "frandev";
}

function normalizeTerritoryLookup(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function nameFromAccountEmail(value: unknown): string | null {
  if (typeof value !== "string" || !value.includes("@")) return null;
  const local = value.split("@")[0];
  const parts = local
    .split(/[._-]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  return parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(" ");
}

type TerritoryLookupRow = {
  TerritorySlug: string;
  Nickname: string | null;
  NahCity: string | null;
  NahState: string | null;
  MarketingName: string | null;
  status: string | null;
};

export async function resolveTerritorySlug(
  input: string,
  supabase = createServerClient()
): Promise<TerritoryLookupRow | null> {
  const raw = input.trim();
  if (!raw) return null;

  const lookup = normalizeTerritoryLookup(raw);
  const { data } = await supabase
    .from("territories")
    .select("TerritorySlug, Nickname, NahCity, NahState, MarketingName, status")
    .limit(1000);

  const rows = ((data ?? []) as TerritoryLookupRow[]).map((row) => {
    const cityState = [row.NahCity, row.NahState].filter(Boolean).join(" ");
    const labels = [row.TerritorySlug, row.Nickname, row.MarketingName, cityState].filter(Boolean) as string[];
    const normalizedLabels = labels.map(normalizeTerritoryLookup);
    const exact = normalizedLabels.some((label) => label === lookup);
    const contains = normalizedLabels.some((label) => label.includes(lookup) || lookup.includes(label));
    return { row, exact, contains };
  });

  const exactMatches = rows.filter((r) => r.exact);
  const containsMatches = rows.filter((r) => r.contains);
  const candidates = exactMatches.length > 0 ? exactMatches : containsMatches;
  if (candidates.length === 0) return null;

  return (
    candidates.find((c) => c.row.status === "active")?.row ??
    candidates.find((c) => c.row.status !== "inactive")?.row ??
    candidates[0].row
  );
}

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
    world: worldForEntity(spec.entity),
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
    world: "frandev",
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
      world: worldForEntity(spec.entity),
      entity: spec.entity,
      metric: spec.metric,
      group_by: spec.group_by,
      groups: result,
    });
  }

  // Ungrouped: single number
  const vals = spec.metric === "count" ? rows.map(() => 1) : rows.map((r) => Number(r[spec.metric_field!] ?? 0));
  return JSON.stringify({
    world: worldForEntity(spec.entity),
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

export async function executeGetEntity(
  type: EntityType,
  id: string,
  options: { refreshStaleBriefs?: boolean } = {}
): Promise<string> {
  switch (type) {
    case "contact":
      return getContactProfile(id, options);
    case "territory":
      return getTerritoryProfile(id, options);
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

async function getContactProfile(contactId: string, options: { refreshStaleBriefs?: boolean } = {}): Promise<string> {
  try {
    const contact = await ghl.getContact(contactId);
    const supabase = createServerClient();

    // Resolve the Supabase UUID — tools often pass GHL IDs
    const { data: contactRow } = await supabase
      .from("contacts")
      .select("id")
      .or(`ghl_contact_id.eq.${contactId},id.eq.${contactId}`)
      .limit(1)
      .single();
    const sbContactId = contactRow?.id ?? contactId;

    const [
      intelRes,
      callsRes,
      objRes,
      journeysRes,
      profileFields,
      briefRes,
      allGradesRes,
      allObjectionsRes,
      commitmentsRes,
      allCommitmentsRes,
    ] = await Promise.all([
      supabase.from("candidate_intelligence").select("*").eq("contact_id", sbContactId).single(),
      supabase
        .from("call_participants")
        .select(
          "call_id, role, calls!inner(id, title, started_at, duration_seconds, status, ai_summary, coaching_score, call_types(name))"
        )
        .eq("contact_id", sbContactId)
        .is("calls.deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase.from("objection_registry").select("*").eq("contact_id", sbContactId).eq("resolved", false),
      supabase
        .from("journey_contacts")
        .select("journey_id, role, is_primary_decision_maker")
        .eq("contact_id", sbContactId)
        .is("left_at", null),
      getContactProfileFields(sbContactId),
      supabase.from("contact_briefs").select("summary, brief, stale").eq("contact_id", sbContactId).maybeSingle(),
      // Cross-call analytics: all grades for this contact's calls
      supabase
        .from("call_participants")
        .select("calls!inner(id, started_at, duration_seconds, call_grades(overall_grade, overall_score, created_at))")
        .eq("contact_id", sbContactId)
        .is("calls.deleted_at", null)
        .order("created_at", { ascending: true }),
      // All objections (including resolved) for recurring pattern detection
      supabase
        .from("objection_registry")
        .select("objection_type, objection_detail, resolved, stage_at_time, created_at")
        .eq("contact_id", sbContactId)
        .order("created_at", { ascending: true }),
      // Open commitments
      supabase
        .from("commitments")
        .select("commitment_text, committed_by, due_date, status, commitment_type")
        .eq("contact_id", sbContactId)
        .in("status", ["pending", "overdue"])
        .order("due_date", { ascending: true, nullsFirst: false }),
      // All commitments (for lookalike scoring — need total + fulfilled count)
      supabase.from("commitments").select("status").eq("contact_id", sbContactId),
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
      out.recentCalls = (callsRes.data as any[]).map((cp) => {
        const call = Array.isArray(cp.calls) ? cp.calls[0] : cp.calls;
        const callType = call?.call_types;
        return {
          callType: (Array.isArray(callType) ? callType[0]?.name : callType?.name) ?? null,
          date: call?.started_at ?? null,
          duration: call?.duration_seconds ?? null,
          status: call?.status ?? null,
          title: call?.title ?? null,
          summary: call?.ai_summary ?? null,
          coachingScore: call?.coaching_score ?? null,
        };
      });
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

    // Pre-computed brief (instant context snapshot)
    // If stale, regenerate inline (~1-2s) instead of waiting for nightly cron
    if (briefRes.data?.stale && options.refreshStaleBriefs !== false) {
      try {
        const freshBrief = await generateAndStoreContactBrief(sbContactId);
        const lines: string[] = [];
        lines.push(
          `${freshBrief.name} — ${freshBrief.pipeline ? `${freshBrief.pipeline.stageName} (${freshBrief.pipeline.daysInStage}d)` : "No pipeline"}`
        );
        if (freshBrief.intelligence) lines.push(`Score: ${freshBrief.intelligence.totalScore}/100`);
        out.briefSummary = lines.join("\n");
      } catch {
        // Fall back to stale brief if regeneration fails
        if (briefRes.data?.summary) out.briefSummary = briefRes.data.summary;
      }
    } else if (briefRes.data?.summary) {
      out.briefSummary = briefRes.data.summary;
    }

    // Auto-chain: if contact is a franchisee (territory owner), include territory brief
    const { data: ownerRow } = await supabase
      .from("territory_owners")
      .select(`"TerritorySlug"`)
      .eq("ghl_contact_id", contactId)
      .is("end_date", null)
      .limit(1)
      .maybeSingle();

    if (!ownerRow) {
      // Also check by sbContactId (may be UUID)
      const { data: ownerById } = await supabase
        .from("territory_owners")
        .select(`"TerritorySlug"`)
        .eq("ghl_contact_id", sbContactId)
        .is("end_date", null)
        .limit(1)
        .maybeSingle();
      if (ownerById) {
        Object.assign(ownerRow ?? {}, ownerById);
      }
    }

    const territorySlug = (ownerRow as any)?.TerritorySlug ?? null;
    if (territorySlug) {
      out.isFranchisee = true;
      out.territorySlug = territorySlug;
      const { data: tBrief } = await supabase
        .from("territory_briefs")
        .select("summary, brief")
        .eq("territory_slug", territorySlug)
        .maybeSingle();
      if (tBrief?.summary) {
        out.territoryBriefSummary = tBrief.summary;
      }
    }

    // Cross-call analytics — grade trends, recurring objections, total time
    if (allGradesRes.data && allGradesRes.data.length > 0) {
      const gradeMap: Record<string, number> = { A: 4, B: 3, C: 2, D: 1, F: 0 };
      const grades: Array<{ date: string; grade: string; score: number }> = [];
      let totalCallSeconds = 0;

      for (const cp of allGradesRes.data as any[]) {
        const call = Array.isArray(cp.calls) ? cp.calls[0] : cp.calls;
        if (!call) continue;
        totalCallSeconds += call.duration_seconds ?? 0;
        const callGrades = Array.isArray(call.call_grades)
          ? call.call_grades
          : call.call_grades
            ? [call.call_grades]
            : [];
        for (const g of callGrades) {
          if (g.overall_grade) {
            grades.push({
              date: call.started_at ?? g.created_at,
              grade: g.overall_grade,
              score: g.overall_score ?? gradeMap[g.overall_grade] ?? 0,
            });
          }
        }
      }

      const analytics: Record<string, unknown> = {
        totalCalls: allGradesRes.data.length,
        totalCallMinutes: Math.round(totalCallSeconds / 60),
      };

      if (grades.length >= 2) {
        // Sort by date and compute trend
        grades.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const firstHalf = grades.slice(0, Math.floor(grades.length / 2));
        const secondHalf = grades.slice(Math.floor(grades.length / 2));
        const avgFirst = firstHalf.reduce((s, g) => s + (gradeMap[g.grade] ?? 0), 0) / firstHalf.length;
        const avgSecond = secondHalf.reduce((s, g) => s + (gradeMap[g.grade] ?? 0), 0) / secondHalf.length;
        const diff = avgSecond - avgFirst;
        analytics.gradeTrend = diff > 0.3 ? "improving" : diff < -0.3 ? "declining" : "flat";
        analytics.grades = grades.map((g) => `${g.grade} (${new Date(g.date).toLocaleDateString()})`);
      } else if (grades.length === 1) {
        analytics.gradeTrend = "single_call";
        analytics.grades = [`${grades[0].grade}`];
      }

      out.crossCallAnalytics = analytics;
    }

    // Recurring objection detection — same type raised 2+ times across calls
    if (allObjectionsRes.data && allObjectionsRes.data.length > 0) {
      const typeCounts = new Map<string, number>();
      for (const obj of allObjectionsRes.data) {
        typeCounts.set(obj.objection_type, (typeCounts.get(obj.objection_type) ?? 0) + 1);
      }
      const recurring = [...typeCounts.entries()]
        .filter(([, count]) => count >= 2)
        .map(([type, count]) => ({ type, timesRaised: count }));
      if (recurring.length > 0) {
        out.recurringObjections = recurring;
      }
    }

    // Open commitments
    if (commitmentsRes.data && commitmentsRes.data.length > 0) {
      const today = new Date().toISOString().split("T")[0];
      out.commitments = {
        overdue: commitmentsRes.data
          .filter((c) => c.due_date && c.due_date < today)
          .map((c) => ({ text: c.commitment_text, by: c.committed_by, dueDate: c.due_date })),
        upcoming: commitmentsRes.data
          .filter((c) => !c.due_date || c.due_date >= today)
          .map((c) => ({ text: c.commitment_text, by: c.committed_by, dueDate: c.due_date })),
      };
    }

    // EAV profile fields (199 fields from contact_profile_fields table)
    const filledFields = Object.entries(profileFields)
      .filter(([, v]) => v.field_value != null)
      .reduce(
        (acc, [k, v]) => {
          acc[k] = v.field_value;
          return acc;
        },
        {} as Record<string, unknown>
      );
    if (Object.keys(filledFields).length > 0) {
      out.profileFields = filledFields;
    }

    // Lookalike score — how closely does this prospect resemble converted franchisees?
    const intel = intelRes.data as CandidateIntelligence | null;
    const totalCalls = (allGradesRes.data as any[] | null)?.length ?? 0;
    const allCommitmentStatuses = (allCommitmentsRes.data ?? []) as { status: string }[];
    const fulfilledCount = allCommitmentStatuses.filter((c) => c.status === "fulfilled").length;
    const totalCommitments = allCommitmentStatuses.length;

    const lookalikeInput: LookalikeInput = {
      profileFieldCount: Object.keys(filledFields).length,
      opportunitySource: (contact as any)?.source ?? null,
      state: (contact as any)?.state ?? null,
      callCount: totalCalls,
      commitmentCount: totalCommitments,
      commitmentFulfillmentRate: totalCommitments > 0 ? fulfilledCount / totalCommitments : null,
      capitalAvailability: (filledFields.NonRetirementCapitalAvailable as string) ?? null,
      fundingPath: intel?.funding_path ?? null,
      hasPfs: intel?.pfs_received ?? false,
      intelligenceScore: intel?.current_score ?? null,
      priorBusinessOwner: intel?.prior_business_owner ?? null,
      constructionComfort: intel?.construction_comfort ?? null,
      spouseSupportive: intel?.spouse_supportive ?? null,
      trainualCompletionPct: intel?.trainual_completion_pct ?? null,
      avgResponseTimeHours: intel?.avg_response_time_hours ?? null,
      urgency: intel?.urgency ?? null,
    };

    const lookalike = calculateLookalikeScore(lookalikeInput);
    out.lookalikeScore = {
      score: lookalike.score,
      tier: lookalike.tier,
      breakdown: lookalike.breakdown,
      topMatchFactors: lookalike.topMatchFactors,
      topGaps: lookalike.topGaps,
    };

    return JSON.stringify(out);
  } catch (err) {
    return JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" });
  }
}

async function getTerritoryProfile(slug: string, options: { refreshStaleBriefs?: boolean } = {}): Promise<string> {
  try {
    const supabase = createServerClient();
    const resolved = await resolveTerritorySlug(slug, supabase);
    const territorySlug = resolved?.TerritorySlug ?? slug;
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
      territoryBriefRes,
    ] = await Promise.all([
      supabase.from("territories").select("*").eq("TerritorySlug", territorySlug).single(),
      supabase
        .from("territory_owners")
        .select("ghl_contact_id, role, start_date, end_date, transfer_notes")
        .eq("TerritorySlug", territorySlug)
        .is("end_date", null),
      supabase
        .from("territory_market_data")
        .select("field_name, field_value, source, source_date")
        .eq("TerritorySlug", territorySlug),
      supabase.from("eos_territory_goals").select("*").eq("TerritorySlug", territorySlug),
      supabase.from("eos_territory_scorecard").select("*").eq("TerritorySlug", territorySlug).order("sort_order"),
      supabase.from("eos_territory_habits").select("*").eq("TerritorySlug", territorySlug).order("sort_order"),
      supabase
        .from("eos_territory_rocks")
        .select("*")
        .eq("TerritorySlug", territorySlug)
        .order("created_at", { ascending: false }),
      supabase.from("eos_territory_issues").select("*").eq("TerritorySlug", territorySlug).eq("is_done", false),
      supabase.from("eos_territory_todos").select("*").eq("TerritorySlug", territorySlug).eq("is_done", false),
      supabase
        .from("journey_pipeline_state")
        .select("journey_id, current_stage_id, entered_current_stage_at, pipeline_stages(name), pipelines(name)")
        .eq("TerritorySlug", territorySlug)
        .eq("is_active", true),
      // Performance summary: recent inventory for T12 snapshot
      supabase
        .from("ms_property_inventory")
        .select("PropertyId, Inv_PurchaseDate, Inv_SellDate, Inv_Status")
        .eq("TerritorySlug", territorySlug)
        .not("Inv_PurchaseDate", "is", null)
        .order("Inv_PurchaseDate", { ascending: false })
        .limit(500),
      // Pre-computed brief
      supabase.from("territory_briefs").select("summary, stale").eq("territory_slug", territorySlug).maybeSingle(),
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

    // Regenerate stale territory brief inline
    let territoryBriefSummary = (territoryBriefRes.data as any)?.summary ?? null;
    if ((territoryBriefRes.data as any)?.stale && options.refreshStaleBriefs !== false) {
      try {
        const freshBrief = await generateAndStoreTerritoryBrief(territorySlug);
        territoryBriefSummary = `${freshBrief.nickname} (${slug}) — T12: ${freshBrief.performance.t12Purchases} purchased, ${freshBrief.performance.t12Sales} sold`;
      } catch {
        // Fall back to stale brief
      }
    }

    const territory = territoryRes.data as Record<string, unknown>;
    const ownerNames = [
      territory.PersonalName,
      territory.Owner2,
      territory.Owner3,
      nameFromAccountEmail(territory.GoogleLicense1Account),
      nameFromAccountEmail(territory.GoogleLicense2Account),
      nameFromAccountEmail(territory.GoogleLicense3Account),
      nameFromAccountEmail(territory.GoogleLicense4Account),
    ].filter(
      (name): name is string => typeof name === "string" && name.trim().length > 0
    );
    const uniqueOwnerNames = [...new Set(ownerNames)];

    return JSON.stringify({
      resolvedFrom: slug !== territorySlug ? slug : undefined,
      briefSummary: territoryBriefSummary,
      territory,
      activeOwners: ownersRes.data ?? [],
      ownerNames: uniqueOwnerNames,
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
      ownerBriefs: await getOwnerBriefs(supabase, ownersRes.data ?? []),
    });
  } catch (err) {
    return JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" });
  }
}

/** Fetch contact brief summaries for territory owners */
async function getOwnerBriefs(
  supabase: ReturnType<typeof createServerClient>,
  owners: Array<{ ghl_contact_id: string | null; role: string }>
): Promise<Array<{ role: string; briefSummary: string | null }>> {
  const results: Array<{ role: string; briefSummary: string | null }> = [];
  for (const owner of owners) {
    if (!owner.ghl_contact_id) continue;
    // Resolve to UUID
    const { data: contactRow } = await supabase
      .from("contacts")
      .select("id")
      .eq("ghl_contact_id", owner.ghl_contact_id)
      .maybeSingle();
    if (!contactRow) continue;
    const { data: brief } = await supabase
      .from("contact_briefs")
      .select("summary")
      .eq("contact_id", contactRow.id)
      .maybeSingle();
    results.push({ role: owner.role, briefSummary: brief?.summary ?? null });
  }
  return results;
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

    const out: Record<string, unknown> = {
      journey: journeyRes.data,
      contacts: contactsRes.data ?? [],
      pipelineStates: states.map((s) => ({
        ...s,
        days_in_current_stage: Math.floor(
          (now - new Date(s.entered_current_stage_at).getTime()) / (1000 * 60 * 60 * 24)
        ),
      })),
      workflowEnrollments: enrollmentsRes.data ?? [],
    };

    // Enrich: member intelligence scores + lookalike scores
    const memberContactIds = ((contactsRes.data ?? []) as any[]).map((c) => c.contact_id).filter(Boolean);
    if (memberContactIds.length > 0) {
      const [intelRes, lookalikeRes, briefsRes] = await Promise.all([
        supabase
          .from("candidate_intelligence")
          .select(
            "contact_id, current_score, score_financial, score_operational, score_engagement, score_momentum, urgency, funding_path"
          )
          .in("contact_id", memberContactIds),
        supabase
          .from("contact_profile_fields")
          .select("contact_id, field_value")
          .in("contact_id", memberContactIds)
          .eq("field_name", "lookalike_score"),
        supabase.from("contact_briefs").select("contact_id, summary").in("contact_id", memberContactIds),
      ]);

      if (intelRes.data && intelRes.data.length > 0) {
        out.memberScores = intelRes.data.map((i) => ({
          contactId: i.contact_id,
          score: i.current_score,
          financial: i.score_financial,
          operational: i.score_operational,
          engagement: i.score_engagement,
          momentum: i.score_momentum,
          urgency: i.urgency,
          fundingPath: i.funding_path,
        }));
      }

      if (lookalikeRes.data && lookalikeRes.data.length > 0) {
        out.memberLookalikeScores = lookalikeRes.data.map((r) => ({
          contactId: r.contact_id,
          ...(typeof r.field_value === "object" ? r.field_value : { score: r.field_value }),
        }));
      }

      if (briefsRes.data && briefsRes.data.length > 0) {
        out.memberBriefs = briefsRes.data.map((b) => ({
          contactId: b.contact_id,
          summary: b.summary,
        }));
      }

      // Recent calls for all journey members
      const callsRes = await supabase
        .from("call_participants")
        .select("contact_id, calls!inner(id, title, started_at, duration_seconds, ai_summary, call_types(name))")
        .in("contact_id", memberContactIds)
        .is("calls.deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(10);

      if (callsRes.data && callsRes.data.length > 0) {
        out.recentCalls = (callsRes.data as any[]).map((cp) => {
          const call = Array.isArray(cp.calls) ? cp.calls[0] : cp.calls;
          const callType = call?.call_types;
          return {
            contactId: cp.contact_id,
            title: call?.title ?? null,
            date: call?.started_at ?? null,
            duration: call?.duration_seconds ?? null,
            type: (Array.isArray(callType) ? callType[0]?.name : callType?.name) ?? null,
            summary: call?.ai_summary ?? null,
          };
        });
      }

      // Open commitments across all members
      const commitmentsRes = await supabase
        .from("commitments")
        .select("contact_id, commitment_text, committed_by, due_date, status, commitment_type")
        .in("contact_id", memberContactIds)
        .in("status", ["pending", "overdue"])
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(20);

      if (commitmentsRes.data && commitmentsRes.data.length > 0) {
        out.openCommitments = commitmentsRes.data;
      }
    }

    return JSON.stringify(out);
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
