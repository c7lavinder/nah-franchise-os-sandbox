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
import { getContactProfileFields } from "@/lib/profile/profile-fields";
import type { ScoutToolName, DraftedAction, JourneyActionKind } from "@/types/scout";
import {
  contactIdFilter,
  getContactInfo,
  getContactName,
  getUserName,
  resolveCurrentUserEmail,
  resolveUserByName,
} from "./contact-utils";
import { parseJsonField } from "./input-parser";

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
        data: await executeGetEntity(input.type as EntityType, input.id as string, {
          refreshStaleBriefs: input.__aiApiReadOnly === true ? false : undefined,
        }),
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
    case "get_calendar_availability":
      return executeGetCalendarAvailability(input);
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
    case "search_transcripts":
      return executeSearchTranscripts(input);
    case "search_documents":
      return executeSearchDocuments(input);
    case "get_journey_documents":
      return executeGetJourneyDocuments(input);
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
      "id, ghl_contact_id, first_name, last_name, email, phone, city, state, opportunity_source, territory_interest, NonRetirementCapitalAvailable, scout_lead_score, journey_contacts(journey_id, journeys(slug, name))";

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

      // Also try reversed names, because users often ask “Patel Chintan” or
      // paste names from exports with last name first.
      if (!data?.length) {
        const reversed = await supabase
          .from("contacts")
          .select(select)
          .ilike("first_name", `%${words.slice(1).join(" ")}%`)
          .ilike("last_name", `%${words[0]}%`)
          .limit(limit);
        data = reversed.data;
        error = reversed.error;
      }

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

    // Fuzzy fallback — if exact search returned nothing and it's a name query,
    // use pg_trgm similarity to catch misspellings (e.g. "Rearson" → "Rierson")
    if (!data?.length && !isPhoneQuery) {
      const fuzzy = await supabase.rpc("search_contacts_fuzzy", {
        search_query: query,
        max_results: limit,
        similarity_threshold: 0.2,
      });
      if (!fuzzy.error && fuzzy.data?.length) {
        const ids = fuzzy.data.map((c: any) => c.id);
        const details = await supabase.from("contacts").select(select).in("id", ids);
        const byId = new Map((details.data ?? []).map((c: any) => [c.id, c]));
        data = fuzzy.data.map((c: any) => ({ ...(byId.get(c.id) ?? c), similarity_score: c.similarity_score }));
      }
    }

    // Format for Scout — include key profile fields so it has context
    const results = (data ?? []).map((c: any) => {
      // Resolve journey link — pick the first active journey's slug
      const jc = Array.isArray(c.journey_contacts) ? c.journey_contacts[0] : null;
      const journey = jc?.journeys;
      const journeyObj = Array.isArray(journey) ? journey[0] : journey;
      const journeySlug = journeyObj?.slug ?? null;
      return {
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
        journeyUrl: journeySlug ? `/journeys/${journeySlug}` : null,
        ...(c.similarity_score != null ? { fuzzyMatch: true, similarityScore: c.similarity_score } : {}),
      };
    });

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

    const contactName = await getContactName(contactId);

    return {
      data:
        `Task completion prepared for ${contactName}. ` +
        `Scout cannot mark tasks complete directly; a human must complete task ${taskId} through the confirmed action UI.`,
    };
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

    // Hybrid search: semantic (Voyage AI) + BM25 full-text, fused with RRF, reranked
    const { hybridSearch } = await import("@/lib/rag/retriever");
    const hits = await hybridSearch({
      query: queryText,
      contentType: "kb_doc",
      limit: 10,
      threshold: 0.3,
      rerank: true,
    });

    if (hits.length === 0) {
      // Log gap signal
      const queryWords = queryText
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2);
      if (input.__aiApiReadOnly !== true) {
        await supabase.from("kb_gap_signals").insert({
          query: queryText,
          results_found: 0,
          suggested_category: queryWords[0] ?? null,
        });
      }
      return { data: "No knowledge base documents found matching your query." };
    }

    // Map chunks back to full knowledge_documents for complete content
    const docIds = hits.map((h) => h.metadata?.source_id).filter((id): id is string => id != null);

    // Deduplicate — multiple chunks may come from the same doc
    const uniqueDocIds = [...new Set(docIds)];

    let results: { title: string; category: string; content: string; relevance: number; sourceId: string | null }[] =
      [];

    if (uniqueDocIds.length > 0) {
      const { data: fullDocs } = await supabase
        .from("knowledge_documents")
        .select("id, title, category, content, retrieval_count")
        .in("id", uniqueDocIds);

      if (fullDocs && fullDocs.length > 0) {
        const docMap = new Map(fullDocs.map((d) => [d.id, d]));

        // Preserve reranked order, deduplicate by doc ID
        const seen = new Set<string>();
        for (const hit of hits) {
          const docId = hit.metadata?.source_id as string | undefined;
          if (!docId || seen.has(docId)) continue;
          seen.add(docId);
          const doc = docMap.get(docId);
          if (doc) {
            results.push({
              title: doc.title,
              category: doc.category,
              content: doc.content,
              relevance: hit.similarity,
              sourceId: docId,
            });
          }
        }

        // Update retrieval metrics for in-app Scout only. External AI API token access stays read-only except audit logs.
        if (input.__aiApiReadOnly !== true) {
          const now = new Date().toISOString();
          for (const doc of fullDocs) {
            void supabase
              .from("knowledge_documents")
              .update({
                last_retrieved_at: now,
                retrieval_count: ((doc as any).retrieval_count ?? 0) + 1,
              })
              .eq("id", doc.id);
          }
        }
      }
    }

    // Fallback: if no source_id mapping, return chunk content directly
    if (results.length === 0) {
      results = hits.map((h) => ({
        title: (h.metadata?.title as string) ?? "Knowledge Base",
        category: (h.metadata?.category as string) ?? "general",
        content: h.content,
        relevance: h.similarity,
        sourceId: (h.metadata?.source_id as string) ?? null,
      }));
    }

    return { data: JSON.stringify(results) };
  } catch (err) {
    return { data: `Error searching knowledge base: ${err instanceof Error ? err.message : "Unknown error"}` };
  }
}

async function executeSearchTranscripts(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  try {
    const queryText = input.query as string;
    const contactId = input.contact_id as string | undefined;
    const limit = (input.limit as number) ?? 8;

    const { hybridSearch } = await import("@/lib/rag/retriever");
    const hits = await hybridSearch({
      query: queryText,
      contentType: "transcript",
      contactId,
      limit,
      threshold: 0.3,
      rerank: true,
    });

    if (hits.length === 0) {
      return { data: "No transcript matches found for that query." };
    }

    const results = hits.map((h) => ({
      content: h.content,
      relevance: h.similarity,
      contactId: h.contactId,
      callDate: h.metadata?.call_date ?? null,
      contactName: h.metadata?.contact_name ?? null,
      sourceId: h.metadata?.source_id ?? null,
    }));

    return { data: JSON.stringify(results) };
  } catch (err) {
    return { data: `Error searching transcripts: ${err instanceof Error ? err.message : "Unknown error"}` };
  }
}

async function executeSearchDocuments(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  try {
    const supabase = createServerClient();
    const queryText = input.query as string;
    let journeyId = input.journey_id as string | undefined;
    const contactId = input.contact_id as string | undefined;
    const limit = (input.limit as number) ?? 8;

    // Resolve contact_id to a Supabase UUID for scoping
    let resolvedContactId: string | undefined;
    if (!journeyId && contactId) {
      const { data: contact } = await supabase
        .from("contacts")
        .select("id")
        .or(contactIdFilter(contactId))
        .limit(1)
        .maybeSingle();
      if (contact) resolvedContactId = contact.id;
    }

    // Search embedded documents (external_research content type)
    const { hybridSearch } = await import("@/lib/rag/retriever");
    const hits = await hybridSearch({
      query: queryText,
      contentType: "external_research",
      contactId: resolvedContactId,
      limit,
      threshold: 0.3,
      rerank: true,
    });

    if (hits.length === 0) {
      return { data: "No document matches found for that query." };
    }

    const results = hits.map((h) => ({
      content: h.content,
      relevance: h.similarity,
      documentTitle: h.metadata?.title ?? null,
      category: h.metadata?.category ?? null,
      sourceId: h.metadata?.source_id ?? null,
    }));

    return { data: JSON.stringify(results) };
  } catch (err) {
    return { data: `Error searching documents: ${err instanceof Error ? err.message : "Unknown error"}` };
  }
}

async function executeGetJourneyDocuments(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  try {
    const supabase = createServerClient();
    let journeyId = input.journey_id as string | undefined;

    // If no journey_id, resolve from contact_id
    if (!journeyId && input.contact_id) {
      const contactId = input.contact_id as string;
      // Try as GHL contact ID first, then as UUID
      const { data: contact } = await supabase
        .from("contacts")
        .select("id")
        .eq("ghl_contact_id", contactId)
        .maybeSingle();
      const localId = contact?.id ?? contactId;

      const { data: jc } = await supabase
        .from("journey_contacts")
        .select("journey_id")
        .eq("contact_id", localId)
        .is("left_at", null)
        .limit(1)
        .maybeSingle();
      journeyId = jc?.journey_id ?? undefined;
    }

    if (!journeyId) {
      return { data: "No journey found for this contact. Ask the user which journey to look at." };
    }

    const { data: docs, error } = await supabase
      .from("journey_documents")
      .select("id, doc_type, display_name, file_name, extracted_text, suggested_fields, created_at")
      .eq("journey_id", journeyId)
      .order("created_at", { ascending: false });

    if (error) return { data: `Error fetching documents: ${error.message}` };
    if (!docs || docs.length === 0) {
      return { data: "No documents uploaded for this journey yet." };
    }

    // Return metadata + extracted text (capped) for LLM context
    const result = docs.map((d) => ({
      id: d.id,
      type: d.doc_type,
      name: d.display_name,
      fileName: d.file_name,
      extractedText: d.extracted_text ? d.extracted_text.slice(0, 5000) : null,
      suggestedFields: d.suggested_fields,
      uploadedAt: d.created_at,
    }));

    return { data: JSON.stringify({ journeyId, documents: result }) };
  } catch (err) {
    return { data: `Error fetching journey documents: ${err instanceof Error ? err.message : "Unknown error"}` };
  }
}

async function executeGetNextAction(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  try {
    const contactId = input.contact_id as string;
    const supabase = createServerClient();

    // Fetch contact from Supabase (source of truth) — base columns only; EAV fields fetched separately
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

    // Fetch EAV profile fields for richer analysis
    const profileFields = await getContactProfileFields(c.id);
    const pv = (name: string) => {
      const f = profileFields[name];
      if (!f || f.field_value == null) return null;
      try {
        return typeof f.field_value === "string" ? JSON.parse(f.field_value) : f.field_value;
      } catch {
        return f.field_value;
      }
    };

    // Missing profile fields check — uses EAV fields
    const missingFields: string[] = [];

    const qualificationFields: [string, string][] = [
      ["territory_interest", "Where do they want their territory?"],
      ["liquid_capital_available", "Have they confirmed capital?"],
      ["current_occupation", "Prior business ownership?"],
      ["motivation_level", "How strong is their motivation?"],
    ];

    const complianceFields: [string, string][] = [["nda_status", "NDA signed?"]];

    if (stageNum >= 3) {
      for (const [field, question] of qualificationFields) {
        if (!pv(field) && !c[field]) missingFields.push(`${field} — ${question}`);
      }
      for (const [field, question] of complianceFields) {
        if (!pv(field) && !c[field]) missingFields.push(`${field} — ${question}`);
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

    // Build analysis — prefer EAV fields, fall back to contacts columns
    const lines = [
      `[world: frandev]`,
      `NEXT ACTION ANALYSIS — ${contactName}`,
      ``,
      `CURRENT STATE:`,
      `  Pipeline: ${pipelineName}`,
      `  Stage: ${currentStage} (${daysInStage}d in stage)`,
      `  Days since added: ${daysSinceAdded}`,
      `  Lead score: ${pv("scout_lead_score") ?? c.scout_lead_score ?? "Not scored"}`,
      `  Territory interest: ${pv("territory_interest") ?? c.territory_interest ?? "Not set"}`,
      `  Capital: ${pv("liquid_capital_available") ?? c.NonRetirementCapitalAvailable ?? "Unknown"}`,
      `  Timeline: ${pv("investment_timeline") ?? c.investment_timeline ?? "Unknown"}`,
      `  Trainual: ${(pv("trainual_completion_pct") ?? c.trainual_completion_pct) ? `${pv("trainual_completion_pct") ?? c.trainual_completion_pct}%` : "Not tracked"}`,
      `  NDA: ${pv("nda_status") ?? c.nda_status ?? "Not set"}`,
      `  DISC: ${pv("disc_type") ?? "Unknown"}`,
      `  Communication style: ${pv("communication_style") ?? "Unknown"}`,
      `  Ghost risk: ${pv("ghost_risk") ?? "Unknown"}`,
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
    const [intelligenceResult, objectionsResult, commitmentsResult] = await Promise.all([
      supabase.from("candidate_intelligence").select("*").eq("contact_id", contactId).single(),
      supabase
        .from("objection_registry")
        .select("*")
        .eq("contact_id", contactId)
        .eq("resolved", false)
        .order("created_at", { ascending: false }),
      supabase
        .from("commitments")
        .select("commitment_text, committed_by, due_date, status, commitment_type")
        .eq("contact_id", c.id)
        .in("status", ["pending", "overdue"])
        .order("due_date", { ascending: true, nullsFirst: false }),
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

    // Open commitments
    if (commitmentsResult.data && commitmentsResult.data.length > 0) {
      const commitments = commitmentsResult.data;
      const today = new Date().toISOString().split("T")[0];
      const overdueCmts = commitments.filter((c) => c.due_date && c.due_date < today);
      const pendingCmts = commitments.filter((c) => !c.due_date || c.due_date >= today);

      if (overdueCmts.length > 0) {
        lines.push(``, `OVERDUE COMMITMENTS (${overdueCmts.length}):`);
        for (const c of overdueCmts) {
          const who = c.committed_by === "rep" ? "Rep" : "Contact";
          const daysOverdue = c.due_date
            ? Math.floor((Date.now() - new Date(c.due_date).getTime()) / (1000 * 60 * 60 * 24))
            : 0;
          lines.push(`  !!! [${who}] ${c.commitment_text} — ${daysOverdue}d overdue (due ${c.due_date})`);
        }

        // Override recommendation if there are overdue commitments
        recommendation = `${overdueCmts.length} overdue commitment(s) — "${overdueCmts[0].commitment_text}" is ${
          overdueCmts[0].due_date
            ? Math.floor((Date.now() - new Date(overdueCmts[0].due_date).getTime()) / (1000 * 60 * 60 * 24)) + "d"
            : ""
        } overdue. Follow up immediately.`;
        // Update the recommendation line already in the output
        const recIdx = lines.findIndex((l) => l.startsWith("  → "));
        if (recIdx >= 0) lines[recIdx] = `  → ${recommendation}`;
      }

      if (pendingCmts.length > 0) {
        lines.push(``, `UPCOMING COMMITMENTS (${pendingCmts.length}):`);
        for (const c of pendingCmts.slice(0, 5)) {
          const who = c.committed_by === "rep" ? "Rep" : "Contact";
          const due = c.due_date ?? "no due date";
          lines.push(`  - [${who}] ${c.commitment_text} (due: ${due})`);
        }
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
  const currentUserId = input._current_user_id as string | null;

  const contactInfo = await getContactInfo(contactId);
  const senderInfo = await resolveCurrentUserEmail(currentUserId, currentUserGhlId);

  // Validate phone exists before drafting SMS
  if (channel === "SMS" && !contactInfo.phone) {
    return {
      data: `Cannot draft SMS to ${contactInfo.name}: no phone number on file. Ask the user to add a phone number to the contact profile first, or switch to Email.`,
    };
  }

  // Pre-populate from/to based on channel
  const toAddress = channel === "SMS" ? contactInfo.phone : contactInfo.email;
  const fromAddress = channel === "SMS" ? "+1 (888) NAH-FLIP" : senderInfo.email;

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
      fromName: senderInfo.name ?? undefined,
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
  const assignedToNameInput = input.assigned_to_name as string | undefined;
  const currentUserGhlId = input._current_user_ghl_id as string | null;

  const contactName = await getContactName(contactId);

  // Resolve assignee: use specified name if provided, fall back to logged-in user
  let assignedToGhlId = currentUserGhlId;
  let assignedToName: string | null = null;

  if (assignedToNameInput) {
    const resolved = await resolveUserByName(assignedToNameInput);
    if (resolved) {
      assignedToGhlId = resolved.ghlUserId;
      assignedToName = resolved.fullName;
    } else {
      assignedToName = assignedToNameInput; // Show the name even if we can't resolve the ID
    }
  }

  if (!assignedToName) {
    assignedToName = await getUserName(currentUserGhlId);
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
      assignedTo: assignedToGhlId ?? undefined,
      assignedToName: assignedToName ?? undefined,
    },
  };

  return {
    data: `I've drafted a task "${title}" for ${contactName}, assigned to ${assignedToName ?? "you"}. Please review it below and confirm, edit, or cancel.`,
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
      .or(contactIdFilter(contactId))
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

/** Derive a calendar fuzzy-match hint from an appointment title.
 *  "Intro Call - Franchise Overview" → "intro call"
 *  "Discovery Call" → "discovery call"
 *  "Quick chat" → "quick chat"
 *  Used as the fallback when Scout forgets to pass calendar_hint.
 */
function deriveHintFromTitle(title: string): string {
  if (!title) return "";
  const beforeDash = title.split(/\s+[-–—]\s+/)[0] ?? title;
  return beforeDash.toLowerCase().trim();
}

/** Resolve a calendar_hint to the matching GHL calendar.
 *  Returns the matched calendar plus a list of all active calendars (used by
 *  the availability tool to fall through gracefully when no match is found).
 */
async function resolveCalendarByHint(hint: string): Promise<{
  matched: { id: string; name: string } | null;
  all: { id: string; name: string }[];
}> {
  const all = (await ghl.getCalendars()).filter((c) => c.isActive !== false);
  const h = hint.toLowerCase().trim();
  if (!h) return { matched: null, all: all.map((c) => ({ id: c.id, name: c.name })) };
  // Use the same tiered matching as draft_appointment: exact > starts-with > whole-word > substring
  const lower = (s: string) => s.toLowerCase();
  const exact = all.find((c) => lower(c.name) === h);
  const startsWith = all.find((c) => lower(c.name).startsWith(h));
  const wholeWord = all.find((c) =>
    lower(c.name)
      .split(/\s+/)
      .some((word) => word === h)
  );
  const substring = all.find((c) => lower(c.name).includes(h));
  const matched = exact ?? startsWith ?? wholeWord ?? substring ?? null;
  return { matched, all: all.map((c) => ({ id: c.id, name: c.name })) };
}

async function executeGetCalendarAvailability(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  const hint = (input.calendar_hint as string | undefined)?.trim() ?? "";
  const startDate = input.start_date as string;
  const endDate = input.end_date as string;
  // Default to Eastern Time — NAH HQ runs on ET, all schedule display should match.
  const timezone = (input.timezone as string | undefined)?.trim() || "America/New_York";

  if (!hint) {
    return { data: "Error: calendar_hint is required. Pick from the calendar list in your context." };
  }

  const { matched, all } = await resolveCalendarByHint(hint);
  if (!matched) {
    const names = all.map((c) => c.name).join(", ");
    return {
      data: `No calendar matched "${hint}". Active calendars: ${names || "(none)"}. Ask the user which one they meant.`,
    };
  }

  const startMs = Date.parse(startDate);
  const endMs = Date.parse(endDate);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return { data: "Error: start_date and end_date must be ISO 8601." };
  }

  try {
    const slots = await ghl.getFreeSlots(matched.id, startMs, endMs, timezone);
    if (slots.length === 0) {
      return {
        data: `No open slots on "${matched.name}" between ${startDate} and ${endDate}. The calendar is fully booked or has no available hours in this window.`,
      };
    }
    // Convert UTC slots to the requested timezone for display.
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    const dateFmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const timeFmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    const tzAbbr = timezone === "America/New_York" ? "ET" : timezone;

    // Group by local date, show local times.
    const byDate = new Map<string, string[]>();
    for (const iso of slots.slice(0, 30)) {
      const d = new Date(iso);
      const dateKey = dateFmt.format(d);
      const list = byDate.get(dateKey) ?? [];
      list.push(timeFmt.format(d));
      byDate.set(dateKey, list);
    }
    const lines: string[] = [`Open slots on "${matched.name}" (${tzAbbr}, showing up to 30):`];
    for (const [date, times] of byDate) {
      lines.push(`  ${date}: ${times.length} slots → ${times.slice(0, 6).join(", ")}${times.length > 6 ? ", …" : ""}`);
    }
    if (slots.length > 30) lines.push(`  …${slots.length - 30} more slots not shown`);
    return { data: lines.join("\n") };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { data: `Error fetching availability for "${matched.name}": ${msg}` };
  }
}

async function executeDraftAppointment(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  let contactId = input.contact_id as string;
  const title = input.title as string;

  // Round start/end to nearest 30-min and default end to 1 hour after start
  const rawStart = new Date(input.start_time as string);
  const startMins = rawStart.getMinutes();
  rawStart.setMinutes(startMins < 15 ? 0 : startMins < 45 ? 30 : 60, 0, 0);
  const startTime = rawStart.toISOString();

  let endTime: string;
  if (input.end_time) {
    const rawEnd = new Date(input.end_time as string);
    const endMins = rawEnd.getMinutes();
    rawEnd.setMinutes(endMins < 15 ? 0 : endMins < 45 ? 30 : 60, 0, 0);
    endTime = rawEnd.toISOString();
  } else {
    endTime = new Date(rawStart.getTime() + 60 * 60 * 1000).toISOString();
  }

  // Ensure end is at least 30 min after start; default to 1 hour if not
  if (new Date(endTime).getTime() <= new Date(startTime).getTime()) {
    endTime = new Date(rawStart.getTime() + 60 * 60 * 1000).toISOString();
  }
  // If Scout didn't pass a calendar_hint, derive one from the title. Otherwise
  // we'd silently default to whatever calendar is first alphabetically, which
  // is almost never what the user meant (e.g. "Intro Call - Foo" landing on
  // "John Coaching Call" — Chad's actual bug).
  const rawHint = (input.calendar_hint as string | undefined)?.toLowerCase().trim();
  const calendarHint = rawHint && rawHint.length > 0 ? rawHint : deriveHintFromTitle(title);
  const assignedUserId = input.assigned_user_id as string | undefined;
  const currentUserGhlId = input._current_user_ghl_id as string | null;

  // Auto-resolve contact: if contact_id looks like a name (contains spaces,
  // no alphanumeric ID pattern), search for the real GHL contact ID.
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const GHL_ID_PATTERN = /^[A-Za-z0-9]{10,}$/; // GHL IDs are long alphanumeric strings
  if (contactId && !UUID_PATTERN.test(contactId) && !GHL_ID_PATTERN.test(contactId)) {
    // Looks like a name, not an ID — try to resolve it
    const supabaseSearch = createServerClient();
    const { data: matches } = await supabaseSearch
      .from("contacts")
      .select("ghl_contact_id, first_name, last_name")
      .or(`first_name.ilike.%${contactId.split(" ")[0]}%,last_name.ilike.%${contactId.split(" ").slice(-1)[0]}%`)
      .not("ghl_contact_id", "is", null)
      .limit(5);
    if (matches && matches.length === 1) {
      contactId = matches[0].ghl_contact_id!;
    } else if (matches && matches.length > 1) {
      const names = matches.map((m) => `${m.first_name} ${m.last_name}`.trim()).join(", ");
      return {
        data: `Error: "${contactId}" matched multiple contacts: ${names}. Use search_contacts to find the exact contact ID first.`,
      };
    } else {
      return {
        data: `Error: Could not resolve "${contactId}" to a known contact. Use search_contacts to find the contact first, then pass the contact_id from the result.`,
      };
    }
  }

  const contactName = await getContactName(contactId);

  // Block drafts with Unknown Contact — forces Scout to resolve first
  if (contactName === "Unknown Contact") {
    return {
      data: `Error: contact_id "${contactId}" did not resolve to a known contact. Use search_contacts to find the correct contact ID before drafting an appointment.`,
    };
  }

  // Default assignedUserId to current user if not specified
  const resolvedAssignedUserId = assignedUserId ?? currentUserGhlId ?? undefined;

  const supabase = createServerClient();

  // Resolve a calendar suggestion. The user can change it via the searchable
  // dropdown on the confirm card before pushing.
  let calendarId = "";
  let calendarName: string | undefined;
  let calendarReason: string | undefined;
  try {
    const calendars = (await ghl.getCalendars()).filter((c) => c.isActive !== false);
    if (calendars.length === 0) {
      await supabase.from("integration_logs").insert({
        integration_name: "scout-appointment",
        event_type: "draft",
        status: "failed",
        error_message: "No active calendars found in GHL location",
        related_contact_id: contactId,
      });
      return { data: "Error: No active calendars found in this GHL location." };
    }

    if (calendarHint) {
      // Match preference: exact > starts-with > whole-word contains > substring.
      // This prevents accidental hits like contact name "Chad Test" leaking
      // into hint="chad" and grabbing "Chad Onboarding" by substring.
      const lower = (s: string) => s.toLowerCase();
      const h = lower(calendarHint);
      const exact = calendars.find((c) => lower(c.name) === h);
      const startsWith = calendars.find((c) => lower(c.name).startsWith(h));
      const wholeWord = calendars.find((c) =>
        lower(c.name)
          .split(/\s+/)
          .some((word) => word === h)
      );
      const substring = calendars.find((c) => lower(c.name).includes(h));
      const match = exact ?? startsWith ?? wholeWord ?? substring;
      if (match) {
        calendarId = match.id;
        calendarName = match.name;
        const tier =
          match === exact
            ? "exact"
            : match === startsWith
              ? "starts-with"
              : match === wholeWord
                ? "whole-word"
                : "substring";
        calendarReason = `matched "${calendarHint}" via ${tier} on "${match.name}"`;
      }
    }

    if (!calendarId) {
      // Do NOT silently default — wrong calendar is worse than no calendar.
      // Return an error so Scout retries with a correct hint from its calendar context.
      const names = calendars.map((c) => c.name).join(", ");
      return {
        data: `Error: No calendar matched hint "${calendarHint}". Active calendars: ${names}. Pick the correct calendar name from your CALENDAR_CONTEXT and pass it as calendar_hint.`,
      };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await supabase.from("integration_logs").insert({
      integration_name: "scout-appointment",
      event_type: "draft",
      status: "failed",
      error_message: `getCalendars threw: ${msg}`,
      related_contact_id: contactId,
    });
    return { data: `Error fetching calendars: ${msg}` };
  }

  // Verify the requested slot is actually open before drafting.
  // If not, return nearby available slots so Scout can pick one.
  try {
    const startMs = Date.parse(startTime);
    const endMs = Date.parse(endTime);
    if (!Number.isNaN(startMs) && !Number.isNaN(endMs)) {
      // Check a 3-day window around the requested date for alternatives
      const dayMs = 86400000;
      const windowStart = startMs - dayMs;
      const windowEnd = startMs + dayMs * 3;
      const freeSlots = await ghl.getFreeSlots(calendarId, windowStart, windowEnd, "America/New_York");

      // Check if the requested start time matches any free slot
      const requestedStart = new Date(startTime).toISOString();
      const slotMatch = freeSlots.some((slot) => {
        const slotTime = new Date(slot).getTime();
        const reqTime = new Date(requestedStart).getTime();
        return Math.abs(slotTime - reqTime) < 60000; // within 1 minute
      });

      if (!slotMatch && freeSlots.length > 0) {
        const nearby = freeSlots.slice(0, 10).join(", ");
        return {
          data: `Error: The requested time (${new Date(startTime).toLocaleString("en-US", { timeZone: "America/New_York" })} ET) is not available on "${calendarName}". Available slots nearby: ${nearby}. Pick one and retry.`,
        };
      }
      if (!slotMatch && freeSlots.length === 0) {
        return {
          data: `Error: No open slots on "${calendarName}" in this time range. Ask the user for a different date or time.`,
        };
      }
    }
  } catch {
    // Availability check is best-effort — if it fails, let the draft proceed
    // and the user will see the error on confirm.
  }

  // Log the draft for auditability — every draft attempt shows up in
  // integration_logs so we can see what Scout picked, why, and whether
  // the user ever confirmed it (correlate with scout-appointment 'push' events).
  await supabase.from("integration_logs").insert({
    integration_name: "scout-appointment",
    event_type: "draft",
    status: "success",
    payload_summary: `"${title}" → ${calendarName} (hint="${calendarHint ?? ""}", reason=${calendarReason})`,
    related_contact_id: contactId,
  });

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

function computePeriodRange(period: string): {
  periodStart: Date;
  periodEndExclusive: Date;
  prevPeriodStart: Date;
  prevPeriodEndExclusive: Date;
} {
  const now = new Date();
  const todayEndExclusive = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  if (period === "all") {
    const periodStart = new Date(2000, 0, 1);
    return {
      periodStart,
      periodEndExclusive: todayEndExclusive,
      prevPeriodStart: new Date(2000, 0, 1),
      prevPeriodEndExclusive: periodStart,
    };
  }

  if (period === "ytd") {
    return {
      periodStart: new Date(now.getFullYear(), 0, 1),
      periodEndExclusive: todayEndExclusive,
      prevPeriodStart: new Date(now.getFullYear() - 1, 0, 1),
      prevPeriodEndExclusive: new Date(now.getFullYear() - 1, now.getMonth(), now.getDate() + 1),
    };
  }

  const months = period === "t1" ? 1 : period === "t12" ? 12 : 3;
  const periodStart = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
  return {
    periodStart,
    periodEndExclusive: todayEndExclusive,
    prevPeriodStart: new Date(now.getFullYear(), now.getMonth() - months * 2, now.getDate()),
    prevPeriodEndExclusive: periodStart,
  };
}

function isInPeriod(value: string | null, start: Date, endExclusive: Date): boolean {
  if (!value) return false;
  const date = new Date(value);
  return date >= start && date < endExclusive;
}

function masterSuiteStageKey(status: string | null): string | null {
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

/**
 * Dynamic data catalog — reads the full schema reference generated from migrations.
 * Loaded once at startup, cached in memory.
 */
import { readFileSync } from "fs";
import { resolve } from "path";

let _schemaCache: { tables: { name: string; columns: string }[]; raw: string } | null = null;

function loadSchemaReference(): { tables: { name: string; columns: string }[]; raw: string } {
  if (_schemaCache) return _schemaCache;

  try {
    const filePath = resolve(process.cwd(), "docs/scout-schema-condensed.txt");
    const raw = readFileSync(filePath, "utf-8");
    const tables = raw
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        const match = line.match(/^(\S+)\s+\(([^)]*)\):\s*(.*)$/);
        if (!match) return null;
        return { name: match[1], rowCount: match[2], columns: match[3] };
      })
      .filter(Boolean) as { name: string; rowCount: string; columns: string }[];

    _schemaCache = {
      tables: tables.map((t) => ({ name: t.name, columns: `${t.name} (${t.rowCount} rows): ${t.columns}` })),
      raw,
    };
    return _schemaCache;
  } catch {
    return { tables: [], raw: "Schema reference file not found." };
  }
}

async function executeDescribeData(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  const table = input.table as string | undefined;
  const schema = loadSchemaReference();

  if (table) {
    // Find the table in the schema reference
    const entry = schema.tables.find((t) => t.name === table);

    if (!entry) {
      // Search for partial matches
      const matches = schema.tables.filter((t) => t.name.includes(table));
      if (matches.length > 0) {
        return {
          data: JSON.stringify({
            error: `Table "${table}" not found. Did you mean: ${matches.map((m) => m.name).join(", ")}?`,
          }),
        };
      }
      return {
        data: JSON.stringify({
          error: `Table "${table}" not found. Use describe_data without a table parameter to see all ${schema.tables.length} tables.`,
        }),
      };
    }

    // Get live row count
    let rowCount: number | string = "unknown";
    try {
      const supabase = createServerClient();
      const { count } = await supabase.from(table).select("*", { count: "exact", head: true });
      rowCount = count ?? "unknown";
    } catch {
      // Use cached count from file
    }

    return {
      data: JSON.stringify({
        table,
        rowCount,
        schema: entry.columns,
      }),
    };
  }

  // Overview mode — return the full condensed schema (all 156 tables)
  return {
    data: JSON.stringify({
      totalTables: schema.tables.length,
      schema: schema.raw,
    }),
  };
}

async function executeTerritoryPerformance(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  try {
    const slug = input.TerritorySlug as string;
    const period = (input.period as string) ?? "t3";
    const { periodStart, periodEndExclusive, prevPeriodStart, prevPeriodEndExclusive } = computePeriodRange(period);
    const periodISO = periodStart.toISOString();
    const periodEndExclusiveISO = periodEndExclusive.toISOString();
    const shouldCapStatusHistory = period !== "all" && period !== "ytd";
    const supabase = createServerClient();

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
    const purchasedInPeriod = inventory.filter((i) => isInPeriod(i.Inv_PurchaseDate, periodStart, periodEndExclusive));
    const soldInPeriod = inventory.filter((i) => isInPeriod(i.Inv_SellDate, periodStart, periodEndExclusive));
    const activeInventory = inventory.filter((i) => !i.Inv_SellDate);
    const prevPurchased = inventory.filter((i) => {
      const d = new Date(i.Inv_PurchaseDate);
      return d >= prevPeriodStart && d < prevPeriodEndExclusive;
    });
    const prevSold = inventory.filter((i) => {
      if (!i.Inv_SellDate) return false;
      const d = new Date(i.Inv_SellDate);
      return d >= prevPeriodStart && d < prevPeriodEndExclusive;
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
        let historyQuery = supabase
          .from("ms_property_status_history")
          .select("PropertyId, NewStatus")
          .in("PropertyId", propIds.slice(i, i + 500))
          .gte("Inserted", periodISO);
        if (shouldCapStatusHistory) historyQuery = historyQuery.lt("Inserted", periodEndExclusiveISO);
        const { data: page } = await historyQuery;
        if (page) history = history.concat(page as typeof history);
      }

      const highest = new Map<number, number>();
      for (const h of history) {
        const key = masterSuiteStageKey(h.NewStatus);
        if (!key) continue;
        const rank = stageRank[key];
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
    const { periodStart, periodEndExclusive } = computePeriodRange(period);
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
      const purchased = inv.filter((i) => isInPeriod(i.Inv_PurchaseDate, periodStart, periodEndExclusive)).length;
      const sold = inv.filter((i) => isInPeriod(i.Inv_SellDate, periodStart, periodEndExclusive)).length;
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
      if (isInPeriod(inv.Inv_SellDate, periodStart, periodEndExclusive)) {
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
    const { periodStart, periodEndExclusive } = computePeriodRange(period);
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
      if (isInPeriod(inv.Inv_SellDate, periodStart, periodEndExclusive)) {
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
      const purchased = inv.filter((i) => isInPeriod(i.Inv_PurchaseDate, periodStart, periodEndExclusive)).length;
      const sold = inv.filter((i) => isInPeriod(i.Inv_SellDate, periodStart, periodEndExclusive)).length;
      const active = inv.filter((i) => !i.Inv_SellDate).length;
      const t12p = inv.filter((i) => new Date(i.Inv_PurchaseDate) >= t12Start).length;
      const profit = profitByTerritory.get(slug);

      // Cycle days for sold in period
      const soldInv = inv.filter((i) => isInPeriod(i.Inv_SellDate, periodStart, periodEndExclusive));
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
      .or(contactIdFilter(contactId))
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
