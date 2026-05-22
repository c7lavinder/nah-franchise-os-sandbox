-- Add model_version column to embeddings table
-- Enables selective re-embedding when models change (instead of full truncate + re-embed)

ALTER TABLE embeddings
ADD COLUMN IF NOT EXISTS model_version text DEFAULT 'voyage-3-large';

-- Backfill all existing rows (they were all embedded with voyage-3-large)
UPDATE embeddings SET model_version = 'voyage-3-large' WHERE model_version IS NULL;

-- Index for selective re-embedding queries
CREATE INDEX IF NOT EXISTS idx_embeddings_model_version ON embeddings(model_version);
