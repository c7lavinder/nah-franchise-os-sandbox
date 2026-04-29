/**
 * Scout tool executor — runs tool calls from Claude against GHL and the knowledge base.
 * This is the bridge between Claude's tool_use responses and the actual GHL/DB calls.
 *
 * Read-only tools (get_contact, search_contacts, etc.) execute immediately.
 * Draft tools (draft_message, draft_task, draft_stage_move) return draft payloads
 * for the user to confirm — they do NOT execute actions in GHL.
 */

import * as ghl from "@/lib/ghl";
import { createServerClient } from "@/lib/supabase/server";
import { analyzeWorkflow } from "@/lib/workflows/health-scoring";
import { generateRewrites } from "@/lib/workflows/rewrite-engine";
import { generateFlags } from "@/lib/intelligence/flags";
import { getScoreRecommendations } from "@/lib/intelligence/recommendations";
import {
  executeGetEntity,
  executeQuery,
  executeAggregate,
  type EntityType,
  type QueryEntity,
  type FilterOp,
} from "./data-tools";
import type { CandidateIntelligence, ObjectionRegistry } from "@/lib/intelligence/types";
import type { ScoutToolName, DraftedAction, JourneyActionKind } from "@/types/scout";

/** The result of executing a tool — either data or a drafted action */
export interface ToolExecutionResult {
  /** Text data to send back to Claude as a tool_result */
  data: string;
  /** If this tool produced a drafted action for the user to confirm */
  draftedAction?: DraftedAction;
}

/** Executes a single tool call and returns the result */
export async function executeTool(
  toolName: ScoutToolName,
  input: Record<string, unknown>
): Promise<ToolExecutionResult> {
  switch (toolName) {
    // General data primitives
    case "get_entity":
      return {
        data: await executeGetEntity(input.type as EntityType, input.id as string),
      };
    case "query":
      return { data: await executeQueryTool(input) };
    case "aggregate":
      return { data: await executeAggregateTool(input) };
    // Specialized read tools
    case "search_contacts":
      return executeSearchContacts(input);
    case "get_pipeline":
      return executeGetPipeline(input);
    case "get_next_action":
      return executeGetNextAction(input);
    case "get_schedule":
      return executeGetSchedule(input);
    case "get_contact_insights":
      return executeGetContactInsights(input);
    case "search_knowledge":
      return executeSearchKnowledge(input);
    case "workflow_analyze":
      return executeWorkflowAnalyze(input);
    case "workflow_rewrite":
      return executeWorkflowRewrite(input);
    case "trainual_status":
      return executeTrainualStatus(input);
    // Draft tools
    case "draft_message":
      return executeDraftMessage(input);
    case "draft_task":
      return executeDraftTask(input);
    case "draft_stage_move":
      return executeDraftStageMove(input);
    case "draft_profile_update":
      return executeDraftProfileUpdate(input);
    case "draft_eos_update":
      return executeDraftEosUpdate(input);
    case "draft_market_data_update":
      return executeDraftMarketDataUpdate(input);
    case "draft_journey_action":
      return executeDraftJourneyAction(input);
    case "draft_appointment":
      return executeDraftAppointment(input);
    case "draft_note":
      return executeDraftNote(input);
    case "draft_trigger_workflow":
      return executeDraftTriggerWorkflow(input);
    case "draft_knowledge_doc":
      return executeDraftKnowledgeDoc(input);
    default: {
      const _exhaustive: never = toolName;
      return { data: `Unknown tool: ${_exhaustive}` };
    }
  }
}

/** Look up a contact name from Supabase by GHL ID or UUID. Avoids GHL API call. */
async function getContactName(contactId: string): Promise<string> {
  try {
    const supabase = createServerClient();
    // Try GHL ID first, then UUID
    const { data } = await supabase
      .from("contacts")
      .select("first_name, last_name")
      .or(`ghl_contact_id.eq.${contactId},id.eq.${contactId}`)
      .limit(1)
      .single();
    if (data) return `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim() || "Unknown Contact";
  } catch {
    /* fall through */
  }
  return "Unknown Contact";
}

/** Parse query / aggregate input — Claude passes JSON strings for nested args */
function parseJsonField<T>(raw: unknown, fallback: T): T {
  if (raw === undefined || raw === null) return fallback;
  if (typeof raw === "object") return raw as T;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

async function executeQueryTool(input: Record<string, unknown>): Promise<string> {
  return executeQuery({
    entity: input.entity as QueryEntity,
    filters: parseJsonField<FilterOp[]>(input.filters, []),
    order_by: parseJsonField<{ field: string; direction: "asc" | "desc" } | undefined>(input.order_by, undefined),
    limit: typeof input.limit === "number" ? input.limit : undefined,
  });
}

async function executeAggregateTool(input: Record<string, unknown>): Promise<string> {
  return executeAggregate({
    entity: input.entity as QueryEntity,
    metric: input.metric as "count" | "avg" | "sum" | "min" | "max",
    metric_field: input.metric_field as string | undefined,
    group_by: input.group_by as string | undefined,
    filters: parseJsonField<FilterOp[]>(input.filters, []),
    period: parseJsonField<{ field: string; from: string; to: string } | undefined>(input.period, undefined),
  });
}

// ========================================
// READ-ONLY TOOLS — execute immediately
// ========================================

async function executeSearchContacts(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  try {
    const supabase = createServerClient();
    const query = (input.query as string).trim();
    const limit = (input.limit as number) ?? 10;

    // Search Supabase contacts — split multi-word queries to match first + last name
    const words = query.split(/\s+/).filter((w) => w.length > 0);
    const select =
      "id, ghl_contact_id, first_name, last_name, email, phone, city, state, opportunity_source, territory_interest, capital_availability, scout_lead_score";

    let data: any[] | null = null;
    let error: any = null;

    if (words.length >= 2) {
      // Multi-word: try first_name + last_name match first
      const result = await supabase
        .from("contacts")
        .select(select)
        .ilike("first_name", `%${words[0]}%`)
        .ilike("last_name", `%${words.slice(1).join(" ")}%`)
        .limit(limit);
      data = result.data;
      error = result.error;

      // If no results, fall back to OR search on each word
      if (!data?.length) {
        const orFilters = words
          .map((w) => `first_name.ilike.%${w}%,last_name.ilike.%${w}%,email.ilike.%${w}%`)
          .join(",");
        const fallback = await supabase.from("contacts").select(select).or(orFilters).limit(limit);
        data = fallback.data;
        error = fallback.error;
      }
    } else {
      // Single word: search across all fields
      const result = await supabase
        .from("contacts")
        .select(select)
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
        .limit(limit);
      data = result.data;
      error = result.error;
    }

    if (error) {
      return { data: `Error searching contacts: ${error.message}` };
    }

    // Format for Scout — include key profile fields so it has context
    const results = (data ?? []).map((c) => ({
      id: c.ghl_contact_id ?? c.id,
      localId: c.id,
      firstName: c.first_name,
      lastName: c.last_name,
      email: c.email,
      phone: c.phone,
      city: c.city,
      state: c.state,
      source: c.opportunity_source,
      territoryInterest: c.territory_interest,
      capitalAvailability: c.capital_availability,
      leadScore: c.scout_lead_score,
    }));

    return { data: JSON.stringify(results) };
  } catch (err) {
    return { data: `Error searching contacts: ${err instanceof Error ? err.message : "Unknown error"}` };
  }
}

async function executeGetPipeline(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  try {
    const supabase = createServerClient();

    // Get pipelines from Supabase (source of truth)
    let pipelineQuery = supabase.from("pipelines").select("id, name, slug").order("name");

    if (input.pipeline_id) {
      pipelineQuery = pipelineQuery.eq("id", input.pipeline_id);
    }

    const { data: pipelines, error: pError } = await pipelineQuery;
    if (pError || !pipelines?.length) {
      return { data: input.pipeline_id ? `Pipeline not found.` : "No pipelines configured." };
    }

    // For each pipeline, get stages and active lead counts
    const results = [];
    for (const pipeline of pipelines) {
      const { data: stages } = await supabase
        .from("pipeline_stages")
        .select("id, name, slug, sort_order, is_terminal")
        .eq("pipeline_id", pipeline.id)
        .order("sort_order");

      // Count active leads per stage
      const { data: jpsRows } = await supabase
        .from("journey_pipeline_state")
        .select("current_stage_id, assigned_user_id, contacts!inner(first_name, last_name, ghl_contact_id)")
        .eq("pipeline_id", pipeline.id)
        .eq("is_active", true);

      const stageCounts = new Map<string, { count: number; contacts: { name: string; ghlId: string }[] }>();
      for (const stage of stages ?? []) {
        stageCounts.set(stage.id, { count: 0, contacts: [] });
      }

      for (const row of jpsRows ?? []) {
        const entry = stageCounts.get(row.current_stage_id);
        if (entry) {
          entry.count++;
          const c = row.contacts as any;
          if (c) {
            entry.contacts.push({
              name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Unknown",
              ghlId: c.ghl_contact_id ?? "",
            });
          }
        }
      }

      const stagesWithCounts = (stages ?? []).map((s) => ({
        name: s.name,
        slug: s.slug,
        sortOrder: s.sort_order,
        isTerminal: s.is_terminal,
        activeLeads: stageCounts.get(s.id)?.count ?? 0,
        contacts: (stageCounts.get(s.id)?.contacts ?? []).slice(0, 10),
      }));

      results.push({
        pipeline: pipeline.name,
        slug: pipeline.slug,
        stages: stagesWithCounts,
        totalActive: jpsRows?.length ?? 0,
      });
    }

    return { data: JSON.stringify(results.length === 1 ? results[0] : results) };
  } catch (err) {
    return { data: `Error fetching pipeline: ${err instanceof Error ? err.message : "Unknown error"}` };
  }
}

async function executeGetSchedule(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  try {
    const appointments = await ghl.getAllAppointments(input.start_date as string, input.end_date as string);
    return { data: JSON.stringify(appointments) };
  } catch (err) {
    return { data: `Error fetching schedule: ${err instanceof Error ? err.message : "Unknown error"}` };
  }
}

async function executeGetContactInsights(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  try {
    const supabase = createServerClient();
    const lens = input.lens as string;
    const days = (input.days as number) ?? 90;
    const limit = (input.limit as number) ?? 10;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // Base: contacts with their pipeline state, intelligence, and call activity
    if (lens === "recent_calls") {
      const { data } = await supabase
        .from("calls")
        .select(
          "id, title, started_at, duration_seconds, coaching_score, summary, ai_summary, contacts!inner(first_name, last_name, ghl_contact_id)"
        )
        .not("contact_id", "is", null)
        .gte("started_at", cutoff)
        .order("started_at", { ascending: false })
        .limit(limit);

      const results = (data ?? []).map((c: any) => ({
        contact: `${c.contacts?.first_name ?? ""} ${c.contacts?.last_name ?? ""}`.trim(),
        ghlId: c.contacts?.ghl_contact_id,
        title: c.title,
        date: c.started_at,
        duration: c.duration_seconds ? `${Math.round(c.duration_seconds / 60)}min` : null,
        score: c.coaching_score,
        summary: c.ai_summary ?? c.summary ?? null,
      }));
      return { data: JSON.stringify(results) };
    }

    // For all other lenses: aggregate call data per contact
    const { data: callStats } = await supabase.rpc("get_contact_call_stats" as any, {} as any).select("*");

    // Fallback: manual aggregation if RPC doesn't exist
    const { data: calls } = await supabase
      .from("calls")
      .select(
        "contact_id, started_at, coaching_score, ai_summary, contacts!inner(id, first_name, last_name, ghl_contact_id, scout_lead_score, territory_interest, capital_availability)"
      )
      .not("contact_id", "is", null)
      .gte("started_at", cutoff);

    // Aggregate per contact
    type ContactAgg = {
      name: string;
      ghlId: string;
      callCount: number;
      lastCall: string;
      avgScore: number;
      scores: number[];
      summaries: string[];
      leadScore: number | null;
      territory: string | null;
      capital: string | null;
    };
    const contactMap = new Map<string, ContactAgg>();

    for (const call of calls ?? []) {
      const c = call.contacts as any;
      const id = call.contact_id;
      if (!id) continue;

      const existing: ContactAgg = contactMap.get(id) ?? {
        name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(),
        ghlId: c.ghl_contact_id ?? "",
        callCount: 0,
        lastCall: "",
        avgScore: 0,
        scores: [] as number[],
        summaries: [] as string[],
        leadScore: c.scout_lead_score,
        territory: c.territory_interest,
        capital: c.capital_availability,
      };

      existing.callCount++;
      if (!existing.lastCall || call.started_at > existing.lastCall) existing.lastCall = call.started_at;
      if (call.coaching_score) existing.scores.push(call.coaching_score as number);
      if (call.ai_summary) existing.summaries.push((call.ai_summary as string).slice(0, 150));
      contactMap.set(id, existing);
    }

    // Get pipeline state for each
    const contactIds = Array.from(contactMap.keys());
    const { data: jpsRows } = await supabase
      .from("journey_pipeline_state")
      .select("journey_id, pipeline_stages!inner(name), pipelines!inner(name)")
      .eq("is_active", true)
      .in(
        "journey_id",
        (
          await supabase.from("journeys").select("id, primary_contact_id").in("primary_contact_id", contactIds)
        ).data?.map((j: any) => j.id) ?? []
      );

    // Map journey → contact for pipeline info
    const { data: journeys } = await supabase
      .from("journeys")
      .select("id, primary_contact_id")
      .in("primary_contact_id", contactIds);

    const contactStage = new Map<string, string>();
    for (const j of journeys ?? []) {
      const jps = (jpsRows ?? []).find((r: any) => r.journey_id === j.id);
      if (jps) contactStage.set(j.primary_contact_id, (jps as any).pipeline_stages?.name ?? "Unknown");
    }

    // Build results and sort by lens
    let entries = Array.from(contactMap.entries()).map(([id, c]) => ({
      ...c,
      avgScore: c.scores.length ? Math.round(c.scores.reduce((a, b) => a + b, 0) / c.scores.length) : 0,
      stage: contactStage.get(id) ?? "Unknown",
      latestSummary: c.summaries[c.summaries.length - 1] ?? null,
    }));

    switch (lens) {
      case "momentum":
        entries.sort((a, b) => b.avgScore + b.callCount * 5 - (a.avgScore + a.callCount * 5));
        break;
      case "at_risk":
        entries.sort((a, b) => a.avgScore - b.avgScore);
        entries = entries.filter((e) => e.avgScore < 40 || e.callCount <= 1);
        break;
      case "most_engaged":
        entries.sort((a, b) => b.callCount - a.callCount);
        break;
      case "stalling":
        entries.sort((a, b) => new Date(a.lastCall).getTime() - new Date(b.lastCall).getTime());
        break;
      case "top_performers":
        entries.sort((a, b) => b.avgScore - a.avgScore);
        entries = entries.filter((e) => e.avgScore >= 40);
        break;
      default:
        entries.sort((a, b) => b.callCount - a.callCount);
    }

    const results = entries.slice(0, limit).map((e) => ({
      name: e.name,
      ghlId: e.ghlId,
      stage: e.stage,
      calls: e.callCount,
      lastCall: e.lastCall?.slice(0, 10),
      avgCoachingScore: e.avgScore,
      leadScore: e.leadScore,
      territory: e.territory,
      capital: e.capital,
      latestCallSummary: e.latestSummary,
    }));

    return { data: JSON.stringify(results) };
  } catch (err) {
    return { data: `Error getting insights: ${err instanceof Error ? err.message : "Unknown error"}` };
  }
}

async function executeSearchKnowledge(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  try {
    const supabase = createServerClient();
    const query = (input.query as string).toLowerCase();
    const queryWords = query.split(/\s+/).filter((w) => w.length > 2);

    // Fetch all active KB docs
    const { data: rawDocs, error } = await supabase
      .from("knowledge_documents")
      .select("id, title, category, content, priority, retrieval_count")
      .eq("is_active", true)
      .order("priority", { ascending: false });

    if (error) {
      return { data: `Error searching knowledge base: ${error.message}` };
    }

    const docs = rawDocs as
      | {
          id: string;
          title: string;
          category: string;
          content: string;
          priority: number;
          retrieval_count: number | null;
        }[]
      | null;
    if (!docs || docs.length === 0) {
      return { data: "No knowledge base documents found." };
    }

    // Score each doc by keyword relevance
    const scored = docs.map((doc) => {
      const titleLower = doc.title.toLowerCase();
      const contentLower = doc.content.toLowerCase();
      const catLower = doc.category.toLowerCase();
      let score = 0;

      // Exact phrase match in title = highest signal
      if (titleLower.includes(query)) score += 30;
      // Exact phrase match in content
      if (contentLower.includes(query)) score += 15;
      // Category match (including partial — "coach" matches "coaching")
      for (const word of queryWords) {
        if (catLower.includes(word)) score += 20;
      }

      // Individual word matches — weighted by position
      for (const word of queryWords) {
        if (titleLower.includes(word)) score += 8;
        // Count occurrences in content for density scoring
        const matches = contentLower.split(word).length - 1;
        score += Math.min(matches * 3, 15); // Cap at 15 per word
      }

      // Priority boost (0-10 scale)
      score += doc.priority;

      return { ...doc, score };
    });

    // Sort by score, take top results
    const sorted = scored.filter((d) => d.score > 0).sort((a, b) => b.score - a.score);
    const results = sorted.length > 0 ? sorted.slice(0, 10) : docs.slice(0, 5);

    // Update retrieval metrics — increment count, not replace
    const now = new Date().toISOString();
    for (const doc of results) {
      await supabase
        .from("knowledge_documents")
        .update({
          last_retrieved_at: now,
          retrieval_count: (doc.retrieval_count ?? 0) + 1,
        })
        .eq("id", doc.id);
    }

    // Log gap signal if no results found
    if (sorted.length === 0) {
      await supabase.from("kb_gap_signals").insert({
        query: input.query as string,
        results_found: 0,
        suggested_category: queryWords[0] ?? null,
      }); // non-critical — errors ignored
    }

    // Return with category for context
    const cleaned = results.map(({ title, category, content }) => ({ title, category, content }));
    return { data: JSON.stringify(cleaned) };
  } catch (err) {
    return { data: `Error searching knowledge base: ${err instanceof Error ? err.message : "Unknown error"}` };
  }
}

async function executeGetNextAction(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  try {
    const contactId = input.contact_id as string;
    const supabase = createServerClient();

    // Fetch contact from Supabase (source of truth) — includes all profile fields
    const { data: contact, error: cErr } = await supabase
      .from("contacts")
      .select("*")
      .eq("ghl_contact_id", contactId)
      .single();

    if (cErr || !contact) {
      // Try by UUID
      const { data: contactById } = await supabase.from("contacts").select("*").eq("id", contactId).single();
      if (!contactById) return { data: `Contact ${contactId} not found.` };
      Object.assign(contact ?? {}, contactById);
    }

    const c = contact as any;
    const contactName = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Unknown";

    // Find pipeline state from Supabase
    const { data: jpsRows } = await supabase
      .from("journey_pipeline_state")
      .select(
        "current_stage_id, entered_current_stage_at, is_active, closed_reason, pipeline_stages!inner(name, sort_order), pipelines!inner(name, slug)"
      )
      .eq("is_active", true)
      .in(
        "journey_id",
        (await supabase.from("journeys").select("id").eq("primary_contact_id", c.id)).data?.map((j: any) => j.id) ?? []
      );

    let currentStage = "Unknown";
    let daysInStage = 0;
    let pipelineName = "Unknown";
    let stageNum = 0;

    if (jpsRows && jpsRows.length > 0) {
      const jps = jpsRows[0] as any;
      currentStage = jps.pipeline_stages?.name ?? "Unknown";
      pipelineName = jps.pipelines?.name ?? "Unknown";
      stageNum = getStageNumber(currentStage);
      if (jps.entered_current_stage_at) {
        daysInStage = Math.floor(
          (Date.now() - new Date(jps.entered_current_stage_at).getTime()) / (1000 * 60 * 60 * 24)
        );
      }
    }

    // Days since added
    const daysSinceAdded = c.created_at
      ? Math.floor((Date.now() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    // Days since last synced (proxy for last touch)
    const daysSinceTouch = c.last_synced_at
      ? Math.floor((Date.now() - new Date(c.last_synced_at).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    // Missing profile fields check
    const missingFields: string[] = [];

    const qualificationFields: [string, string][] = [
      ["territory_interest", "Where do they want their territory?"],
      ["capital_availability", "Have they confirmed capital?"],
      ["business_ownership_experience", "Prior business ownership?"],
      ["motivation_clarity", "How strong is their motivation?"],
    ];

    const complianceFields: [string, string][] = [["nda_status", "NDA signed?"]];

    if (stageNum >= 3) {
      for (const [field, question] of qualificationFields) {
        if (!c[field]) missingFields.push(`${field} — ${question}`);
      }
      for (const [field, question] of complianceFields) {
        if (!c[field]) missingFields.push(`${field} — ${question}`);
      }
    }

    // Overdue milestones
    const overdue: string[] = [];
    if (stageNum >= 2 && !c.framing_call_logged) {
      overdue.push("Framing call not logged — must happen before Trainual invite");
    }

    // Stale lead check
    const isStale = daysSinceTouch !== null && daysSinceTouch > 3;
    const isVeryStale = daysSinceTouch !== null && daysSinceTouch > 7;

    // Build recommendation
    let recommendation = "";
    if (isVeryStale) {
      recommendation = `No contact in ${daysSinceTouch} days — this lead is going cold. Reach out today.`;
    } else if (overdue.length > 0) {
      recommendation = `Overdue: ${overdue[0]}. Schedule or complete this before moving forward.`;
    } else if (missingFields.length > 0) {
      recommendation = `Key info missing: ${missingFields[0]}. Get this on the next call.`;
    } else if (isStale) {
      recommendation = `Last touch was ${daysSinceTouch} days ago. Follow up to keep momentum.`;
    } else {
      recommendation = getStageRecommendation(currentStage, {});
    }

    // Build analysis
    const lines = [
      `NEXT ACTION ANALYSIS — ${contactName}`,
      ``,
      `CURRENT STATE:`,
      `  Pipeline: ${pipelineName}`,
      `  Stage: ${currentStage} (${daysInStage}d in stage)`,
      `  Days since added: ${daysSinceAdded}`,
      `  Lead score: ${c.scout_lead_score ?? "Not scored"}`,
      `  Territory interest: ${c.territory_interest ?? "Not set"}`,
      `  Capital: ${c.capital_availability ?? "Unknown"}`,
      `  Timeline: ${c.investment_timeline ?? "Unknown"}`,
      `  Trainual: ${c.trainual_completion_pct ? `${c.trainual_completion_pct}%` : "Not tracked"}`,
      `  NDA: ${c.nda_status ?? "Not set"}`,
    ];

    if (missingFields.length > 0) {
      lines.push(``, `MISSING PROFILE FIELDS (${missingFields.length}):`);
      for (const f of missingFields.slice(0, 5)) {
        lines.push(`  - ${f}`);
      }
      if (missingFields.length > 5) {
        lines.push(`  ... and ${missingFields.length - 5} more`);
      }
    }

    if (overdue.length > 0) {
      lines.push(``, `OVERDUE MILESTONES:`);
      for (const o of overdue) {
        lines.push(`  ⚠ ${o}`);
      }
    }

    lines.push(``, `RECOMMENDED NEXT ACTION:`, `  → ${recommendation}`);

    // ─── Intelligence Context ───
    const [intelligenceResult, objectionsResult] = await Promise.all([
      supabase.from("candidate_intelligence").select("*").eq("contact_id", contactId).single(),
      supabase
        .from("objection_registry")
        .select("*")
        .eq("contact_id", contactId)
        .eq("resolved", false)
        .order("created_at", { ascending: false }),
    ]);

    if (intelligenceResult.data) {
      const intel = intelligenceResult.data as CandidateIntelligence;
      const flags = generateFlags(intel);
      const recommendations = getScoreRecommendations(intel);

      lines.push(
        ``,
        `INTELLIGENCE SCORE: ${intel.current_score}/100 (Financial: ${intel.score_financial}, Operational: ${intel.score_operational}, Engagement: ${intel.score_engagement}, Momentum: ${intel.score_momentum})`
      );

      // Active flags — critical and warning only for actionability
      const actionableFlags = flags.filter((f) => f.severity === "critical" || f.severity === "warning");
      if (actionableFlags.length > 0) {
        lines.push(``, `ACTIVE FLAGS (${actionableFlags.length}):`);
        for (const f of actionableFlags) {
          const icon = f.severity === "critical" ? "!!!" : "!!";
          lines.push(`  ${icon} [${f.category}] ${f.text}`);
        }
      }

      // Top recommendation from intelligence system
      if (recommendations.length > 0) {
        const topRec = recommendations[0];
        lines.push(
          ``,
          `TOP SCORE OPPORTUNITY: ${topRec.action} (+${topRec.potentialPoints} pts, ${topRec.priority} priority)`
        );
      }
    }

    // Unresolved objections
    if (objectionsResult.data && objectionsResult.data.length > 0) {
      const typedObjections = objectionsResult.data as ObjectionRegistry[];
      lines.push(``, `UNRESOLVED OBJECTIONS (${typedObjections.length}):`);
      for (const obj of typedObjections) {
        lines.push(
          `  - ${obj.objection_type}: ${obj.objection_detail ?? "No detail recorded"} (stage: ${obj.stage_at_time})`
        );
      }
    }

    return { data: lines.join("\n") };
  } catch (err) {
    return { data: `Error analyzing contact: ${err instanceof Error ? err.message : "Unknown error"}` };
  }
}

/**
 * Map stage name to a sort_order number for comparison.
 * Now supports both the new 6-stage Sales pipeline AND legacy GHL stage names.
 * The new pipeline stages are the canonical ones; legacy names map to closest match.
 */
function getStageNumber(stageName: string): number {
  const map: Record<string, number> = {
    // New 6-stage Sales pipeline (canonical)
    Engagement: 1,
    Qualification: 2,
    Discovery: 3,
    Compliance: 4,
    Awarding: 5,
    Closed: 6,
    // Follow-up pipeline
    "Follow-up": 7,
    Nurture: 8,
    "Re-engaged": 9,
    // Legacy GHL names → closest new stage
    "New Lead": 1,
    Contacted: 1,
    Qualified: 2,
    "Guided Path to Ownership": 2,
    "Matt Call": 3,
    "Matt Call (Discovery)": 3,
    "Discovery Call": 3,
    "Sam Call": 3,
    "Sam Call (Validation)": 3,
    "Validation Call": 3,
    "Compliance Gate": 4,
    "Compliance Check": 4,
    Application: 5,
    "Application + Approval": 5,
    "FDD Issued": 4,
    "Signed FDD Receipt": 4,
    "Mark Call": 4,
    "Mark Call (Capital/Lending)": 4,
    "Award + Agreement": 5,
    "Matt Final": 5,
    "Matt Final/Documents Submitted": 5,
    "Funds Received": 6,
    "Closed Won": 6,
    Lost: 10,
  };
  return map[stageName] ?? 0;
}

/** Stage-specific recommendation based on new 6-stage pipeline */
function getStageRecommendation(stage: string, profile: Record<string, string>): string {
  const num = getStageNumber(stage);
  switch (num) {
    case 1:
      return "Engagement stage — make outreach, schedule intro call, send PTO materials.";
    case 2:
      return "Qualification stage — complete NDA, schedule Matt Call, run Zorakle assessment.";
    case 3:
      return "Discovery stage — complete Sam Call, PFS, background check, Mark Call.";
    case 4:
      return "Compliance stage — issue FDD, schedule FDD review call, territory call, FA info gathering.";
    case 5:
      return "Awarding stage — Matt Final Call, send Franchise Award Letter, complete FA and FF.";
    case 6:
      return "Closed — franchisee awarded! Trigger onboarding pipeline.";
    case 7:
      return "Follow-up — touch every 7-14 days. Draft a personal check-in.";
    case 8:
      return "Nurture — monthly personal touch from Chad + automated content.";
    case 9:
      return "Re-engaged! Contact within 2 hours — they already know NAH and chose to come back.";
    default:
      return "Review this lead's profile and determine the appropriate next step.";
  }
}

// ========================================
// WORKFLOW INTELLIGENCE TOOLS — read-only
// ========================================

async function executeWorkflowAnalyze(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  try {
    const workflowId = input.workflow_id as string;
    const supabase = createServerClient();

    // Fetch the workflow name
    const { data: workflow } = await supabase.from("workflows").select("name").eq("id", workflowId).single();

    const workflowName = workflow?.name ?? "Unknown Workflow";
    const analysis = await analyzeWorkflow(workflowId, workflowName);

    const metricsLines = analysis.metrics.map(
      (m) => `  - ${m.name}: ${m.value}% (benchmark: ${m.benchmark}%, status: ${m.status})`
    );

    const lines = [
      `WORKFLOW HEALTH ANALYSIS — ${analysis.workflowName}`,
      ``,
      `Health Score: ${analysis.score}`,
      ``,
      metricsLines.length > 0 ? `Metrics:\n${metricsLines.join("\n")}` : `Metrics: No data yet`,
      ``,
      `Top Issue: ${analysis.topIssue ?? "None — workflow is performing well"}`,
      `Underperforming Steps: ${analysis.underperformingSteps.length}`,
    ];

    if (analysis.underperformingSteps.length > 0) {
      lines.push(``);
      for (const step of analysis.underperformingSteps) {
        lines.push(
          `  - Day ${step.dayNumber} ${step.stepType.toUpperCase()} (step ${step.stepNumber}): ${step.metric} at ${step.value}% vs ${step.benchmark}% benchmark`
        );
      }
    }

    return { data: lines.join("\n") };
  } catch (err) {
    return {
      data: `Error analyzing workflow: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }
}

async function executeWorkflowRewrite(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  try {
    const stepId = input.step_id as string;
    const context = input.context as string | undefined;

    const result = await generateRewrites({ stepId, context });

    const lines = [
      `REWRITE SUGGESTIONS — Day ${result.dayNumber} ${result.stepType.toUpperCase()}`,
      ``,
      `Diagnosis: ${result.diagnosis}`,
      ``,
      `Original content:`,
      result.originalContent,
    ];

    if (result.originalSubject) {
      lines.push(`Original subject: ${result.originalSubject}`);
    }

    for (let i = 0; i < result.variants.length; i++) {
      const v = result.variants[i];
      lines.push(``, `--- Variant ${i + 1}: ${v.approach} ---`, `Rationale: ${v.rationale}`);
      if (v.subject) {
        lines.push(`Subject: ${v.subject}`);
      }
      lines.push(`Content: ${v.content}`);
    }

    return { data: lines.join("\n") };
  } catch (err) {
    return {
      data: `Error generating rewrites: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }
}

async function executeTrainualStatus(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  try {
    const contactId = input.contact_id as string;
    const contact = await ghl.getContact(contactId);
    const contactName = `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim() || "Unknown";

    // Load field mapping to resolve custom field IDs to names
    const supabase = createServerClient();
    const { data: fieldMappings } = await supabase
      .from("ghl_custom_fields")
      .select("field_name, ghl_field_id")
      .eq("entity_type", "contact");

    const idToName = new Map<string, string>();
    if (fieldMappings) {
      for (const m of fieldMappings) {
        idToName.set(m.ghl_field_id, m.field_name);
      }
    }

    // Extract all custom field values
    const fields: Record<string, string> = {};
    for (const cf of contact.customFields) {
      const name = idToName.get(cf.id);
      if (name && cf.value) {
        fields[name] = cf.value;
      }
    }

    // Read Trainual-related fields
    const completionPct = fields["Trainual Completion Percent"];
    const lastActivity = fields["Trainual Last Activity"];
    const trainualInviteSent = fields["Trainual Invite Sent"];
    const framingCallLogged = fields["Framing Call Logged"];

    // Determine if a nudge is needed
    let nudgeNeeded = false;
    let nudgeReason = "";

    if (!trainualInviteSent || trainualInviteSent === "No") {
      nudgeReason = "Trainual invite has not been sent yet.";
      if (framingCallLogged !== "Yes") {
        nudgeReason += " Framing call must be logged before sending the Trainual invite.";
      } else {
        nudgeNeeded = true;
        nudgeReason += " Framing call is done — send the invite now.";
      }
    } else if (!completionPct || parseFloat(completionPct) === 0) {
      nudgeNeeded = true;
      nudgeReason = "Trainual invite was sent but the prospect has not started it yet.";
    } else if (parseFloat(completionPct) < 100) {
      // Check if activity is stale (more than 7 days)
      if (lastActivity) {
        const daysSinceActivity = Math.floor((Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceActivity > 7) {
          nudgeNeeded = true;
          nudgeReason = `Trainual is ${completionPct}% complete but no activity in ${daysSinceActivity} days.`;
        }
      }
    }

    const lines = [
      `TRAINUAL STATUS — ${contactName}`,
      ``,
      `Completion: ${completionPct ? `${completionPct}%` : "Not tracked"}`,
      `Last Activity: ${lastActivity ?? "No activity recorded"}`,
      `Invite Sent: ${trainualInviteSent ?? "Unknown"}`,
      `Framing Call Logged: ${framingCallLogged ?? "Unknown"}`,
      ``,
      nudgeNeeded
        ? `Nudge Needed: YES — ${nudgeReason}`
        : nudgeReason
          ? `Nudge Needed: NO — ${nudgeReason}`
          : `Nudge Needed: NO`,
    ];

    return { data: lines.join("\n") };
  } catch (err) {
    return {
      data: `Error fetching Trainual status: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }
}

// ========================================
// DRAFT TOOLS — return drafts for user confirmation
// ========================================

async function executeDraftMessage(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  const contactId = input.contact_id as string;
  const channel = input.channel as "SMS" | "Email";
  const content = input.content as string;
  const subject = input.subject as string | undefined;

  // Try to fetch the contact name for display
  let contactName = "Unknown Contact";
  try {
    const contact = await ghl.getContact(contactId);
    contactName = `${contact.firstName} ${contact.lastName}`.trim();
  } catch {
    // Use fallback name if fetch fails
  }

  const draftedAction: DraftedAction = {
    id: crypto.randomUUID(),
    type: "message",
    status: "pending",
    contactId,
    contactName,
    payload: {
      actionType: "message",
      channel,
      content,
      subject,
    },
  };

  return {
    data: `I've drafted a ${channel} message to ${contactName}. Please review it below and confirm, edit, or cancel.`,
    draftedAction,
  };
}

async function executeDraftTask(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  const contactId = input.contact_id as string;
  const title = input.title as string;
  const dueDate = input.due_date as string;
  const description = input.description as string | undefined;

  let contactName = "Unknown Contact";
  try {
    const contact = await ghl.getContact(contactId);
    contactName = `${contact.firstName} ${contact.lastName}`.trim();
  } catch {
    // Use fallback name if fetch fails
  }

  const draftedAction: DraftedAction = {
    id: crypto.randomUUID(),
    type: "task",
    status: "pending",
    contactId,
    contactName,
    payload: {
      actionType: "task",
      title,
      description,
      dueDate,
    },
  };

  return {
    data: `I've drafted a task "${title}" for ${contactName}. Please review it below and confirm, edit, or cancel.`,
    draftedAction,
  };
}

async function executeDraftStageMove(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  const contactId = input.contact_id as string;
  const newStage = input.new_stage as string;
  const reason = input.reason as string | undefined;

  const contactName = await getContactName(contactId);
  let currentStage = "Unknown";

  try {
    const supabase = createServerClient();
    // Look up current stage from Supabase journey_pipeline_state
    const { data: contact } = await supabase
      .from("contacts")
      .select("id")
      .or(`ghl_contact_id.eq.${contactId},id.eq.${contactId}`)
      .limit(1)
      .single();

    if (contact) {
      const { data: jps } = await supabase
        .from("journey_pipeline_state")
        .select("pipeline_stages!inner(name)")
        .eq("is_active", true)
        .in(
          "journey_id",
          (await supabase.from("journeys").select("id").eq("primary_contact_id", contact.id)).data?.map(
            (j: any) => j.id
          ) ?? []
        )
        .limit(1)
        .single();

      if (jps) {
        currentStage = (jps as any).pipeline_stages?.name ?? "Unknown";
      }
    }
  } catch {
    // Use fallback
  }

  const draftedAction: DraftedAction = {
    id: crypto.randomUUID(),
    type: "stage_move",
    status: "pending",
    contactId,
    contactName,
    payload: {
      actionType: "stage_move",
      currentStage,
      newStage,
      reason,
    },
  };

  return {
    data: `I've drafted a pipeline move for ${contactName} from "${currentStage}" to "${newStage}". Please review it below and confirm, edit, or cancel.`,
    draftedAction,
  };
}

async function executeDraftProfileUpdate(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  const contactId = input.contact_id as string;
  const updatesRaw = input.updates as string;

  let contactName = "Unknown Contact";
  try {
    const contact = await ghl.getContact(contactId);
    contactName = `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim() || "Unknown Contact";
  } catch {
    // Use fallback
  }

  // Parse the updates JSON string
  let updates: { fieldName: string; value: string; reason: string }[];
  try {
    updates = JSON.parse(updatesRaw);
  } catch {
    return { data: "Error: Could not parse profile updates. Please provide valid JSON." };
  }

  if (!Array.isArray(updates) || updates.length === 0) {
    return { data: "Error: No profile updates provided." };
  }

  const fieldSummary = updates.map((u) => `${u.fieldName} → "${u.value}"`).join(", ");

  const draftedAction: DraftedAction = {
    id: crypto.randomUUID(),
    type: "profile_update",
    status: "pending",
    contactId,
    contactName,
    payload: {
      actionType: "profile_update",
      fields: updates,
    },
  };

  return {
    data: `I've drafted profile updates for ${contactName}: ${fieldSummary}. Please review below and confirm, edit, or cancel.`,
    draftedAction,
  };
}

async function executeDraftEosUpdate(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  const entityType = input.entity_type as "contact" | "territory";
  const entityId = input.entity_id as string;
  const entityName = input.entity_name as string;
  const section = input.section as string;
  const updatesRaw = input.updates as string;

  let updates: { fieldName: string; value: string; reason: string }[];
  try {
    updates = JSON.parse(updatesRaw);
  } catch {
    return { data: "Error: Could not parse EOS updates. Please provide valid JSON." };
  }

  if (!Array.isArray(updates) || updates.length === 0) {
    return { data: "Error: No EOS updates provided." };
  }

  const fieldSummary = updates.map((u) => `${u.fieldName} → "${u.value}"`).join(", ");

  const label = entityType === "contact" ? `contact ${entityName}` : `territory ${entityName}`;

  const draftedAction: DraftedAction = {
    id: crypto.randomUUID(),
    type: "eos_update",
    status: "pending",
    contactId: entityId,
    contactName: entityName,
    payload: {
      actionType: "eos_update",
      entityType,
      entityId,
      section: section as "goals" | "issues" | "todos" | "scorecard" | "budgets" | "habits" | "rocks" | "lead_channels",
      updates,
    },
  };

  return {
    data: `I've drafted EOS ${section} updates for ${label}: ${fieldSummary}. Please review below and confirm, edit, or cancel.`,
    draftedAction,
  };
}

async function executeDraftMarketDataUpdate(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  const territorySlug = input.territory_slug as string;
  const territoryName = input.territory_name as string;
  const updatesRaw = input.updates as string;

  let updates: { fieldName: string; value: string; reason: string }[];
  try {
    updates = JSON.parse(updatesRaw);
  } catch {
    return { data: "Error: Could not parse market data updates. Please provide valid JSON." };
  }

  if (!Array.isArray(updates) || updates.length === 0) {
    return { data: "Error: No market data updates provided." };
  }

  const fieldSummary = updates.map((u) => `${u.fieldName} → "${u.value}"`).join(", ");

  const draftedAction: DraftedAction = {
    id: crypto.randomUUID(),
    type: "market_data_update",
    status: "pending",
    contactId: territorySlug,
    contactName: territoryName,
    payload: {
      actionType: "market_data_update",
      territorySlug,
      territoryName,
      fields: updates,
    },
  };

  return {
    data: `I've drafted market data updates for ${territoryName}: ${fieldSummary}. Please review below and confirm, edit, or cancel.`,
    draftedAction,
  };
}

async function executeDraftJourneyAction(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  const contactId = input.contact_id as string;
  const kind = input.kind as JourneyActionKind;
  const workflowId = input.workflow_id as string | undefined;
  const enrollmentId = input.enrollment_id as string | undefined;
  const reason = input.reason as string | undefined;

  // Per-kind validation
  if (kind === "enroll_workflow" && !workflowId) {
    return { data: "Error: enroll_workflow requires a workflow_id." };
  }
  if ((kind === "pause_workflow" || kind === "resume_workflow" || kind === "exit_workflow") && !enrollmentId) {
    return { data: `Error: ${kind} requires an enrollment_id.` };
  }
  if (kind === "exit_workflow" && !reason) {
    return { data: "Error: exit_workflow requires a reason." };
  }

  // Resolve display names so the UI shows something useful
  let contactName = "Unknown Contact";
  try {
    const contact = await ghl.getContact(contactId);
    contactName = `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim() || "Unknown Contact";
  } catch {
    // Fall back to UUID
  }

  let workflowName: string | undefined;
  if (workflowId) {
    try {
      const supabase = createServerClient();
      const { data } = await supabase.from("workflows").select("name").eq("id", workflowId).single();
      workflowName = (data as { name?: string } | null)?.name ?? undefined;
    } catch {
      // Optional
    }
  }

  const summary =
    kind === "enroll_workflow"
      ? `enroll ${contactName} in workflow ${workflowName ?? workflowId}`
      : kind === "pause_workflow"
        ? `pause enrollment ${enrollmentId} for ${contactName}`
        : kind === "resume_workflow"
          ? `resume enrollment ${enrollmentId} for ${contactName}`
          : `exit enrollment ${enrollmentId} for ${contactName} (reason: ${reason})`;

  const draftedAction: DraftedAction = {
    id: crypto.randomUUID(),
    type: "journey_action",
    status: "pending",
    contactId,
    contactName,
    payload: {
      actionType: "journey_action",
      kind,
      workflowId,
      workflowName,
      enrollmentId,
      reason,
    },
  };

  return {
    data: `I've drafted a journey action: ${summary}. Please review below and confirm, edit, or cancel.`,
    draftedAction,
  };
}

async function executeDraftAppointment(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  const contactId = input.contact_id as string;
  const title = input.title as string;
  const startTime = input.start_time as string;
  const endTime = input.end_time as string;
  const calendarHint = (input.calendar_hint as string | undefined)?.toLowerCase().trim();
  const assignedUserId = input.assigned_user_id as string | undefined;

  let contactName = "Unknown Contact";
  try {
    const contact = await ghl.getContact(contactId);
    contactName = `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim() || "Unknown Contact";
  } catch {
    // Fall back to UUID
  }

  // Resolve a calendar suggestion. The user can change it via the searchable
  // dropdown on the confirm card before pushing.
  let calendarId = "";
  let calendarName: string | undefined;
  let calendarReason: string | undefined;
  try {
    const calendars = (await ghl.getCalendars()).filter((c) => c.isActive !== false);
    if (calendars.length === 0) {
      return { data: "Error: No active calendars found in this GHL location." };
    }

    if (calendarHint) {
      const match = calendars.find((c) => c.name.toLowerCase().includes(calendarHint));
      if (match) {
        calendarId = match.id;
        calendarName = match.name;
        calendarReason = `matched "${calendarHint}" in calendar name`;
      }
    }

    if (!calendarId) {
      // Default to first active — user can change in the dropdown
      calendarId = calendars[0].id;
      calendarName = calendars[0].name;
      calendarReason = calendarHint
        ? `no calendar matched "${calendarHint}", defaulted to first active`
        : "defaulted to first active calendar";
    }
  } catch (err) {
    return {
      data: `Error fetching calendars: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }

  const draftedAction: DraftedAction = {
    id: crypto.randomUUID(),
    type: "appointment",
    status: "pending",
    contactId,
    contactName,
    payload: {
      actionType: "appointment",
      calendarId,
      calendarName,
      calendarReason,
      title,
      startTime,
      endTime,
      assignedUserId,
    },
  };

  const when = `${new Date(startTime).toLocaleString()} – ${new Date(endTime).toLocaleString()}`;
  return {
    data: `I've drafted an appointment "${title}" with ${contactName} on ${calendarName ?? "the default calendar"} (${when}). You can change the calendar before confirming.`,
    draftedAction,
  };
}

async function executeDraftNote(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  const contactId = input.contact_id as string;
  const body = input.body as string;

  if (!body?.trim()) {
    return { data: "Error: Note body is required." };
  }

  let contactName = "Unknown Contact";
  try {
    const contact = await ghl.getContact(contactId);
    contactName = `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim() || "Unknown Contact";
  } catch {
    // Fall back
  }

  const draftedAction: DraftedAction = {
    id: crypto.randomUUID(),
    type: "note",
    status: "pending",
    contactId,
    contactName,
    payload: {
      actionType: "note",
      body,
    },
  };

  return {
    data: `I've drafted a note for ${contactName}. Please review below and confirm, edit, or cancel.`,
    draftedAction,
  };
}

async function executeDraftTriggerWorkflow(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  const contactId = input.contact_id as string;
  const workflowId = input.workflow_id as string;
  const workflowName = input.workflow_name as string | undefined;

  let contactName = "Unknown Contact";
  try {
    const contact = await ghl.getContact(contactId);
    contactName = `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim() || "Unknown Contact";
  } catch {
    // Fall back
  }

  const draftedAction: DraftedAction = {
    id: crypto.randomUUID(),
    type: "trigger_workflow",
    status: "pending",
    contactId,
    contactName,
    payload: {
      actionType: "trigger_workflow",
      workflowId,
      workflowName,
    },
  };

  return {
    data: `I've drafted a GHL workflow trigger for ${contactName} → workflow ${workflowName ?? workflowId}. Please review and confirm, edit, or cancel.`,
    draftedAction,
  };
}

async function executeDraftKnowledgeDoc(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  const title = input.title as string;
  const category = input.category as string;
  const content = input.content as string;

  // Knowledge docs are submitted for admin review — not added directly.
  // Non-admins can suggest, but only admins can approve and add to the KB.
  const supabase = createServerClient();

  await supabase.from("integration_logs").insert({
    integration_name: "scout_knowledge_suggestion",
    event_type: "knowledge_doc_drafted",
    status: "pending_review",
    payload_summary: `Suggested KB doc: "${title}" [${category}]`,
    metadata: { title, category, content_preview: content.slice(0, 200) },
  });

  return {
    data: `I've drafted a knowledge base document: "${title}" [${category}]. This has been submitted for admin review. An admin will need to approve it before it's added to the shared knowledge base that all users benefit from.\n\nContent preview:\n${content.slice(0, 300)}${content.length > 300 ? "..." : ""}`,
  };
}
