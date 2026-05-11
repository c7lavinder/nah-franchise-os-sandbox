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
    case "get_contact_calls":
      return executeGetContactCalls(input);
    case "get_tasks":
      return executeGetTasks(input);
    case "complete_task":
      return executeCompleteTask(input);
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
    case "draft_sub_task_log":
      return executeDraftSubTaskLog(input);
    case "territory_performance":
      return executeTerritoryPerformance(input);
    case "network_benchmarks":
      return executeNetworkBenchmarks(input);
    case "compare_territories":
      return executeCompareTerritories(input);
    case "describe_data":
      return executeDescribeData(input);
    case "get_compliance":
      return executeGetCompliance(input);
    case "draft_compliance_update":
      return executeDraftComplianceUpdate(input);
    default: {
      const _exhaustive: never = toolName;
      return { data: `Unknown tool: ${_exhaustive}` };
    }
  }
}

/** Look up a contact name from Supabase by GHL ID or UUID. Avoids GHL API call. */
async function getContactName(contactId: string): Promise<string> {
  const info = await getContactInfo(contactId);
  return info.name;
}

/** Look up contact name + phone + email from Supabase. */
async function getContactInfo(
  contactId: string
): Promise<{ name: string; phone: string | null; email: string | null }> {
  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from("contacts")
      .select("first_name, last_name, phone, email")
      .or(`ghl_contact_id.eq.${contactId},id.eq.${contactId}`)
      .limit(1)
      .single();
    if (data) {
      return {
        name: `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim() || "Unknown Contact",
        phone: data.phone ?? null,
        email: data.email ?? null,
      };
    }
  } catch {
    /* fall through */
  }
  return { name: "Unknown Contact", phone: null, email: null };
}

/** Look up current user's name from their GHL ID */
async function getUserName(ghlUserId: string | null): Promise<string | null> {
  if (!ghlUserId) return null;
  try {
    const supabase = createServerClient();
    const { data } = await supabase.from("users").select("full_name").eq("ghl_user_id", ghlUserId).single();
    return data?.full_name ?? null;
  } catch {
    return null;
  }
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

    // Check if the query looks like a phone number (mostly digits)
    const digitsOnly = query.replace(/\D/g, "");
    const isPhoneQuery = digitsOnly.length >= 7 && digitsOnly.length <= 11;

    // Search Supabase contacts — split multi-word queries to match first + last name
    const words = query.split(/\s+/).filter((w) => w.length > 0);
    const select =
      "id, ghl_contact_id, first_name, last_name, email, phone, city, state, opportunity_source, territory_interest, NonRetirementCapitalAvailable, scout_lead_score";

    let data: any[] | null = null;
    let error: any = null;

    if (isPhoneQuery) {
      // Phone search — build a pattern that matches digits regardless of formatting
      // e.g. "5098087404" matches "(509) 808-7404", "+15098087404", "509-808-7404"
      const phoneDigits = digitsOnly.length === 11 && digitsOnly[0] === "1" ? digitsOnly.slice(1) : digitsOnly;
      const phonePattern = phoneDigits.split("").join("%");
      const result = await supabase.from("contacts").select(select).ilike("phone", `%${phonePattern}%`).limit(limit);
      data = result.data;
      error = result.error;

      // Also search by email in case the digits are part of an email
      if (!data?.length) {
        const fallback = await supabase
          .from("contacts")
          .select(select)
          .or(`email.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
          .limit(limit);
        data = fallback.data;
        error = fallback.error;
      }
    } else if (words.length >= 2) {
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
      capitalAvailability: c.NonRetirementCapitalAvailable,
      leadScore: c.scout_lead_score,
    }));

    return { data: JSON.stringify({ world: "frandev", contacts: results }) };
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

    const payload = results.length === 1 ? results[0] : results;
    const wrapped = Array.isArray(payload)
      ? { world: "frandev" as const, pipelines: payload }
      : { world: "frandev" as const, ...payload };
    return { data: JSON.stringify(wrapped) };
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

async function executeGetTasks(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  try {
    const contactId = input.contact_id as string;
    const currentUserGhlId = input._current_user_ghl_id as string | null;
    const tasks = await ghl.getTasks(contactId);

    if (tasks.length === 0) {
      return { data: `No tasks found for this contact.` };
    }

    const formatted = tasks.map((t: any) => ({
      id: t.id ?? t._id,
      title: t.title,
      body: t.body ?? null,
      dueDate: t.dueDate,
      completed: t.completed ?? false,
      assignedTo: t.assignedTo ?? null,
    }));

    // Filter to current user's tasks if we know who they are
    const userTasks = currentUserGhlId ? formatted.filter((t: any) => t.assignedTo === currentUserGhlId) : formatted;

    const open = userTasks.filter((t: any) => !t.completed);
    const done = userTasks.filter((t: any) => t.completed);

    return {
      data: JSON.stringify({
        open: open.length,
        completed: done.length,
        tasks: open.length > 0 ? open : userTasks.slice(0, 10),
      }),
    };
  } catch (err) {
    return { data: `Error fetching tasks: ${err instanceof Error ? err.message : "Unknown error"}` };
  }
}

async function executeCompleteTask(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  try {
    const contactId = input.contact_id as string;
    const currentUserGhlId = input._current_user_ghl_id as string | null;
    let taskId = input.task_id as string | undefined;

    // If no task_id provided, find the only open task assigned to current user
    if (!taskId) {
      const tasks = await ghl.getTasks(contactId);
      const allOpen = tasks.filter((t: any) => !t.completed);
      const openTasks = currentUserGhlId ? allOpen.filter((t: any) => t.assignedTo === currentUserGhlId) : allOpen;

      if (openTasks.length === 0) {
        return { data: "No open tasks found for this contact." };
      }
      if (openTasks.length === 1) {
        taskId = (openTasks[0] as any).id ?? (openTasks[0] as any)._id;
      } else {
        // Multiple open tasks — list them for the user to pick
        const list = openTasks
          .map((t: any, i: number) => `${i + 1}. "${t.title}" (due: ${t.dueDate?.slice(0, 10) ?? "no date"})`)
          .join("\n");
        return { data: `Multiple open tasks found. Which one?\n\n${list}` };
      }
    }

    if (!taskId) {
      return { data: "Could not determine which task to complete." };
    }

    await ghl.updateTask(contactId, taskId, { completed: true });
    const contactName = await getContactName(contactId);

    return { data: `Task completed for ${contactName}.` };
  } catch (err) {
    return { data: `Error completing task: ${err instanceof Error ? err.message : "Unknown error"}` };
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
      return { data: JSON.stringify({ world: "frandev", recentCalls: results }) };
    }

    // For all other lenses: aggregate call data per contact
    const { data: callStats } = await supabase.rpc("get_contact_call_stats" as any, {} as any).select("*");

    // Fallback: manual aggregation if RPC doesn't exist
    const { data: calls } = await supabase
      .from("calls")
      .select(
        "contact_id, started_at, coaching_score, ai_summary, contacts!inner(id, first_name, last_name, ghl_contact_id, scout_lead_score, territory_interest, NonRetirementCapitalAvailable)"
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
        capital: c.NonRetirementCapitalAvailable,
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

    // Priority pick — the #1 contact to focus on right now with reason
    const top = entries[0];
    let topPickReason = "";
    if (top) {
      const daysSinceLastCall = top.lastCall
        ? Math.round((Date.now() - new Date(top.lastCall).getTime()) / 86400000)
        : null;
      switch (lens) {
        case "momentum":
          topPickReason = `Highest momentum — ${top.callCount} calls, avg score ${top.avgScore}. ${daysSinceLastCall != null ? `Last touch ${daysSinceLastCall} days ago.` : ""}`;
          break;
        case "at_risk":
          topPickReason = `Most at risk — avg score ${top.avgScore}, only ${top.callCount} call${top.callCount !== 1 ? "s" : ""}. Needs immediate attention.`;
          break;
        case "stalling":
          topPickReason = `Most stale — last contact ${daysSinceLastCall ?? "unknown"} days ago. Risk of going cold.`;
          break;
        case "top_performers":
          topPickReason = `Strongest candidate — avg coaching score ${top.avgScore}, ${top.callCount} calls completed.`;
          break;
        default:
          topPickReason = `Most active — ${top.callCount} calls in the last ${days} days.`;
      }
    }

    return {
      data: JSON.stringify({
        world: "frandev",
        topPick: top
          ? {
              name: top.name,
              ghlId: top.ghlId,
              stage: contactStage.get(Array.from(contactMap.keys())[0]) ?? "Unknown",
              reason: topPickReason,
            }
          : null,
        contacts: results,
      }),
    };
  } catch (err) {
    return { data: `Error getting insights: ${err instanceof Error ? err.message : "Unknown error"}` };
  }
}

async function executeSearchKnowledge(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  try {
    const supabase = createServerClient();
    const queryText = input.query as string;
    const query = queryText.toLowerCase();
    const queryWords = query.split(/\s+/).filter((w) => w.length > 2);

    // --- Semantic search via pgvector (when OPENAI_API_KEY is set) ---
    let semanticResults: { title: string; category: string; content: string }[] = [];
    if (process.env.OPENAI_API_KEY) {
      try {
        const { searchEmbeddings } = await import("@/lib/rag/embedder");
        const hits = await searchEmbeddings({
          query: queryText,
          contentType: "kb_doc",
          limit: 8,
          threshold: 0.35,
        });

        if (hits.length > 0) {
          // Map embedding results back to knowledge_documents for full content
          const docIds = hits.map((h) => h.metadata?.source_id).filter((id): id is string => id != null);

          if (docIds.length > 0) {
            const { data: fullDocs } = await supabase
              .from("knowledge_documents")
              .select("id, title, category, content")
              .in("id", docIds);

            if (fullDocs && fullDocs.length > 0) {
              // Order by semantic similarity (hits order)
              const docMap = new Map(fullDocs.map((d) => [d.id, d]));
              semanticResults = docIds
                .map((id) => docMap.get(id))
                .filter((d): d is NonNullable<typeof d> => d != null)
                .map(({ title, category, content }) => ({ title, category, content }));
            }
          }
        }
      } catch {
        // Semantic search failed — fall through to keyword search
      }
    }

    // --- Keyword search (always runs as fallback/supplement) ---
    const { data: rawDocs, error } = await supabase
      .from("knowledge_documents")
      .select("id, title, category, content, priority, retrieval_count")
      .eq("is_active", true)
      .order("priority", { ascending: false });

    if (error) {
      // If we have semantic results, use those despite the keyword error
      if (semanticResults.length > 0) {
        return { data: JSON.stringify(semanticResults) };
      }
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
      if (semanticResults.length > 0) {
        return { data: JSON.stringify(semanticResults) };
      }
      return { data: "No knowledge base documents found." };
    }

    // Score each doc by keyword relevance
    const scored = docs.map((doc) => {
      const titleLower = doc.title.toLowerCase();
      const contentLower = doc.content.toLowerCase();
      const catLower = doc.category.toLowerCase();
      let score = 0;

      if (titleLower.includes(query)) score += 30;
      if (contentLower.includes(query)) score += 15;
      for (const word of queryWords) {
        if (catLower.includes(word)) score += 20;
      }
      for (const word of queryWords) {
        if (titleLower.includes(word)) score += 8;
        const matches = contentLower.split(word).length - 1;
        score += Math.min(matches * 3, 15);
      }
      score += doc.priority;

      return { ...doc, score };
    });

    const sorted = scored.filter((d) => d.score > 0).sort((a, b) => b.score - a.score);
    const keywordResults = sorted.length > 0 ? sorted.slice(0, 10) : docs.slice(0, 5);

    // --- Merge semantic + keyword results (dedup by title) ---
    const seen = new Set<string>();
    const merged: { title: string; category: string; content: string }[] = [];

    // Semantic results first (higher relevance)
    for (const doc of semanticResults) {
      if (!seen.has(doc.title)) {
        seen.add(doc.title);
        merged.push(doc);
      }
    }
    // Then keyword results
    for (const doc of keywordResults) {
      if (!seen.has(doc.title) && merged.length < 12) {
        seen.add(doc.title);
        merged.push({ title: doc.title, category: doc.category, content: doc.content });
      }
    }

    // Update retrieval metrics
    const now = new Date().toISOString();
    for (const doc of keywordResults) {
      await supabase
        .from("knowledge_documents")
        .update({
          last_retrieved_at: now,
          retrieval_count: (doc.retrieval_count ?? 0) + 1,
        })
        .eq("id", doc.id);
    }

    // Log gap signal if no results found
    if (sorted.length === 0 && semanticResults.length === 0) {
      await supabase.from("kb_gap_signals").insert({
        query: queryText,
        results_found: 0,
        suggested_category: queryWords[0] ?? null,
      });
    }

    return { data: JSON.stringify(merged) };
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
      ["NonRetirementCapitalAvailable", "Have they confirmed capital?"],
      ["BriefWorkHistory", "Prior business ownership?"],
      ["WhatInterestsInOpportunity", "How strong is their motivation?"],
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
      `[world: frandev]`,
      `NEXT ACTION ANALYSIS — ${contactName}`,
      ``,
      `CURRENT STATE:`,
      `  Pipeline: ${pipelineName}`,
      `  Stage: ${currentStage} (${daysInStage}d in stage)`,
      `  Days since added: ${daysSinceAdded}`,
      `  Lead score: ${c.scout_lead_score ?? "Not scored"}`,
      `  Territory interest: ${c.territory_interest ?? "Not set"}`,
      `  Capital: ${c.NonRetirementCapitalAvailable ?? "Unknown"}`,
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
  const currentUserGhlId = input._current_user_ghl_id as string | null;

  const contactInfo = await getContactInfo(contactId);
  const senderName = await getUserName(currentUserGhlId);

  // Pre-populate from/to based on channel
  const toAddress = channel === "SMS" ? contactInfo.phone : contactInfo.email;
  const fromAddress =
    channel === "SMS" ? "+1 (888) NAH-FLIP" : (process.env.GHL_SENDING_EMAIL ?? "notifications@newagainhouses.com");

  const draftedAction: DraftedAction = {
    id: crypto.randomUUID(),
    type: "message",
    status: "pending",
    contactId,
    contactName: contactInfo.name,
    payload: {
      actionType: "message",
      channel,
      content,
      subject: subject ?? (channel === "Email" ? "New Again Houses" : undefined),
      toAddress: toAddress ?? undefined,
      fromAddress,
      fromName: senderName ?? undefined,
      scheduledAt: null,
    },
  };

  return {
    data: `I've drafted a ${channel} message to ${contactInfo.name}. Please review it below and confirm, edit, or cancel.`,
    draftedAction,
  };
}

async function executeDraftTask(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  const contactId = input.contact_id as string;
  const title = input.title as string;
  const dueDate = input.due_date as string;
  const description = input.description as string | undefined;
  const currentUserGhlId = input._current_user_ghl_id as string | null;

  const contactName = await getContactName(contactId);
  const assignedToName = await getUserName(currentUserGhlId);

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
      assignedTo: currentUserGhlId ?? undefined,
      assignedToName: assignedToName ?? undefined,
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
  let currentPipeline = "Unknown";
  let currentPipelineId: string | undefined;

  try {
    const supabase = createServerClient();
    const { data: contact } = await supabase
      .from("contacts")
      .select("id")
      .or(`ghl_contact_id.eq.${contactId},id.eq.${contactId}`)
      .limit(1)
      .single();

    if (contact) {
      const { data: jps } = await supabase
        .from("journey_pipeline_state")
        .select("pipeline_stages!inner(name), pipelines!inner(id, name)")
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
        currentPipeline = (jps as any).pipelines?.name ?? "Unknown";
        currentPipelineId = (jps as any).pipelines?.id ?? undefined;
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
      currentPipeline,
      currentPipelineId,
      currentStage,
      // Default target pipeline = same as current (user can change via dropdown)
      newPipeline: currentPipeline,
      newPipelineId: currentPipelineId,
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

  const contactName = await getContactName(contactId);

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
  const territorySlug = input.TerritorySlug as string;
  const territoryName = input.Nickname as string;
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
  const currentUserGhlId = input._current_user_ghl_id as string | null;

  const contactName = await getContactName(contactId);

  // Default assignedUserId to current user if not specified
  const resolvedAssignedUserId = assignedUserId ?? currentUserGhlId ?? undefined;

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
      assignedUserId: resolvedAssignedUserId,
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

  const contactName = await getContactName(contactId);

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

async function executeDraftSubTaskLog(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  const contactId = input.contact_id as string;
  const subTaskId = input.sub_task_id as string;
  const stateAdvance = (input.state_advance as string | undefined) ?? null;
  const contentType = (input.content_type as string) ?? "note";
  const contentText = input.content_text as string | undefined;

  const contactName = await getContactName(contactId);

  // Look up sub-task details for the card
  const supabase = createServerClient();
  const { data: subTask } = await supabase
    .from("pipeline_sub_tasks")
    .select("id, name, state_type, first_state_label, second_state_label, stage_id, pipeline_stages!inner(name)")
    .eq("id", subTaskId)
    .single();

  if (!subTask) {
    return { data: `Sub-task not found: ${subTaskId}` };
  }

  const stageName = (subTask as any).pipeline_stages?.name ?? "Unknown";

  const draftedAction: DraftedAction = {
    id: crypto.randomUUID(),
    type: "sub_task_log",
    status: "pending",
    contactId,
    contactName,
    payload: {
      actionType: "sub_task_log",
      subTaskId,
      subTaskName: subTask.name,
      stageName,
      stateType: subTask.state_type as "single" | "two_state",
      firstStateLabel: subTask.first_state_label ?? undefined,
      secondStateLabel: subTask.second_state_label ?? undefined,
      stateAdvance: stateAdvance as "first" | "second" | null,
      contentType: contentType as "note" | "file" | "link",
      contentText,
    },
  };

  const stateLabel =
    stateAdvance === "first"
      ? (subTask.first_state_label ?? "first state")
      : stateAdvance === "second"
        ? (subTask.second_state_label ?? "second state")
        : "completed";

  return {
    data: `I've drafted a sub-task log for ${contactName}: "${subTask.name}" → ${stateLabel}. Please review and confirm.`,
    draftedAction,
  };
}

// ════════════════════════════════════════════════════════════════
// COMPLIANCE TOOLS
// ════════════════════════════════════════════════════════════════

async function executeGetCompliance(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  try {
    const contactId = input.contact_id as string;
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from("compliance_tracking")
      .select("*")
      .eq("contact_id", contactId)
      .maybeSingle();

    if (error) {
      return { data: `Error fetching compliance data: ${error.message}` };
    }

    if (!data) {
      return { data: "No compliance record exists for this contact yet. Use draft_compliance_update to create one." };
    }

    // Calculate flags
    const now = new Date();
    const flags: string[] = [];

    if (data.fdd_cooling_ends_at && !data.franchise_agreement_signed_at) {
      const coolingEnds = new Date(data.fdd_cooling_ends_at);
      if (now < coolingEnds) {
        const daysLeft = Math.ceil((coolingEnds.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        flags.push(`FDD cooling: ${daysLeft} days remaining (ends ${coolingEnds.toLocaleDateString()})`);
      } else {
        flags.push("FDD cooling period complete — eligible for signing");
      }
    }

    if (data.franchise_agreement_signed_at && !data.fdd_issued_at) {
      flags.push("WARNING: Agreement signed without FDD on file");
    }

    if (data.training_started_at && !data.training_completed_at) {
      flags.push(
        `Training: ${data.training_modules_completed ?? 0}/${data.training_modules_total ?? 0} modules complete`
      );
    }

    if (data.background_check_status === "pending") {
      flags.push("Background check pending");
    } else if (data.background_check_status === "failed") {
      flags.push("WARNING: Background check failed");
    }

    return {
      data: JSON.stringify({
        compliance: data,
        flags,
        summary: flags.length > 0 ? flags.join(" | ") : "All compliance items clear",
      }),
    };
  } catch (err) {
    return { data: `Error: ${err instanceof Error ? err.message : "Unknown error"}` };
  }
}

// ════════════════════════════════════════════════════════════════
// MASTERSUITE PERFORMANCE TOOLS
// ════════════════════════════════════════════════════════════════

function computePeriodStart(period: string): Date {
  const now = new Date();
  if (period === "all") return new Date(2000, 0, 1);
  if (period === "ytd") return new Date(now.getFullYear(), 0, 1);
  const months = period === "t1" ? 1 : period === "t12" ? 12 : 3;
  return new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
}

/** Static data catalog — describes what Scout can access */
const DATA_CATALOG: Record<string, { description: string; keyColumns: string[] }> = {
  territories: {
    description: "All 88 franchise territories (64 active) with owner, coach, compliance, dates, marketing info",
    keyColumns: [
      "TerritorySlug",
      "Nickname",
      "PrimaryCoach",
      "ComplianceScore",
      "FranchiseAgreementDate",
      "Active",
      "IsFranchise",
      "IsFullTime",
    ],
  },
  ms_property_inventory: {
    description: "Property inventory — full lifecycle with financial snapshots at 5 maturity stages",
    keyColumns: [
      "PropertyId",
      "TerritorySlug",
      "Inv_Status",
      "Inv_PurchaseDate",
      "Inv_ConstructionStartDate",
      "Inv_CompletionDate",
      "Inv_ListDate",
      "Inv_SellDate",
      "Inv_PurchasePrice",
      "Inv_SellPrice",
      "Inv_Profit",
    ],
  },
  ms_property_calculations: {
    description: "Per-property calculated metrics — profit, ARV, max offer, lead score, cycle times",
    keyColumns: [
      "PropertyId",
      "TerritorySlug",
      "Calculated_Inv_Profit",
      "Calculated_Arv",
      "Calculated_MaxOffer",
      "Calculated_LeadScore",
      "Calculated_CycleDays",
    ],
  },
  ms_properties: {
    description: "Property leads — 900K+ with lead category, type, source, stage progression",
    keyColumns: [
      "PropertyId",
      "TerritorySlug",
      "LeadCategory",
      "LeadType",
      "Status",
      "PropertyType",
      "Stage1Arv",
      "Stage1Price",
      "Inserted",
    ],
  },
  ms_property_contacts: {
    description: "Seller/buyer contact info and skip trace phones per property",
    keyColumns: ["PropertyId", "SellerFirstName", "SellerLastName", "SellerPhone", "BuyerFirstName", "BuyerLastName"],
  },
  ms_property_notes: {
    description: "Financing notes — APR, principal, payoff per property",
    keyColumns: ["PropertyId", "FinancingNotes", "APR", "Principal", "Payoff"],
  },
  ms_property_dispositions: {
    description: "How properties were disposed — costs and profit by disposition type",
    keyColumns: ["PropertyId", "DispositionType", "DispositionCost", "DispositionProfit"],
  },
  ms_property_comparables: {
    description: "Comp data per property — comparable values and condition scores",
    keyColumns: ["PropertyId", "CompValue", "CompCondition"],
  },
  ms_property_inventory_rental: {
    description: "Rental pro forma per property — rent, vacancy, CapEx, NOI",
    keyColumns: ["PropertyId", "MonthlyRent", "VacancyRate", "CapExReserve", "NOI"],
  },
  ms_property_royalty: {
    description: "Acquisition and disposition royalty tracking per property",
    keyColumns: ["PropertyId", "AcquisitionRoyalty", "DispositionRoyalty"],
  },
  calls: {
    description: "All calls — transcripts, AI summaries, grades, coaching data, action items, participants",
    keyColumns: [
      "id",
      "contact_id",
      "call_type_id",
      "title",
      "ai_summary",
      "summary_bullets",
      "coaching_score",
      "raw_transcript",
      "status",
      "started_at",
      "duration_seconds",
      "territory_ms_slug",
    ],
  },
  call_grades: {
    description: "Call quality grades — A-F overall grade, rubric scores, strengths, improvements",
    keyColumns: [
      "call_id",
      "overall_grade",
      "overall_score",
      "criterion_scores",
      "strengths",
      "improvements",
      "suggested_next_action",
    ],
  },
  call_action_items: {
    description: "Action items from calls — categorized with push status",
    keyColumns: ["call_id", "category", "title", "description", "status", "ghl_action"],
  },
  call_participants: {
    description: "Who was on each call — team members, prospects, franchisees",
    keyColumns: ["call_id", "user_id", "contact_id", "role", "display_name"],
  },
  call_data_extractions: {
    description: "Structured intel extracted from call transcripts — field values with confidence",
    keyColumns: ["call_id", "field_key", "field_category", "extracted_value", "confidence", "saved_to_profile"],
  },
  contacts: {
    description: "Franchise candidates — synced from PathToOwnership entries",
    keyColumns: [
      "id",
      "first_name",
      "last_name",
      "email",
      "phone",
      "CountiesInterestedIn",
      "lead_source",
      "pipeline_stage",
    ],
  },
  candidate_intelligence: {
    description: "Intelligence scores per contact — financial, operational, engagement, momentum sub-scores + flags",
    keyColumns: [
      "contact_id",
      "score",
      "financial_readiness",
      "operational_fit",
      "engagement_quality",
      "pipeline_momentum",
      "avg_response_time_hours",
    ],
  },
  pipeline_stage_history: {
    description: "Audit trail of stage transitions — when contacts entered/exited each pipeline stage",
    keyColumns: ["contact_id", "stage_id", "entered_at", "exited_at", "journey_pipeline_state_id"],
  },
  journey_pipeline_state: {
    description: "Current pipeline state per contact per journey — includes days-in-stage calculations",
    keyColumns: ["id", "contact_id", "journey_id", "stage_id", "entered_current_stage_at", "entered_pipeline_at"],
  },
  eos_territory_habits: {
    description: "Weekly EOS habit grades per territory",
    keyColumns: ["TerritorySlug", "week_of", "DailyTasks", "WeeklyContractorMeeting", "WeeklyAccounting"],
  },
  eos_territory_rocks: {
    description: "Quarterly rocks per territory",
    keyColumns: ["TerritorySlug", "Rock", "status", "quarter"],
  },
  eos_territory_goals: {
    description: "Territory quarterly goals — leads, purchases, profit, compliance, cycle time",
    keyColumns: ["TerritorySlug", "goal_type", "target", "actual", "quarter"],
  },
};

async function executeDescribeData(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  const table = input.table as string | undefined;

  if (table) {
    const entry = DATA_CATALOG[table];
    if (!entry) {
      return {
        data: JSON.stringify({
          error: `Unknown table: ${table}. Use describe_data without a table parameter to see all available tables.`,
        }),
      };
    }
    // Also get a live row count
    try {
      const supabase = createServerClient();
      const { count } = await supabase.from(table).select("*", { count: "exact", head: true });
      return {
        data: JSON.stringify({
          table,
          description: entry.description,
          keyColumns: entry.keyColumns,
          rowCount: count ?? "unknown",
        }),
      };
    } catch {
      return {
        data: JSON.stringify({
          table,
          description: entry.description,
          keyColumns: entry.keyColumns,
          rowCount: "unable to count",
        }),
      };
    }
  }

  // Overview mode — list all tables with descriptions
  const overview = Object.entries(DATA_CATALOG).map(([name, info]) => ({
    table: name,
    description: info.description,
  }));
  return { data: JSON.stringify({ availableTables: overview, totalTables: overview.length }) };
}

async function executeTerritoryPerformance(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  try {
    const slug = input.TerritorySlug as string;
    const period = (input.period as string) ?? "t3";
    const periodStart = computePeriodStart(period);
    const periodISO = periodStart.toISOString();
    const supabase = createServerClient();

    // Compute previous period start for trend comparison
    const now = new Date();
    let prevPeriodStart: Date;
    if (period === "all") {
      prevPeriodStart = new Date(2000, 0, 1);
    } else if (period === "ytd") {
      prevPeriodStart = new Date(now.getFullYear() - 1, 0, 1);
    } else {
      const months = period === "t1" ? 1 : period === "t12" ? 12 : 3;
      prevPeriodStart = new Date(now.getFullYear(), now.getMonth() - months * 2, now.getDate());
    }

    // 1. Inventory rows with purchase dates for this territory
    let inventory: {
      PropertyId: number;
      Inv_PurchaseDate: string;
      Inv_SellDate: string | null;
      Inv_Status: string | null;
    }[] = [];
    let offset = 0;
    while (true) {
      const { data: page } = await supabase
        .from("ms_property_inventory")
        .select("PropertyId, Inv_PurchaseDate, Inv_SellDate, Inv_Status")
        .eq("TerritorySlug", slug)
        .not("Inv_PurchaseDate", "is", null)
        .order("PropertyId")
        .range(offset, offset + 999);
      if (!page || page.length === 0) break;
      inventory = inventory.concat(page as typeof inventory);
      if (page.length < 1000) break;
      offset += 1000;
    }

    // 2. Filter to period + previous period for trend
    const purchasedInPeriod = inventory.filter((i) => new Date(i.Inv_PurchaseDate) >= periodStart);
    const soldInPeriod = inventory.filter((i) => i.Inv_SellDate && new Date(i.Inv_SellDate) >= periodStart);
    const activeInventory = inventory.filter((i) => !i.Inv_SellDate);
    const prevPurchased = inventory.filter((i) => {
      const d = new Date(i.Inv_PurchaseDate);
      return d >= prevPeriodStart && d < periodStart;
    });
    const prevSold = inventory.filter((i) => {
      if (!i.Inv_SellDate) return false;
      const d = new Date(i.Inv_SellDate);
      return d >= prevPeriodStart && d < periodStart;
    });

    // 3. Profit for sold properties
    const soldIds = soldInPeriod.map((s) => s.PropertyId);
    let totalProfit = 0;
    let profitCount = 0;
    for (let i = 0; i < soldIds.length; i += 500) {
      const { data: calcs } = await supabase
        .from("ms_property_calculations")
        .select("PropertyId, Calculated_Inv_Profit")
        .in("PropertyId", soldIds.slice(i, i + 500));
      for (const c of (calcs ?? []) as { Calculated_Inv_Profit: number | null }[]) {
        if (c.Calculated_Inv_Profit != null) {
          totalProfit += Number(c.Calculated_Inv_Profit);
          profitCount++;
        }
      }
    }

    // 4. Cycle days (purchase → sell) for sold in period
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
    const medianCycleDays = cycleDays.length > 0 ? cycleDays[Math.floor(cycleDays.length / 2)] : null;

    // 5. Funnel — stage progression from status history
    const STAGES = ["1", "2", "3", "4", "5 Contract", "6 Purchase"];
    const stageRank: Record<string, number> = {};
    STAGES.forEach((s, i) => {
      stageRank[s] = i;
    });

    // Get property IDs for this territory
    const { data: propRows } = await supabase
      .from("ms_properties")
      .select("PropertyId")
      .eq("TerritorySlug", slug)
      .eq("Archived", false)
      .limit(10000);
    const propIds = (propRows ?? []).map((p: { PropertyId: number }) => p.PropertyId);

    let funnel: { stage: string; count: number }[] = [];
    if (propIds.length > 0) {
      let history: { PropertyId: number; NewStatus: string | null }[] = [];
      for (let i = 0; i < propIds.length; i += 500) {
        const { data: page } = await supabase
          .from("ms_property_status_history")
          .select("PropertyId, NewStatus")
          .in("PropertyId", propIds.slice(i, i + 500))
          .gte("Inserted", periodISO);
        if (page) history = history.concat(page as typeof history);
      }

      const highest = new Map<number, number>();
      for (const h of history) {
        const rank = stageRank[h.NewStatus ?? ""];
        if (rank !== undefined) {
          const cur = highest.get(h.PropertyId) ?? -1;
          if (rank > cur) highest.set(h.PropertyId, rank);
        }
      }

      funnel = STAGES.map((stage, i) => ({
        stage,
        count: [...highest.values()].filter((r) => r >= i).length,
      }));
    }

    const leadsEntered = funnel.find((f) => f.stage === "1")?.count ?? 0;
    const s4Count = funnel.find((f) => f.stage === "4")?.count ?? 0;
    const conversionRate = leadsEntered > 0 ? Number(((s4Count / leadsEntered) * 100).toFixed(1)) : null;

    // 6. T12 purchases for high performer check
    const t12Start = computePeriodStart("t12");
    const t12Purchases = inventory.filter((i) => new Date(i.Inv_PurchaseDate) >= t12Start).length;
    const isHighPerformer = t12Purchases >= 10;

    // 7. EOS habits for this territory
    const { data: habits } = await supabase
      .from("eos_territory_habits")
      .select("habit_label, grade")
      .eq("TerritorySlug", slug)
      .order("sort_order");

    // 8. Scorecard goals vs actuals
    const { data: scorecard } = await supabase
      .from("eos_territory_scorecard")
      .select("metric_label, goal_value, actual_value")
      .eq("TerritorySlug", slug)
      .order("sort_order");

    // 9. Lead channel effectiveness — cross-reference lead categories with outcomes
    const channelEffectiveness: Record<string, { leads: number; purchased: number; sold: number }> = {};
    if (propIds.length > 0) {
      const { data: propCats } = await supabase
        .from("ms_properties")
        .select("PropertyId, LeadCategory")
        .in("PropertyId", propIds.slice(0, 5000));
      const catMap = new Map(
        (propCats ?? []).map((p: { PropertyId: number; LeadCategory: string | null }) => [
          p.PropertyId,
          p.LeadCategory ?? "Unknown",
        ])
      );

      // Count leads entered per category
      for (const pid of propIds) {
        const cat = catMap.get(pid) ?? "Unknown";
        if (!channelEffectiveness[cat]) channelEffectiveness[cat] = { leads: 0, purchased: 0, sold: 0 };
        channelEffectiveness[cat].leads++;
      }

      // Count purchases and sales per category
      const purchaseIds = new Set(purchasedInPeriod.map((i) => i.PropertyId));
      const soldIds = new Set(soldInPeriod.map((i) => i.PropertyId));
      for (const [pid, cat] of catMap) {
        if (!channelEffectiveness[cat]) channelEffectiveness[cat] = { leads: 0, purchased: 0, sold: 0 };
        if (purchaseIds.has(pid)) channelEffectiveness[cat].purchased++;
        if (soldIds.has(pid)) channelEffectiveness[cat].sold++;
      }
    }

    // 10. Active marketing channels
    const { data: channels } = await supabase
      .from("eos_territory_lead_channels")
      .select("channel_name")
      .eq("TerritorySlug", slug)
      .eq("is_active", true);

    // 11. Territory owner(s)
    const { data: owners } = await supabase
      .from("territory_owners")
      .select("ghl_contact_id, role, start_date")
      .eq("TerritorySlug", slug)
      .is("end_date", null);
    // Resolve owner names
    const ownerNames: { name: string; role: string; since: string | null }[] = [];
    for (const o of (owners ?? []) as { ghl_contact_id: string; role: string; start_date: string | null }[]) {
      const { data: contact } = await supabase
        .from("contacts")
        .select("first_name, last_name")
        .eq("ghl_contact_id", o.ghl_contact_id)
        .limit(1)
        .single();
      ownerNames.push({
        name: contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() : o.ghl_contact_id,
        role: o.role,
        since: o.start_date,
      });
    }

    // 12. Territory info
    const { data: territoryInfo } = await supabase
      .from("territories")
      .select("Nickname, PrimaryCoach, FranchiseAgreementDate, ComplianceScore")
      .eq("TerritorySlug", slug)
      .single();

    return {
      data: JSON.stringify({
        world: "acquisitions",
        territory: slug,
        territoryName: (territoryInfo as any)?.Nickname ?? slug,
        owners: ownerNames,
        coach: (territoryInfo as any)?.PrimaryCoach ?? null,
        awardedDate: (territoryInfo as any)?.FranchiseAgreementDate ?? null,
        complianceScore: (territoryInfo as any)?.ComplianceScore ?? null,
        period,
        kpis: {
          purchasedInPeriod: purchasedInPeriod.length,
          soldInPeriod: soldInPeriod.length,
          activeInventory: activeInventory.length,
          totalProfit: profitCount > 0 ? Math.round(totalProfit) : null,
          avgProfit: profitCount > 0 ? Math.round(totalProfit / profitCount) : null,
          avgCycleDays,
          medianCycleDays,
          leadsEntered,
          conversionRate,
          t12Purchases,
          isHighPerformer,
        },
        trend: {
          prevPeriodPurchased: prevPurchased.length,
          prevPeriodSold: prevSold.length,
          purchaseChange:
            prevPurchased.length > 0
              ? Number((((purchasedInPeriod.length - prevPurchased.length) / prevPurchased.length) * 100).toFixed(1))
              : null,
          soldChange:
            prevSold.length > 0
              ? Number((((soldInPeriod.length - prevSold.length) / prevSold.length) * 100).toFixed(1))
              : null,
          direction:
            purchasedInPeriod.length > prevPurchased.length
              ? "up"
              : purchasedInPeriod.length < prevPurchased.length
                ? "down"
                : "flat",
        },
        funnel,
        habits: habits ?? [],
        scorecard: scorecard ?? [],
        channelEffectiveness,
        activeLeadChannels: (channels ?? []).map((c: { channel_name: string }) => c.channel_name),
        inventorySummary: {
          total: activeInventory.length,
          byStatus: activeInventory.reduce<Record<string, number>>((acc, inv) => {
            const status = inv.Inv_Status ?? "Unknown";
            acc[status] = (acc[status] || 0) + 1;
            return acc;
          }, {}),
        },
      }),
    };
  } catch (err) {
    return { data: `Error: ${err instanceof Error ? err.message : "Unknown error"}` };
  }
}

async function executeNetworkBenchmarks(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  try {
    const period = (input.period as string) ?? "t12";
    const periodStart = computePeriodStart(period);
    const supabase = createServerClient();

    // 1. Get all active territories
    const { data: territories } = await supabase
      .from("territories")
      .select("TerritorySlug, Nickname, status, FranchiseAgreementDate")
      .eq("status", "active");

    if (!territories || territories.length === 0) {
      return { data: JSON.stringify({ error: "No active territories found" }) };
    }

    const slugs = territories.map((t: { TerritorySlug: string }) => t.TerritorySlug);

    // 2. Get all inventory with purchase dates across all territories
    // TerritorySlug lives on ms_properties, not ms_property_inventory — join via FK
    let allInventory: {
      TerritorySlug: string;
      PropertyId: number;
      Inv_PurchaseDate: string;
      Inv_SellDate: string | null;
    }[] = [];
    for (let i = 0; i < slugs.length; i += 20) {
      const batchSlugs = slugs.slice(i, i + 20);
      let offset = 0;
      while (true) {
        const { data: page } = await supabase
          .from("ms_properties")
          .select("TerritorySlug, PropertyId, ms_property_inventory!inner(Inv_PurchaseDate, Inv_SellDate)")
          .in("TerritorySlug", batchSlugs)
          .not("ms_property_inventory.Inv_PurchaseDate", "is", null)
          .order("PropertyId")
          .range(offset, offset + 999);
        if (!page || page.length === 0) break;
        for (const row of page as any[]) {
          const inv = Array.isArray(row.ms_property_inventory)
            ? row.ms_property_inventory[0]
            : row.ms_property_inventory;
          if (inv) {
            allInventory.push({
              TerritorySlug: row.TerritorySlug,
              PropertyId: row.PropertyId,
              Inv_PurchaseDate: inv.Inv_PurchaseDate,
              Inv_SellDate: inv.Inv_SellDate,
            });
          }
        }
        if (page.length < 1000) break;
        offset += 1000;
      }
    }

    // 3. Compute per-territory metrics
    const territoryMetrics: {
      slug: string;
      name: string;
      purchased: number;
      sold: number;
      activeInventory: number;
      t12Purchases: number;
    }[] = [];

    const t12Start = computePeriodStart("t12");
    const territoryMap = new Map(
      territories.map((t: { TerritorySlug: string; Nickname: string }) => [t.TerritorySlug, t.Nickname])
    );

    // Group inventory by territory
    const byTerritory = new Map<string, typeof allInventory>();
    for (const inv of allInventory) {
      const existing = byTerritory.get(inv.TerritorySlug) ?? [];
      existing.push(inv);
      byTerritory.set(inv.TerritorySlug, existing);
    }

    for (const slug of slugs) {
      const inv = byTerritory.get(slug) ?? [];
      const purchased = inv.filter((i) => new Date(i.Inv_PurchaseDate) >= periodStart).length;
      const sold = inv.filter((i) => i.Inv_SellDate && new Date(i.Inv_SellDate) >= periodStart).length;
      const active = inv.filter((i) => !i.Inv_SellDate).length;
      const t12p = inv.filter((i) => new Date(i.Inv_PurchaseDate) >= t12Start).length;

      territoryMetrics.push({
        slug,
        name: (territoryMap.get(slug) as string) ?? slug,
        purchased,
        sold,
        activeInventory: active,
        t12Purchases: t12p,
      });
    }

    // 4. Get profit data for all sold properties in period
    const soldInPeriodIds: number[] = [];
    const soldByTerritory = new Map<string, number[]>();
    for (const inv of allInventory) {
      if (inv.Inv_SellDate && new Date(inv.Inv_SellDate) >= periodStart) {
        soldInPeriodIds.push(inv.PropertyId);
        const existing = soldByTerritory.get(inv.TerritorySlug) ?? [];
        existing.push(inv.PropertyId);
        soldByTerritory.set(inv.TerritorySlug, existing);
      }
    }

    const profitByTerritory = new Map<string, { total: number; count: number }>();
    for (let i = 0; i < soldInPeriodIds.length; i += 500) {
      const { data: calcs } = await supabase
        .from("ms_property_calculations")
        .select("PropertyId, Calculated_Inv_Profit")
        .in("PropertyId", soldInPeriodIds.slice(i, i + 500));
      for (const c of (calcs ?? []) as { PropertyId: number; Calculated_Inv_Profit: number | null }[]) {
        if (c.Calculated_Inv_Profit != null) {
          // Find which territory this property belongs to
          for (const [tSlug, propIds] of soldByTerritory) {
            if (propIds.includes(c.PropertyId)) {
              const existing = profitByTerritory.get(tSlug) ?? { total: 0, count: 0 };
              existing.total += Number(c.Calculated_Inv_Profit);
              existing.count++;
              profitByTerritory.set(tSlug, existing);
              break;
            }
          }
        }
      }
    }

    // 5. Compute network aggregates
    const purchaseCounts = territoryMetrics.map((t) => t.purchased).filter((n) => n > 0);
    const soldCounts = territoryMetrics.map((t) => t.sold).filter((n) => n > 0);
    const profitValues = [...profitByTerritory.values()].filter((p) => p.count > 0);
    const avgProfitPerTerritory =
      profitValues.length > 0
        ? Math.round(profitValues.reduce((sum, p) => sum + p.total / p.count, 0) / profitValues.length)
        : null;

    const sorted = (arr: number[]) => [...arr].sort((a, b) => a - b);
    const median = (arr: number[]) => {
      const s = sorted(arr);
      return s.length > 0 ? s[Math.floor(s.length / 2)] : null;
    };
    const avg = (arr: number[]) => (arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null);

    // High performers: 10+ T12 purchases
    const highPerformers = territoryMetrics
      .filter((t) => t.t12Purchases >= 10)
      .sort((a, b) => b.t12Purchases - a.t12Purchases);

    // Rankings by purchased in period
    const rankedByPurchases = [...territoryMetrics]
      .sort((a, b) => b.purchased - a.purchased)
      .slice(0, 10)
      .map((t, i) => ({
        rank: i + 1,
        territory: t.name,
        slug: t.slug,
        purchased: t.purchased,
        sold: t.sold,
        totalProfit: profitByTerritory.get(t.slug)?.total ? Math.round(profitByTerritory.get(t.slug)!.total) : null,
      }));

    return {
      data: JSON.stringify({
        world: "acquisitions",
        period,
        activeTerritoriesCount: territories.length,
        network: {
          totalPurchased: purchaseCounts.reduce((a, b) => a + b, 0),
          totalSold: soldCounts.reduce((a, b) => a + b, 0),
          totalProfit: profitValues.length > 0 ? Math.round(profitValues.reduce((sum, p) => sum + p.total, 0)) : null,
          avgPurchasesPerTerritory: avg(purchaseCounts),
          medianPurchasesPerTerritory: median(purchaseCounts),
          avgSoldPerTerritory: avg(soldCounts),
          avgProfitPerFlip: avgProfitPerTerritory,
        },
        highPerformers: {
          count: highPerformers.length,
          threshold: "10+ purchases in trailing 12 months",
          territories: highPerformers.slice(0, 15).map((t) => ({
            territory: t.name,
            slug: t.slug,
            t12Purchases: t.t12Purchases,
            activeInventory: t.activeInventory,
          })),
        },
        topTerritories: rankedByPurchases,
      }),
    };
  } catch (err) {
    return { data: `Error: ${err instanceof Error ? err.message : "Unknown error"}` };
  }
}

async function executeCompareTerritories(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  try {
    const rawSlugs = input.slugs as string | string[];
    const slugs = (Array.isArray(rawSlugs) ? rawSlugs : (JSON.parse(rawSlugs) as string[])).slice(0, 5);
    if (slugs.length < 2) {
      return { data: JSON.stringify({ error: "Need at least 2 territory slugs to compare" }) };
    }
    const period = (input.period as string) ?? "t12";
    const periodStart = computePeriodStart(period);
    const t12Start = computePeriodStart("t12");
    const supabase = createServerClient();

    // 1. Territory info
    const { data: territories } = await supabase
      .from("territories")
      .select("TerritorySlug, Nickname, status, FranchiseAgreementDate, ComplianceScore, PrimaryCoach")
      .in("TerritorySlug", slugs);

    const territoryMap = new Map(
      (territories ?? []).map((t: Record<string, unknown>) => [t.TerritorySlug as string, t])
    );

    // 2. Inventory for all territories at once
    let allInventory: {
      TerritorySlug: string;
      PropertyId: number;
      Inv_PurchaseDate: string;
      Inv_SellDate: string | null;
      Inv_Status: string | null;
    }[] = [];
    let offset = 0;
    while (true) {
      const { data: page } = await supabase
        .from("ms_property_inventory")
        .select("TerritorySlug, PropertyId, Inv_PurchaseDate, Inv_SellDate, Inv_Status")
        .in("TerritorySlug", slugs)
        .not("Inv_PurchaseDate", "is", null)
        .order("PropertyId")
        .range(offset, offset + 999);
      if (!page || page.length === 0) break;
      allInventory = allInventory.concat(page as typeof allInventory);
      if (page.length < 1000) break;
      offset += 1000;
    }

    // 3. Profit for sold properties in period
    const soldInPeriodIds: number[] = [];
    const soldByTerritory = new Map<string, number[]>();
    for (const inv of allInventory) {
      if (inv.Inv_SellDate && new Date(inv.Inv_SellDate) >= periodStart) {
        soldInPeriodIds.push(inv.PropertyId);
        const arr = soldByTerritory.get(inv.TerritorySlug) ?? [];
        arr.push(inv.PropertyId);
        soldByTerritory.set(inv.TerritorySlug, arr);
      }
    }

    const profitByTerritory = new Map<string, { total: number; count: number }>();
    for (let i = 0; i < soldInPeriodIds.length; i += 500) {
      const { data: calcs } = await supabase
        .from("ms_property_calculations")
        .select("PropertyId, Calculated_Inv_Profit")
        .in("PropertyId", soldInPeriodIds.slice(i, i + 500));
      for (const c of (calcs ?? []) as { PropertyId: number; Calculated_Inv_Profit: number | null }[]) {
        if (c.Calculated_Inv_Profit != null) {
          for (const [tSlug, propIds] of soldByTerritory) {
            if (propIds.includes(c.PropertyId)) {
              const existing = profitByTerritory.get(tSlug) ?? { total: 0, count: 0 };
              existing.total += Number(c.Calculated_Inv_Profit);
              existing.count++;
              profitByTerritory.set(tSlug, existing);
              break;
            }
          }
        }
      }
    }

    // 4. Territory owners
    const { data: allOwners } = await supabase
      .from("territory_owners")
      .select("TerritorySlug, ghl_contact_id, role, start_date")
      .in("TerritorySlug", slugs)
      .is("end_date", null);
    const ownerGhlIds = [...new Set((allOwners ?? []).map((o: { ghl_contact_id: string }) => o.ghl_contact_id))];
    const { data: ownerContacts } =
      ownerGhlIds.length > 0
        ? await supabase
            .from("contacts")
            .select("ghl_contact_id, first_name, last_name")
            .in("ghl_contact_id", ownerGhlIds)
        : { data: [] };
    const ownerNameMap = new Map(
      (ownerContacts ?? []).map(
        (c: { ghl_contact_id: string; first_name: string | null; last_name: string | null }) => [
          c.ghl_contact_id,
          `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.ghl_contact_id,
        ]
      )
    );
    const ownersByTerritory = new Map<string, string[]>();
    for (const o of (allOwners ?? []) as { TerritorySlug: string; ghl_contact_id: string }[]) {
      const arr = ownersByTerritory.get(o.TerritorySlug) ?? [];
      arr.push(ownerNameMap.get(o.ghl_contact_id) ?? o.ghl_contact_id);
      ownersByTerritory.set(o.TerritorySlug, arr);
    }

    // 5. EOS habits for all territories
    const { data: allHabits } = await supabase
      .from("eos_territory_habits")
      .select("TerritorySlug, habit_label, grade")
      .in("TerritorySlug", slugs)
      .order("sort_order");

    const habitsByTerritory = new Map<string, Record<string, string | null>>();
    for (const h of (allHabits ?? []) as { TerritorySlug: string; habit_label: string; grade: string | null }[]) {
      const existing = habitsByTerritory.get(h.TerritorySlug) ?? {};
      existing[h.habit_label] = h.grade;
      habitsByTerritory.set(h.TerritorySlug, existing);
    }

    // 5. Lead channels
    const { data: allChannels } = await supabase
      .from("eos_territory_lead_channels")
      .select("TerritorySlug, channel_name")
      .in("TerritorySlug", slugs)
      .eq("is_active", true);

    const channelsByTerritory = new Map<string, string[]>();
    for (const ch of (allChannels ?? []) as { TerritorySlug: string; channel_name: string }[]) {
      const arr = channelsByTerritory.get(ch.TerritorySlug) ?? [];
      arr.push(ch.channel_name);
      channelsByTerritory.set(ch.TerritorySlug, arr);
    }

    // 7. Build comparison
    const comparison = slugs.map((slug) => {
      const territory = territoryMap.get(slug) as Record<string, unknown> | undefined;
      const inv = allInventory.filter((i) => i.TerritorySlug === slug);
      const purchased = inv.filter((i) => new Date(i.Inv_PurchaseDate) >= periodStart).length;
      const sold = inv.filter((i) => i.Inv_SellDate && new Date(i.Inv_SellDate) >= periodStart).length;
      const active = inv.filter((i) => !i.Inv_SellDate).length;
      const t12p = inv.filter((i) => new Date(i.Inv_PurchaseDate) >= t12Start).length;
      const profit = profitByTerritory.get(slug);

      // Cycle days for sold in period
      const soldInv = inv.filter((i) => i.Inv_SellDate && new Date(i.Inv_SellDate) >= periodStart);
      const cycleDays = soldInv
        .map((i) =>
          Math.round((new Date(i.Inv_SellDate!).getTime() - new Date(i.Inv_PurchaseDate).getTime()) / 86400000)
        )
        .filter((d) => d > 0);
      cycleDays.sort((a, b) => a - b);

      return {
        slug,
        name: (territory?.Nickname as string) ?? slug,
        owners: ownersByTerritory.get(slug) ?? [],
        status: territory?.status ?? "unknown",
        awardedDate: territory?.FranchiseAgreementDate ?? null,
        complianceScore: territory?.ComplianceScore ?? null,
        coach: territory?.PrimaryCoach ?? null,
        kpis: {
          purchased,
          sold,
          activeInventory: active,
          totalProfit: profit ? Math.round(profit.total) : null,
          avgProfit: profit ? Math.round(profit.total / profit.count) : null,
          avgCycleDays:
            cycleDays.length > 0 ? Math.round(cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length) : null,
          medianCycleDays: cycleDays.length > 0 ? cycleDays[Math.floor(cycleDays.length / 2)] : null,
          t12Purchases: t12p,
          isHighPerformer: t12p >= 10,
        },
        habits: habitsByTerritory.get(slug) ?? {},
        activeLeadChannels: channelsByTerritory.get(slug) ?? [],
      };
    });

    return { data: JSON.stringify({ world: "acquisitions", period, comparison }) };
  } catch (err) {
    return { data: `Error: ${err instanceof Error ? err.message : "Unknown error"}` };
  }
}

async function executeDraftComplianceUpdate(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  try {
    const contactId = input.contact_id as string;
    const updates = input.updates as Record<string, unknown>;
    const reason = (input.reason as string) ?? "Compliance update";

    // Get contact name for display
    const supabase = createServerClient();
    const { data: contact } = await supabase
      .from("contacts")
      .select("first_name, last_name")
      .eq("id", contactId)
      .single();

    const contactName = contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() : contactId;

    const fieldSummary = Object.entries(updates)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");

    const draftedAction: DraftedAction = {
      id: crypto.randomUUID(),
      type: "compliance_update",
      contactId,
      contactName,
      status: "pending",
      payload: { actionType: "compliance_update" as const, contactId, updates, reason },
      summary: `Update compliance for ${contactName}: ${fieldSummary}`,
    };

    return {
      data: `I've drafted a compliance update for ${contactName}: ${fieldSummary}. Reason: ${reason}. Please review and confirm.`,
      draftedAction,
    };
  } catch (err) {
    return { data: `Error: ${err instanceof Error ? err.message : "Unknown error"}` };
  }
}

// ════════════════════════════════════════════════════════════════
// GET CONTACT CALLS — call history for a contact
// ════════════════════════════════════════════════════════════════

async function executeGetContactCalls(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  try {
    const contactId = input.contact_id as string;
    if (!contactId) return { data: "Error: contact_id is required" };

    const supabase = createServerClient();

    // Resolve Supabase UUID from GHL contact ID or direct UUID
    const { data: contact } = await supabase
      .from("contacts")
      .select("id")
      .or(`ghl_contact_id.eq.${contactId},id.eq.${contactId}`)
      .limit(1)
      .single();

    if (!contact) {
      return { data: `No contact found for ID ${contactId}` };
    }

    const supabaseId = contact.id;

    // Query calls via call_participants join
    const { data: participantRows, error: participantError } = await supabase
      .from("call_participants")
      .select(
        "call_id, calls!inner(id, title, started_at, duration_seconds, status, ai_summary, coaching_score, call_type_id)"
      )
      .eq("contact_id", supabaseId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (participantError) {
      return { data: `Error querying call participants: ${participantError.message}` };
    }

    if (!participantRows || participantRows.length === 0) {
      return { data: JSON.stringify({ calls: [], message: "No calls found for this contact." }) };
    }

    // Collect call IDs for batch lookups
    const callIds = participantRows.map((r: any) => r.calls.id);

    // Batch fetch call types, grades, and action items
    const [typesResult, gradesResult, actionsResult] = await Promise.all([
      supabase.from("call_types").select("id, name"),
      supabase.from("call_grades").select("call_id, overall_grade").in("call_id", callIds),
      supabase
        .from("call_action_items")
        .select("call_id, title, status")
        .in("call_id", callIds)
        .eq("status", "pending"),
    ]);

    // Build lookup maps
    const typeMap = new Map<string, string>();
    for (const t of typesResult.data ?? []) {
      typeMap.set((t as any).id, (t as any).name);
    }

    const gradeMap = new Map<string, string>();
    for (const g of gradesResult.data ?? []) {
      gradeMap.set((g as any).call_id, (g as any).overall_grade);
    }

    const actionMap = new Map<string, string[]>();
    for (const a of actionsResult.data ?? []) {
      const existing = actionMap.get((a as any).call_id) ?? [];
      existing.push((a as any).title);
      actionMap.set((a as any).call_id, existing);
    }

    // Build results
    const calls = participantRows.map((row: any) => {
      const call = row.calls;
      return {
        title: call.title ?? "Untitled",
        date: call.started_at,
        duration: call.duration_seconds ? `${Math.round(call.duration_seconds / 60)}min` : null,
        type: call.call_type_id ? (typeMap.get(call.call_type_id) ?? null) : null,
        status: call.status,
        grade: gradeMap.get(call.id) ?? null,
        summary: call.ai_summary ?? null,
        pending_actions: actionMap.get(call.id) ?? [],
      };
    });

    return { data: JSON.stringify({ calls, total: calls.length }) };
  } catch (err) {
    return { data: `Error: ${err instanceof Error ? err.message : "Unknown error"}` };
  }
}
