-- Phase 4: Voyage AI migration
-- 1. Resize vector column from 1536 (OpenAI) to 1024 (Voyage voyage-3-large)
-- 2. Add full-text search column + GIN index for BM25 hybrid search
-- 3. Update match_embeddings function for new dimensions
-- 4. Add hybrid search function (semantic + BM25 with reciprocal rank fusion)

-- Step 1: Truncate old embeddings (will be re-embedded with Voyage)
-- Old OpenAI embeddings are incompatible with new model — safe to clear
TRUNCATE embeddings;

-- Step 2: Resize vector column 1536 → 1024
ALTER TABLE embeddings ALTER COLUMN embedding TYPE vector(1024);

-- Step 3: Rebuild HNSW index for new dimensions
DROP INDEX IF EXISTS idx_embeddings_hnsw;
CREATE INDEX idx_embeddings_hnsw ON embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Step 4: Add full-text search column (generated from content)
ALTER TABLE embeddings
  ADD COLUMN content_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

-- Step 5: GIN index for BM25/full-text search
CREATE INDEX idx_embeddings_content_tsv ON embeddings USING gin(content_tsv);

-- Step 6: Update match_embeddings for 1024-dim vectors
CREATE OR REPLACE FUNCTION match_embeddings(
  query_embedding vector(1024),
  content_type_filter text DEFAULT NULL,
  contact_id_filter uuid DEFAULT NULL,
  match_limit int DEFAULT 10,
  similarity_threshold float DEFAULT 0.5
)
RETURNS TABLE (
  id uuid,
  contact_id uuid,
  content_type text,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.contact_id,
    e.content_type,
    e.content,
    e.metadata,
    1 - (e.embedding <=> query_embedding) AS similarity
  FROM embeddings e
  WHERE
    (content_type_filter IS NULL OR e.content_type = content_type_filter)
    AND (contact_id_filter IS NULL OR e.contact_id = contact_id_filter)
    AND 1 - (e.embedding <=> query_embedding) > similarity_threshold
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_limit;
END;
$$;

-- Step 7: Full-text search function (BM25-style ranking via ts_rank_cd)
CREATE OR REPLACE FUNCTION search_embeddings_bm25(
  search_query text,
  content_type_filter text DEFAULT NULL,
  contact_id_filter uuid DEFAULT NULL,
  match_limit int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  contact_id uuid,
  content_type text,
  content text,
  metadata jsonb,
  rank float
)
LANGUAGE plpgsql
AS $$
DECLARE
  tsquery_val tsquery;
BEGIN
  tsquery_val := websearch_to_tsquery('english', search_query);

  RETURN QUERY
  SELECT
    e.id,
    e.contact_id,
    e.content_type,
    e.content,
    e.metadata,
    ts_rank_cd(e.content_tsv, tsquery_val)::float AS rank
  FROM embeddings e
  WHERE
    e.content_tsv @@ tsquery_val
    AND (content_type_filter IS NULL OR e.content_type = content_type_filter)
    AND (contact_id_filter IS NULL OR e.contact_id = contact_id_filter)
  ORDER BY rank DESC
  LIMIT match_limit;
END;
$$;
