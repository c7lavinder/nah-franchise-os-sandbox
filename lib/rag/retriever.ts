/**
 * Hybrid RAG Retriever
 *
 * Combines semantic search (pgvector cosine) with BM25 full-text search,
 * merged via reciprocal rank fusion (RRF). Optionally reranks via Voyage AI.
 *
 * Also pulls structured data (profile fields, pipeline, journals) for
 * contact-scoped queries.
 */

import { createServerClient } from "@/lib/supabase/server";
import { searchEmbeddings, type SearchResult } from "./embedder";
import { getContactProfileFields, type ProfileFieldValue } from "@/lib/profile/profile-fields";

// ---------------------------------------------------------------------------
// Voyage reranker
// ---------------------------------------------------------------------------

interface VoyageRerankResponse {
  data?: Array<{
    index?: number;
    relevance_score?: number;
    relevanceScore?: number;
  }>;
}

/**
 * Rerank results using Voyage AI rerank-2 model.
 * Returns results sorted by relevance to the query.
 */
async function voyageRerank(query: string, results: SearchResult[], topK: number): Promise<SearchResult[]> {
  if (results.length === 0) return [];

  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    throw new Error("Missing VOYAGE_API_KEY environment variable");
  }

  const documents = results.map((r) => r.content);

  const response = await fetch("https://api.voyageai.com/v1/rerank", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      documents,
      model: "rerank-2",
      top_k: Math.min(topK, results.length),
    }),
  });

  if (!response.ok) {
    console.error(
      `Voyage rerank failed (${response.status}): ${await response.text().catch(() => response.statusText)}`
    );
    return results.slice(0, topK);
  }

  const body = (await response.json()) as VoyageRerankResponse;
  if (!body.data) return results.slice(0, topK);

  return body.data
    .filter((item) => item.index != null)
    .map((item) => ({
      ...results[item.index!],
      similarity: item.relevance_score ?? item.relevanceScore ?? results[item.index!].similarity,
    }));
}

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
  useHybrid?: boolean;
}

// ---------------------------------------------------------------------------
// BM25 full-text search via Supabase RPC
// ---------------------------------------------------------------------------

interface BM25Result {
  id: string;
  contactId: string | null;
  contentType: string;
  content: string;
  metadata: Record<string, unknown>;
  rank: number;
}

async function searchBM25(params: {
  query: string;
  contentType?: string;
  contactId?: string;
  limit?: number;
}): Promise<BM25Result[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase.rpc("search_embeddings_bm25", {
    search_query: params.query,
    content_type_filter: params.contentType ?? null,
    contact_id_filter: params.contactId ?? null,
    match_limit: params.limit ?? 20,
  });

  if (error) {
    console.error(`BM25 search failed: ${error.message}`);
    return [];
  }

  return (data ?? []).map(
    (row: {
      id: string;
      contact_id: string | null;
      content_type: string;
      content: string;
      metadata: Record<string, unknown>;
      rank: number;
    }) => ({
      id: row.id,
      contactId: row.contact_id,
      contentType: row.content_type,
      content: row.content,
      metadata: row.metadata,
      rank: row.rank,
    })
  );
}

// ---------------------------------------------------------------------------
// Reciprocal Rank Fusion (RRF)
// ---------------------------------------------------------------------------

const RRF_K = 60; // Standard RRF constant

interface RankedItem {
  id: string;
  contactId: string | null;
  contentType: string;
  content: string;
  metadata: Record<string, unknown>;
  score: number;
}

/**
 * Merge semantic and BM25 results using reciprocal rank fusion.
 * Each result gets score = 1 / (k + rank) from each list, summed.
 */
function reciprocalRankFusion(semanticResults: SearchResult[], bm25Results: BM25Result[], limit: number): RankedItem[] {
  const scores = new Map<string, RankedItem>();

  // Score semantic results
  for (let i = 0; i < semanticResults.length; i++) {
    const r = semanticResults[i];
    const rrfScore = 1 / (RRF_K + i + 1);
    scores.set(r.id, {
      id: r.id,
      contactId: r.contactId,
      contentType: r.contentType,
      content: r.content,
      metadata: r.metadata,
      score: rrfScore,
    });
  }

  // Score BM25 results and merge
  for (let i = 0; i < bm25Results.length; i++) {
    const r = bm25Results[i];
    const rrfScore = 1 / (RRF_K + i + 1);
    const existing = scores.get(r.id);
    if (existing) {
      existing.score += rrfScore;
    } else {
      scores.set(r.id, {
        id: r.id,
        contactId: r.contactId,
        contentType: r.contentType,
        content: r.content,
        metadata: r.metadata,
        score: rrfScore,
      });
    }
  }

  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Hybrid search: semantic + BM25 with RRF
// ---------------------------------------------------------------------------

export async function hybridSearch(params: {
  query: string;
  contentType?: ContentType;
  contactId?: string;
  limit?: number;
  threshold?: number;
  rerank?: boolean;
}): Promise<SearchResult[]> {
  const limit = params.limit ?? 10;
  const shouldRerank = params.rerank ?? true;
  const fetchLimit = shouldRerank ? limit * 3 : limit * 2; // Over-fetch more for reranking

  // Run semantic and BM25 in parallel
  const [semanticResults, bm25Results] = await Promise.all([
    searchEmbeddings({
      query: params.query,
      contentType: params.contentType,
      contactId: params.contactId,
      limit: fetchLimit,
      threshold: params.threshold ?? 0.3,
    }),
    searchBM25({
      query: params.query,
      contentType: params.contentType,
      contactId: params.contactId,
      limit: fetchLimit,
    }),
  ]);

  // If BM25 returned nothing (query didn't match any terms), fall back to semantic only
  if (bm25Results.length === 0 && !shouldRerank) {
    return semanticResults.slice(0, limit);
  }

  // Fuse with RRF
  const fusedLimit = shouldRerank ? limit * 2 : limit; // Keep more for reranking pass
  const fused =
    bm25Results.length > 0
      ? reciprocalRankFusion(semanticResults, bm25Results, fusedLimit)
      : semanticResults.slice(0, fusedLimit).map((r) => ({
          id: r.id,
          contactId: r.contactId,
          contentType: r.contentType,
          content: r.content,
          metadata: r.metadata as Record<string, unknown>,
          score: r.similarity,
        }));

  const fusedAsSearchResults: SearchResult[] = fused.map((item) => ({
    id: item.id,
    contactId: item.contactId,
    contentType: item.contentType,
    content: item.content,
    metadata: item.metadata as SearchResult["metadata"],
    similarity: item.score,
  }));

  // Rerank with Voyage AI
  if (shouldRerank && fusedAsSearchResults.length > 0) {
    try {
      return await voyageRerank(params.query, fusedAsSearchResults, limit);
    } catch (err) {
      console.error("Voyage rerank failed, falling back to RRF order:", err);
      return fusedAsSearchResults.slice(0, limit);
    }
  }

  return fusedAsSearchResults.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Main retrieval function
// ---------------------------------------------------------------------------

/**
 * Retrieve context for a query using hybrid approach.
 */
export async function retrieveContext(query: string, options: RetrievalOptions = {}): Promise<RetrievedContext> {
  const { contactId, contentTypes, limit = 10, includeStructured = true, useHybrid = true } = options;

  const supabase = createServerClient();

  const result: RetrievedContext = {
    semanticChunks: [],
    contactProfile: null,
    recentJournals: [],
    relevantKBDocs: [],
    pipelineState: null,
    contactName: null,
  };

  // Choose search function
  const searchFn = useHybrid ? hybridSearch : searchEmbeddings;

  // Run semantic + structured queries in parallel
  const promises: Promise<void>[] = [];

  // 1. Search -- scoped to contact if provided
  if (contentTypes && contentTypes.length > 0) {
    for (const ct of contentTypes) {
      promises.push(
        searchFn({
          query,
          contentType: ct,
          contactId: ct !== "kb_doc" ? contactId : undefined,
          limit: Math.ceil(limit / contentTypes.length),
          threshold: 0.3,
        })
          .then((chunks) => {
            if (ct === "kb_doc") {
              result.relevantKBDocs.push(...chunks);
            } else {
              result.semanticChunks.push(...chunks);
            }
          })
          .catch(() => {
            /* continue if search fails */
          })
      );
    }
  } else {
    // Default: search all types for contact, KB for all
    promises.push(
      searchFn({
        query,
        contactId,
        limit: limit,
        threshold: 0.3,
      })
        .then((chunks) => {
          for (const chunk of chunks) {
            if (chunk.contentType === "kb_doc") {
              result.relevantKBDocs.push(chunk);
            } else {
              result.semanticChunks.push(chunk);
            }
          }
        })
        .catch(() => {})
    );
  }

  // 2. Structured data -- only if contactId provided
  if (contactId && includeStructured) {
    // Contact profile
    promises.push(
      getContactProfileFields(contactId)
        .then((fields) => {
          result.contactProfile = fields;
        })
        .catch(() => {})
    );

    // Contact name
    promises.push(
      (async () => {
        const { data } = await supabase.from("contacts").select("first_name, last_name").eq("id", contactId).single();
        if (data) {
          result.contactName = `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim() || null;
        }
      })().catch(() => {})
    );

    // Recent journals (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
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
          .from("journey_pipeline_state")
          .select(
            `
            id, pipeline_id, current_stage_id, entered_current_stage_at,
            pipelines (name),
            pipeline_stages (name),
            journeys!inner(primary_contact_id)
          `
          )
          .eq("journeys.primary_contact_id", contactId)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();

        if (!data) return;
        const pipeline = data.pipelines as unknown as { name: string } | null;
        const stage = data.pipeline_stages as unknown as { name: string } | null;
        const enteredAt = new Date(data.entered_current_stage_at);
        const daysInStage = Math.floor((Date.now() - enteredAt.getTime()) / (1000 * 60 * 60 * 24));

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
    const journals = ctx.recentJournals.map((j) => `  [${j.journal_date}] ${j.summary}`).join("\n");
    sections.push(`RECENT ACTIVITY:\n${journals}`);
  }

  if (ctx.semanticChunks.length > 0) {
    const chunks = ctx.semanticChunks
      .slice(0, 5)
      .map((c, i) => `  [${i + 1}] (${c.contentType}, score=${c.similarity.toFixed(3)}) ${c.content.slice(0, 300)}`)
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
