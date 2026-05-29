-- Scout prompt metadata for LLM call auditability.
-- Backward compatible: existing rows keep NULL/[] values, and callers can
-- continue inserting logs without providing these columns.

ALTER TABLE llm_call_logs
  ADD COLUMN IF NOT EXISTS prompt_version TEXT,
  ADD COLUMN IF NOT EXISTS prompt_blocks JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_llm_logs_prompt_version
  ON llm_call_logs(prompt_version)
  WHERE prompt_version IS NOT NULL;

INSERT INTO app_settings (setting_key, setting_value, description)
VALUES
  ('scout_calendars', '""'::jsonb, 'Scout calendar context and routing rules. Empty = use hardcoded default.')
ON CONFLICT (setting_key) DO NOTHING;
