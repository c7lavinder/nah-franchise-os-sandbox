/**
 * Hybrid RAG Retriever
 *
 * Combines semantic search (pgvector) with structured data (direct Supabase queries)
 * to build rich context for Scout. Intent-routed: contact queries use filtered semantic
 * search + profile data, KB queries use pure semantic, BI queries use cross-contact search.
 */

import { createServerClient } from "@/lib/supabase/server";
import { searchEmbeddings, type SearchResult } from "./embedder";
import { getContactProfileFields, type ProfileFieldValue } from "@/lib/profile/profile-fields";

export interface RetrievedContext {
  semanticChunks: SearchResult[];
  contactProfile: Record<string, ProfileFieldValue> | null;
  recentJournals: Array<{ id: string; journal_date: string; summary: string }>;
  relevantKBDocs: SearchResult[];
  pipelineState: {
    pipelineId: string;
    pipelineName: string;
    currentStageName: string;
    daysInStage: number;
    subTasksComplete: number;
    subTasksTotal: number;
  } | null;
  contactName: string | null;
}

type ContentType = "transcript" | "kb_doc" | "external_research" | "journal" | "profile_summary";

interface RetrievalOptions {
  contactId?: string;
  contentTypes?: ContentType[];
  limit?: number;
  includeStructured?: boolean;
}

/**
 * Retrieve context for a query using hybrid approach.
 */
export async function retrieveContext(
  query: string,
  options: RetrievalOptions = {}
): Promise<RetrievedContext> {
  const {
    contactId,
    contentTypes,
    limit = 10,
    includeStructured = true,
  } = options;

  const supabase = createServerClient();

  const result: RetrievedContext = {
    semanticChunks: [],
    contactProfile: null,
    recentJournals: [],
    relevantKBDocs: [],
    pipelineState: null,
    contactName: null,
  };

  // Run semantic + structured queries in parallel
  const promises: Promise<void>[] = [];

  // 1. Semantic search — scoped to contact if provided
  if (contentTypes && contentTypes.length > 0) {
    for (const ct of contentTypes) {
      promises.push(
        searchEmbeddings({
          query,
          contentType: ct,
          contactId: ct !== "kb_doc" ? contactId : undefined,
          limit: Math.ceil(limit / contentTypes.length),
          threshold: 0.4,
        }).then((chunks) => {
          if (ct === "kb_doc") {
            result.relevantKBDocs.push(...chunks);
          } else {
            result.semanticChunks.push(...chunks);
          }
        }).catch(() => { /* continue if embedding search fails */ })
      );
    }
  } else {
    // Default: search transcripts + journals for contact, KB for all
    promises.push(
      searchEmbeddings({
        query,
        contactId,
        limit: limit,
        threshold: 0.4,
      }).then((chunks) => {
        for (const chunk of chunks) {
          if (chunk.contentType === "kb_doc") {
            result.relevantKBDocs.push(chunk);
          } else {
            result.semanticChunks.push(chunk);
          }
        }
      }).catch(() => {})
    );
  }

  // 2. Structured data — only if contactId provided
  if (contactId && includeStructured) {
    // Contact profile
    promises.push(
      getContactProfileFields(contactId).then((fields) => {
        result.contactProfile = fields;
      }).catch(() => {})
    );

    // Contact name
    promises.push(
      (async () => {
        const { data } = await supabase
          .from("contacts")
          .select("first_name, last_name")
          .eq("id", contactId)
          .single();
        if (data) {
          result.contactName = `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim() || null;
        }
      })().catch(() => {})
    );

    // Recent journals (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    promises.push(
      (async () => {
        const { data } = await supabase
          .from("contact_journals")
          .select("id, journal_date, summary")
          .eq("contact_id", contactId)
          .gte("journal_date", sevenDaysAgo)
          .order("journal_date", { ascending: false })
          .limit(7);
        result.recentJournals = data ?? [];
      })().catch(() => {})
    );

    // Pipeline state
    promises.push(
      (async () => {
        const { data } = await supabase
          .from("contact_pipeline_state")
          .select(`
            id, pipeline_id, current_stage_id, entered_current_stage_at,
            pipelines (name),
            pipeline_stages (name)
          `)
          .eq("contact_id", contactId)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();

        if (!data) return;
        const pipeline = data.pipelines as unknown as { name: string } | null;
        const stage = data.pipeline_stages as unknown as { name: string } | null;
        const enteredAt = new Date(data.entered_current_stage_at);
        const daysInStage = Math.floor(
          (Date.now() - enteredAt.getTime()) / (1000 * 60 * 60 * 24)
        );

        const { count: total } = await supabase
          .from("pipeline_sub_tasks")
          .select("id", { count: "exact", head: true })
          .eq("stage_id", data.current_stage_id);

        const { count: complete } = await supabase
          .from("contact_sub_task_logs")
          .select("id", { count: "exact", head: true })
          .eq("contact_id", contactId)
          .is("deleted_at", null);

        result.pipelineState = {
          pipelineId: data.pipeline_id,
          pipelineName: pipeline?.name ?? "Unknown",
          currentStageName: stage?.name ?? "Unknown",
          daysInStage,
          subTasksComplete: complete ?? 0,
          subTasksTotal: total ?? 0,
        };
      })().catch(() => {})
    );
  }

  await Promise.allSettled(promises);
  return result;
}

/**
 * Format retrieved context into a prompt-friendly string.
 */
export function formatContextForPrompt(ctx: RetrievedContext): string {
  const sections: string[] = [];

  if (ctx.contactName) {
    sections.push(`CONTACT: ${ctx.contactName}`);
  }

  if (ctx.pipelineState) {
    const ps = ctx.pipelineState;
    sections.push(
      `PIPELINE: ${ps.pipelineName} → ${ps.currentStageName} (${ps.daysInStage} days, ${ps.subTasksComplete}/${ps.subTasksTotal} sub-tasks)`
    );
  }

  if (ctx.contactProfile && Object.keys(ctx.contactProfile).length > 0) {
    const filled = Object.entries(ctx.contactProfile)
      .filter(([, v]) => v.field_value != null)
      .map(([k, v]) => `  ${k}: ${JSON.stringify(v.field_value)}`)
      .join("\n");
    if (filled) {
      sections.push(`PROFILE DATA:\n${filled}`);
    }
  }

  if (ctx.recentJournals.length > 0) {
    const journals = ctx.recentJournals
      .map((j) => `  [${j.journal_date}] ${j.summary}`)
      .join("\n");
    sections.push(`RECENT ACTIVITY:\n${journals}`);
  }

  if (ctx.semanticChunks.length > 0) {
    const chunks = ctx.semanticChunks
      .slice(0, 5)
      .map((c, i) => `  [${i + 1}] (${c.contentType}, sim=${c.similarity.toFixed(2)}) ${c.content.slice(0, 300)}`)
      .join("\n");
    sections.push(`RELEVANT CONTENT:\n${chunks}`);
  }

  if (ctx.relevantKBDocs.length > 0) {
    const kb = ctx.relevantKBDocs
      .slice(0, 3)
      .map((c, i) => `  [KB${i + 1}] ${c.content.slice(0, 400)}`)
      .join("\n");
    sections.push(`KNOWLEDGE BASE:\n${kb}`);
  }

  return sections.join("\n\n");
}
