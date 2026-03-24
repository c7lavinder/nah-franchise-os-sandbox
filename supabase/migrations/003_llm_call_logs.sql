-- ============================================================
-- NAH Franchise OS — LLM Call Logs
-- ============================================================
-- Logs every call to the Claude API for debugging, cost tracking,
-- and improving Scout over time.
-- ============================================================

CREATE TABLE llm_call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255),
  model VARCHAR(100) NOT NULL,
  input_messages JSONB NOT NULL,
  output_content JSONB NOT NULL,
  tool_calls JSONB DEFAULT '[]'::jsonb,
  stop_reason VARCHAR(50),
  input_tokens INTEGER,
  output_tokens INTEGER,
  latency_ms INTEGER,
  error_message TEXT,
  iteration INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_llm_logs_user ON llm_call_logs(user_id);
CREATE INDEX idx_llm_logs_created ON llm_call_logs(created_at);
CREATE INDEX idx_llm_logs_model ON llm_call_logs(model);
CREATE INDEX idx_llm_logs_error ON llm_call_logs(error_message) WHERE error_message IS NOT NULL;
