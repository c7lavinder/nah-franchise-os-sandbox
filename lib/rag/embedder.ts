/**
 * RAG Embedding Pipeline
 *
 * Handles chunking and embedding for all content types:
 * - Transcripts: 400-token chunks with 50-token overlap
 * - KB docs: split on section headers (##)
 * - External research: 300-token chunks
 * - Journal entries: single chunk (short content)
 *
 * Uses OpenAI text-embedding-3-small (1536 dimensions).
 * Stores embeddings in Supabase pgvector `embeddings` table.
 */

import OpenAI from "openai";
import { createServerClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// OpenAI client (lazy init)
// ---------------------------------------------------------------------------

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing OPENAI_API_KEY environment variable");
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

// ---------------------------------------------------------------------------
// Core: get embedding vector from text
// ---------------------------------------------------------------------------

export async function getEmbedding(text: string): Promise<number[]> {
  const openai = getOpenAI();
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Cannot embed empty text");
  }

  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: trimmed,
  });

  return response.data[0].embedding;
}

// ---------------------------------------------------------------------------
// Chunking utilities
// ---------------------------------------------------------------------------

/**
 * Approximate token count (rough: 1 token ≈ 4 chars for English).
 * Good enough for chunking; exact counts not critical here.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Split text into chunks of approximately `maxTokens` tokens
 * with `overlap` token overlap between consecutive chunks.
 * Splits on sentence boundaries where possible.
 */
export function chunkText(text: string, maxTokens: number, overlap: number = 0): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current: string[] = [];
  let currentTokens = 0;

  for (const sentence of sentences) {
    const sentenceTokens = estimateTokens(sentence);

    if (currentTokens + sentenceTokens > maxTokens && current.length > 0) {
      chunks.push(current.join(" "));

      // Calculate overlap: keep trailing sentences that fit in overlap budget
      if (overlap > 0) {
        let overlapTokens = 0;
        const overlapSentences: string[] = [];
        for (let i = current.length - 1; i >= 0; i--) {
          const t = estimateTokens(current[i]);
          if (overlapTokens + t > overlap) break;
          overlapTokens += t;
          overlapSentences.unshift(current[i]);
        }
        current = overlapSentences;
        currentTokens = overlapTokens;
      } else {
        current = [];
        currentTokens = 0;
      }
    }

    current.push(sentence);
    currentTokens += sentenceTokens;
  }

  if (current.length > 0) {
    chunks.push(current.join(" "));
  }

  return chunks;
}

/**
 * Split a markdown document on ## headers into sections.
 * Each section includes its header as the first line.
 */
export function chunkBySection(markdown: string): string[] {
  const sections = markdown.split(/(?=^## )/m).filter((s) => s.trim().length > 0);
  return sections;
}

// ---------------------------------------------------------------------------
// Store embedding in Supabase
// ---------------------------------------------------------------------------

interface EmbeddingMetadata {
  chunk_index?: number;
  source_id?: string;
  category?: string;
  date?: string;
  rep_id?: string;
  call_id?: string;
  doc_title?: string;
  last_updated?: string;
  source?: string;
  [key: string]: unknown;
}

async function storeEmbedding(params: {
  contactId: string | null;
  contentType: "transcript" | "kb_doc" | "external_research" | "journal" | "profile_summary";
  content: string;
  embedding: number[];
  metadata: EmbeddingMetadata;
  tenantId?: string;
}): Promise<string> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("embeddings")
    .insert({
      contact_id: params.contactId,
      content_type: params.contentType,
      content: params.content,
      embedding: JSON.stringify(params.embedding),
      metadata: params.metadata,
      tenant_id: params.tenantId ?? null,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to store embedding: ${error.message}`);
  }

  return data.id;
}

// ---------------------------------------------------------------------------
// Embed transcript
// ---------------------------------------------------------------------------

export async function embedTranscript(transcriptId: string): Promise<{
  chunksEmbedded: number;
  embeddingIds: string[];
}> {
  const supabase = createServerClient();

  // Fetch transcript + call metadata
  const { data: transcript, error: txError } = await supabase
    .from("call_transcripts")
    .select("id, call_id, full_text")
    .eq("id", transcriptId)
    .single();

  if (txError || !transcript) {
    throw new Error(`Transcript not found: ${transcriptId}`);
  }

  const { data: call } = await supabase
    .from("calls")
    .select("id, contact_id, hosted_by_user_id, scheduled_at")
    .eq("id", transcript.call_id)
    .single();

  // Chunk by 400 tokens with 50-token overlap
  const chunks = chunkText(transcript.full_text, 400, 50);
  const embeddingIds: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const embedding = await getEmbedding(chunks[i]);
    const id = await storeEmbedding({
      contactId: call?.contact_id ?? null,
      contentType: "transcript",
      content: chunks[i],
      embedding,
      metadata: {
        chunk_index: i,
        source_id: transcriptId,
        call_id: transcript.call_id,
        rep_id: call?.hosted_by_user_id ?? undefined,
        date: call?.scheduled_at ?? undefined,
      },
    });
    embeddingIds.push(id);
  }

  return { chunksEmbedded: chunks.length, embeddingIds };
}

// ---------------------------------------------------------------------------
// Embed KB document
// ---------------------------------------------------------------------------

export async function embedKBDoc(docId: string): Promise<{
  sectionsEmbedded: number;
  embeddingIds: string[];
}> {
  const supabase = createServerClient();

  const { data: doc, error } = await supabase
    .from("knowledge_documents")
    .select("id, title, category, content, updated_at")
    .eq("id", docId)
    .single();

  if (error || !doc) {
    throw new Error(`KB document not found: ${docId}`);
  }

  // Delete old embeddings for this doc (safe for first embed — no-op)
  await supabase.from("embeddings").delete().eq("content_type", "kb_doc").contains("metadata", { source_id: docId });

  // Split on section headers
  const sections = chunkBySection(doc.content);
  const embeddingIds: string[] = [];

  for (let i = 0; i < sections.length; i++) {
    const embedding = await getEmbedding(sections[i]);
    const id = await storeEmbedding({
      contactId: null, // KB docs are not contact-specific
      contentType: "kb_doc",
      content: sections[i],
      embedding,
      metadata: {
        chunk_index: i,
        source_id: docId,
        doc_title: doc.title,
        category: doc.category,
        last_updated: doc.updated_at,
      },
    });
    embeddingIds.push(id);
  }

  return { sectionsEmbedded: sections.length, embeddingIds };
}

// ---------------------------------------------------------------------------
// Embed external research
// ---------------------------------------------------------------------------

export async function embedExternalResearch(
  contactId: string,
  content: string,
  source: string
): Promise<{
  chunksEmbedded: number;
  embeddingIds: string[];
}> {
  // Chunk by 300 tokens
  const chunks = chunkText(content, 300);
  const embeddingIds: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const embedding = await getEmbedding(chunks[i]);
    const id = await storeEmbedding({
      contactId,
      contentType: "external_research",
      content: chunks[i],
      embedding,
      metadata: {
        chunk_index: i,
        source,
        date: new Date().toISOString(),
      },
    });
    embeddingIds.push(id);
  }

  return { chunksEmbedded: chunks.length, embeddingIds };
}

// ---------------------------------------------------------------------------
// Embed journal entry (single chunk — journals are short)
// ---------------------------------------------------------------------------

export async function embedJournalEntry(journalId: string): Promise<string> {
  const supabase = createServerClient();

  const { data: journal, error } = await supabase
    .from("contact_journals")
    .select("id, contact_id, journal_date, summary")
    .eq("id", journalId)
    .single();

  if (error || !journal) {
    throw new Error(`Journal not found: ${journalId}`);
  }

  const embedding = await getEmbedding(journal.summary);
  const embeddingId = await storeEmbedding({
    contactId: journal.contact_id,
    contentType: "journal",
    content: journal.summary,
    embedding,
    metadata: {
      source_id: journalId,
      date: journal.journal_date,
    },
  });

  // Update journal with embedding reference
  await supabase.from("contact_journals").update({ embedding_id: embeddingId }).eq("id", journalId);

  return embeddingId;
}

// ---------------------------------------------------------------------------
// Semantic search
// ---------------------------------------------------------------------------

export interface SearchResult {
  id: string;
  contactId: string | null;
  contentType: string;
  content: string;
  metadata: EmbeddingMetadata;
  similarity: number;
}

export async function searchEmbeddings(params: {
  query: string;
  contentType?: "transcript" | "kb_doc" | "external_research" | "journal" | "profile_summary";
  contactId?: string;
  limit?: number;
  threshold?: number;
}): Promise<SearchResult[]> {
  const supabase = createServerClient();
  const queryEmbedding = await getEmbedding(params.query);

  const { data, error } = await supabase.rpc("match_embeddings", {
    query_embedding: JSON.stringify(queryEmbedding),
    content_type_filter: params.contentType ?? null,
    contact_id_filter: params.contactId ?? null,
    match_limit: params.limit ?? 10,
    similarity_threshold: params.threshold ?? 0.5,
  });

  if (error) {
    throw new Error(`Embedding search failed: ${error.message}`);
  }

  return (data ?? []).map(
    (row: {
      id: string;
      contact_id: string | null;
      content_type: string;
      content: string;
      metadata: EmbeddingMetadata;
      similarity: number;
    }) => ({
      id: row.id,
      contactId: row.contact_id,
      contentType: row.content_type,
      content: row.content,
      metadata: row.metadata,
      similarity: row.similarity,
    })
  );
}

// ---------------------------------------------------------------------------
// Backfill functions
// ---------------------------------------------------------------------------

export async function embedAllExistingTranscripts(): Promise<{
  total: number;
  embedded: number;
  failed: number;
}> {
  const supabase = createServerClient();
  const results = { total: 0, embedded: 0, failed: 0 };
  const PAGE_SIZE = 50;
  let offset = 0;

  // Paginate to avoid upstream timeouts on large tables
  while (true) {
    const { data: transcripts, error } = await supabase
      .from("call_transcripts")
      .select("id")
      .order("created_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed to fetch transcripts: ${error.message}`);
    }
    if (!transcripts || transcripts.length === 0) break;

    results.total += transcripts.length;

    for (const tx of transcripts) {
      try {
        // Check if already embedded
        const { count } = await supabase
          .from("embeddings")
          .select("id", { count: "exact", head: true })
          .eq("content_type", "transcript")
          .contains("metadata", { source_id: tx.id });

        if (count && count > 0) {
          continue; // Already embedded
        }

        await embedTranscript(tx.id);
        results.embedded++;
      } catch (err) {
        results.failed++;
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Failed to embed transcript ${tx.id}: ${message}`);
      }
    }

    if (transcripts.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return results;
}

export async function embedAllExistingKBDocs(): Promise<{
  total: number;
  embedded: number;
  failed: number;
}> {
  const supabase = createServerClient();
  const results = { total: 0, embedded: 0, failed: 0 };
  const PAGE_SIZE = 50;
  let offset = 0;

  while (true) {
    const { data: docs, error } = await supabase
      .from("knowledge_documents")
      .select("id")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed to fetch KB docs: ${error.message}`);
    }
    if (!docs || docs.length === 0) break;

    results.total += docs.length;

    for (const doc of docs) {
      try {
        // Check if already embedded — skipped for KB since embedKBDoc deletes old ones
        const { count } = await supabase
          .from("embeddings")
          .select("id", { count: "exact", head: true })
          .eq("content_type", "kb_doc")
          .contains("metadata", { source_id: doc.id });

        if (count && count > 0) {
          continue; // Already embedded
        }

        await embedKBDoc(doc.id);
        results.embedded++;
      } catch (err) {
        results.failed++;
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Failed to embed KB doc ${doc.id}: ${message}`);
      }
    }

    if (docs.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return results;
}
