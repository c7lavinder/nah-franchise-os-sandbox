/**
 * Retrieval Quality Logger — records what context was retrieved per Scout turn.
 *
 * Fire-and-forget: failures are caught and logged to console, never
 * breaking the caller's flow.
 */

import { createServerClient } from "@/lib/supabase/server";

export interface RetrievalLogParams {
  userId: string;
  sessionId?: string;
  questionType: string;
  userMessage: string;
  chunksRetrieved: number;
  tokenBudget: number;
  /** Chunk metadata from pre-fetch context injection */
  prefetchChunks: PrefetchChunkMeta[];
  /** Chunk metadata from explicit tool calls (search_knowledge, etc.) */
  toolRetrievalChunks?: PrefetchChunkMeta[];
  /** Total latency for the pre-fetch retrieval */
  latencyMs?: number;
}

export interface PrefetchChunkMeta {
  contentType: string;
  sourceId?: string;
  similarity: number;
  contentPreview: string;
}

/**
 * Log retrieval context for a Scout conversation turn.
 * Fire-and-forget — never throws.
 */
export async function logRetrieval(params: RetrievalLogParams): Promise<void> {
  try {
    const supabase = createServerClient();

    await supabase.from("scout_retrieval_logs").insert({
      user_id: params.userId,
      session_id: params.sessionId ?? null,
      question_type: params.questionType,
      user_message: params.userMessage.slice(0, 500),
      chunks_retrieved: params.chunksRetrieved,
      token_budget: params.tokenBudget,
      prefetch_chunks: params.prefetchChunks,
      tool_retrieval_chunks: params.toolRetrievalChunks ?? [],
      latency_ms: params.latencyMs ?? null,
    });
  } catch (err) {
    console.error("Failed to log retrieval:", err instanceof Error ? err.message : "Unknown error");
  }
}
