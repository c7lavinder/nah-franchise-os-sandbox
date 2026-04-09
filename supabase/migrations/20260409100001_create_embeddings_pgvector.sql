-- Sprint LLM-1 Task 2: pgvector Embeddings Table
-- Single embeddings table for all content types with metadata filtering.

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  content_type text NOT NULL
    CHECK (content_type IN ('transcript', 'kb_doc', 'external_research', 'journal', 'profile_summary')),
  content text NOT NULL,
  embedding vector(1536) NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- HNSW index for fast approximate nearest neighbor search
-- Using cosine distance (most common for OpenAI embeddings)
CREATE INDEX idx_embeddings_hnsw ON embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Filtering indexes
CREATE INDEX idx_embeddings_content_type ON embeddings(content_type);
CREATE INDEX idx_embeddings_contact_id ON embeddings(contact_id);
CREATE INDEX idx_embeddings_tenant_id ON embeddings(tenant_id);
CREATE INDEX idx_embeddings_created_at ON embeddings(created_at);

-- Composite for filtered similarity search
CREATE INDEX idx_embeddings_type_contact ON embeddings(content_type, contact_id);

-- RLS
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "embeddings_read_authenticated"
  ON embeddings FOR SELECT TO authenticated USING (true);
CREATE POLICY "embeddings_write_authenticated"
  ON embeddings FOR INSERT TO authenticated WITH CHECK (true);

-- Helper function: match_embeddings
-- Returns top-k most similar embeddings with cosine similarity score
CREATE OR REPLACE FUNCTION match_embeddings(
  query_embedding vector(1536),
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

-- Updated_at trigger
CREATE TRIGGER embeddings_updated_at
  BEFORE UPDATE ON embeddings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
