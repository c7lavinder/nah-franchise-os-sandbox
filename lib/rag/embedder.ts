/**
 * RAG Embedding Pipeline
 *
 * Handles chunking and embedding for all content types:
 * - Transcripts: 400-token chunks with 50-token overlap
 * - KB docs: split on section headers (##)
 * - External research: 300-token chunks
 * - Journal entries: single chunk (short content)
 *
 * Uses Voyage AI voyage-3-large (1024 dimensions).
 * Stores embeddings in Supabase pgvector `embeddings` table.
 */

import { VoyageAIClient } from "voyageai";
import { createServerClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Voyage AI client (lazy init)
// ---------------------------------------------------------------------------

let voyageClient: VoyageAIClient | null = null;

function getVoyage(): VoyageAIClient {
  if (!voyageClient) {
    const apiKey = process.env.VOYAGE_API_KEY;
    if (!apiKey) {
      throw new Error("Missing VOYAGE_API_KEY environment variable");
    }
    voyageClient = new VoyageAIClient({ apiKey });
  }
  return voyageClient;
}

const VOYAGE_MODEL = "voyage-3-large";

// ---------------------------------------------------------------------------
// Core: get embedding vector from text
// ---------------------------------------------------------------------------

export async function getEmbedding(text: string): Promise<number[]> {
  const voyage = getVoyage();
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Cannot embed empty text");
  }

  const response = await voyage.embed({
    input: [trimmed],
    model: VOYAGE_MODEL,
  });

  if (!response.data || response.data.length === 0 || !response.data[0].embedding) {
    throw new Error("Voyage AI returned no embedding");
  }

  return response.data[0].embedding;
}

/**
 * Batch embed multiple texts at once (Voyage supports up to 128 texts per call).
 * More efficient than calling getEmbedding() in a loop.
 */
export async function getEmbeddingBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const voyage = getVoyage();
  const trimmed = texts.map((t) => t.trim()).filter((t) => t.length > 0);
  if (trimmed.length === 0) return [];

  const BATCH_SIZE = 128;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < trimmed.length; i += BATCH_SIZE) {
    const batch = trimmed.slice(i, i + BATCH_SIZE);
    const response = await voyage.embed({
      input: batch,
      model: VOYAGE_MODEL,
    });

    if (!response.data) {
      throw new Error("Voyage AI returned no data for batch");
    }

    for (const item of response.data) {
      if (!item.embedding) {
        throw new Error("Voyage AI returned null embedding in batch");
      }
      allEmbeddings.push(item.embedding);
    }
  }

  return allEmbeddings;
}

// ---------------------------------------------------------------------------
// Contextual chunking helpers
// ---------------------------------------------------------------------------

interface TranscriptContext {
  contactName?: string;
  callDate?: string;
  repName?: string;
}

interface KBDocContext {
  title: string;
  category?: string;
  lastUpdated?: string;
}

/**
 * Prepend contextual metadata to a transcript chunk before embedding.
 * Improves retrieval by giving the embedding model richer context.
 */
export function contextualizeTranscriptChunk(chunk: string, ctx: TranscriptContext, chunkIndex: number): string {
  const parts: string[] = [];
  parts.push("Call transcript");
  if (ctx.contactName) parts.push(`with ${ctx.contactName}`);
  if (ctx.callDate) parts.push(`on ${ctx.callDate}`);
  if (ctx.repName) parts.push(`(rep: ${ctx.repName})`);
  parts.push(`[chunk ${chunkIndex + 1}]`);
  return `${parts.join(" ")}:\n${chunk}`;
}

/**
 * Prepend contextual metadata to a KB doc section before embedding.
 */
export function contextualizeKBChunk(section: string, ctx: KBDocContext, sectionIndex: number): string {
  const parts: string[] = [];
  parts.push(`Knowledge base: ${ctx.title}`);
  if (ctx.category) parts.push(`(${ctx.category})`);
  if (ctx.lastUpdated) parts.push(`[updated ${ctx.lastUpdated}]`);
  parts.push(`[section ${sectionIndex + 1}]`);
  return `${parts.join(" ")}:\n${section}`;
}

// ---------------------------------------------------------------------------
// Chunking utilities
// ---------------------------------------------------------------------------

/**
 * Approximate token count (rough: 1 token ~ 4 chars for English).
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
// Embed transcript (with contextual chunking)
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

  // Delete old embeddings for this transcript (safe for first embed — no-op)
  await supabase
    .from("embeddings")
    .delete()
    .eq("content_type", "transcript")
    .contains("metadata", { source_id: transcriptId });

  const { data: call } = await supabase
    .from("calls")
    .select("id, contact_id, hosted_by_user_id, scheduled_at")
    .eq("id", transcript.call_id)
    .single();

  // Get contact name for contextual chunking
  let contactName: string | undefined;
  if (call?.contact_id) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("first_name, last_name")
      .eq("id", call.contact_id)
      .single();
    if (contact) {
      contactName = `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || undefined;
    }
  }

  // Chunk by 400 tokens with 50-token overlap
  const rawChunks = chunkText(transcript.full_text, 400, 50);

  // Contextualize chunks
  const txCtx: TranscriptContext = {
    contactName,
    callDate: call?.scheduled_at ? new Date(call.scheduled_at).toISOString().split("T")[0] : undefined,
  };

  const contextualizedChunks = rawChunks.map((chunk, i) => contextualizeTranscriptChunk(chunk, txCtx, i));

  // Batch embed all chunks
  const embeddings = await getEmbeddingBatch(contextualizedChunks);
  const embeddingIds: string[] = [];

  for (let i = 0; i < rawChunks.length; i++) {
    const id = await storeEmbedding({
      contactId: call?.contact_id ?? null,
      contentType: "transcript",
      content: rawChunks[i], // Store raw content for display
      embedding: embeddings[i],
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

  return { chunksEmbedded: rawChunks.length, embeddingIds };
}

// ---------------------------------------------------------------------------
// Embed KB document (with contextual chunking)
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

  // Delete old embeddings for this doc (safe for first embed -- no-op)
  await supabase.from("embeddings").delete().eq("content_type", "kb_doc").contains("metadata", { source_id: docId });

  // Split on section headers
  const rawSections = chunkBySection(doc.content);

  // Contextualize sections
  const kbCtx: KBDocContext = {
    title: doc.title,
    category: doc.category,
    lastUpdated: doc.updated_at ? new Date(doc.updated_at).toISOString().split("T")[0] : undefined,
  };

  const contextualizedSections = rawSections.map((section, i) => contextualizeKBChunk(section, kbCtx, i));

  // Batch embed all sections
  const embeddings = await getEmbeddingBatch(contextualizedSections);
  const embeddingIds: string[] = [];

  for (let i = 0; i < rawSections.length; i++) {
    const id = await storeEmbedding({
      contactId: null,
      contentType: "kb_doc",
      content: rawSections[i], // Store raw content for display
      embedding: embeddings[i],
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

  return { sectionsEmbedded: rawSections.length, embeddingIds };
}

// ---------------------------------------------------------------------------
// Embed external research (with optional contextual chunking)
// ---------------------------------------------------------------------------

interface ExternalResearchContext {
  contactName?: string;
  documentTitle?: string;
  documentType?: string;
}

/**
 * Prepend contextual metadata to an external research chunk before embedding.
 */
export function contextualizeExternalChunk(chunk: string, ctx: ExternalResearchContext, chunkIndex: number): string {
  const parts: string[] = [];
  if (ctx.documentType) parts.push(ctx.documentType);
  if (ctx.documentTitle) parts.push(`"${ctx.documentTitle}"`);
  if (ctx.contactName) parts.push(`for ${ctx.contactName}`);
  parts.push(`[chunk ${chunkIndex + 1}]`);
  return `${parts.join(" ")}:\n${chunk}`;
}

export async function embedExternalResearch(
  contactId: string,
  content: string,
  source: string,
  context?: ExternalResearchContext
): Promise<{
  chunksEmbedded: number;
  embeddingIds: string[];
}> {
  const supabase = createServerClient();

  // Delete old embeddings for this contact + source (safe re-embed)
  await supabase
    .from("embeddings")
    .delete()
    .eq("content_type", "external_research")
    .eq("contact_id", contactId)
    .contains("metadata", { source });

  // If contactName not provided but we have a contactId, look it up
  let ctx = context ?? {};
  if (!ctx.contactName && contactId) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("first_name, last_name")
      .eq("id", contactId)
      .single();
    if (contact) {
      ctx = { ...ctx, contactName: `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || undefined };
    }
  }

  const rawChunks = chunkText(content, 300);

  // Contextualize chunks if we have any metadata
  const hasContext = ctx.contactName || ctx.documentTitle || ctx.documentType;
  const contextualizedChunks = hasContext
    ? rawChunks.map((chunk, i) => contextualizeExternalChunk(chunk, ctx, i))
    : rawChunks;

  const embeddings = await getEmbeddingBatch(contextualizedChunks);
  const embeddingIds: string[] = [];

  for (let i = 0; i < rawChunks.length; i++) {
    const id = await storeEmbedding({
      contactId,
      contentType: "external_research",
      content: rawChunks[i], // Store raw content for display
      embedding: embeddings[i],
      metadata: {
        chunk_index: i,
        source,
        date: new Date().toISOString(),
        doc_title: ctx.documentTitle,
        doc_type: ctx.documentType,
      },
    });
    embeddingIds.push(id);
  }

  return { chunksEmbedded: rawChunks.length, embeddingIds };
}

// ---------------------------------------------------------------------------
// Embed journal entry (single chunk -- journals are short)
// ---------------------------------------------------------------------------

/**
 * Prepend contextual metadata to a journal entry before embedding.
 */
export function contextualizeJournalChunk(
  summary: string,
  contactName: string | undefined,
  journalDate: string
): string {
  const parts: string[] = ["Journal entry"];
  if (contactName) parts.push(`for ${contactName}`);
  parts.push(`on ${journalDate}`);
  return `${parts.join(" ")}:\n${summary}`;
}

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

  // Delete old embedding for this journal (safe re-embed)
  await supabase
    .from("embeddings")
    .delete()
    .eq("content_type", "journal")
    .contains("metadata", { source_id: journalId });

  // Look up contact name for contextual chunking
  let contactName: string | undefined;
  if (journal.contact_id) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("first_name, last_name")
      .eq("id", journal.contact_id)
      .single();
    if (contact) {
      contactName = `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || undefined;
    }
  }

  const contextualizedContent = contextualizeJournalChunk(journal.summary, contactName, journal.journal_date);
  const embedding = await getEmbedding(contextualizedContent);
  const embeddingId = await storeEmbedding({
    contactId: journal.contact_id,
    contentType: "journal",
    content: journal.summary, // Store raw content for display
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
        // Check if already embedded -- skipped for KB since embedKBDoc deletes old ones
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
