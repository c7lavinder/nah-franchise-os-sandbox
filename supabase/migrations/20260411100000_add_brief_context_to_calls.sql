-- Add brief_context column to calls table for agent-generated fresh context
ALTER TABLE calls ADD COLUMN IF NOT EXISTS brief_context text;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS brief_generated_at timestamptz;
