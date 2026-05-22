-- Scout retrieval quality logging
-- Tracks what context was retrieved per Scout conversation turn,
-- enabling retrieval quality analysis and tuning.

CREATE TABLE IF NOT EXISTS scout_retrieval_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  session_id text,
  question_type text NOT NULL DEFAULT 'general',
  user_message text,
  chunks_retrieved integer NOT NULL DEFAULT 0,
  token_budget integer NOT NULL DEFAULT 0,
  prefetch_chunks jsonb DEFAULT '[]',
  tool_retrieval_chunks jsonb DEFAULT '[]',
  latency_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for querying by user and date
CREATE INDEX idx_scout_retrieval_logs_user_created
  ON scout_retrieval_logs (user_id, created_at DESC);

-- Index for analyzing question type distribution
CREATE INDEX idx_scout_retrieval_logs_question_type
  ON scout_retrieval_logs (question_type, created_at DESC);

COMMENT ON TABLE scout_retrieval_logs IS 'Tracks retrieval context per Scout conversation turn for quality analysis';
COMMENT ON COLUMN scout_retrieval_logs.question_type IS 'Classified question type: prospect, franchisee, territory, call_prep, comparison, metric, search, knowledge, general';
COMMENT ON COLUMN scout_retrieval_logs.prefetch_chunks IS 'JSON array of chunks injected via pre-fetch context (content type, source, similarity)';
COMMENT ON COLUMN scout_retrieval_logs.tool_retrieval_chunks IS 'JSON array of chunks retrieved via explicit tool calls (search_knowledge, search_transcripts, search_documents)';
