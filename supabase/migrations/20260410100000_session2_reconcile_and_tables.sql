-- Session 2 — Step 0: Reconcile + Step 2: New tables
-- ════════════════════════════════════════════════════════

-- Step 0: Add missing columns to suggestion_feedback
ALTER TABLE suggestion_feedback
  ADD COLUMN IF NOT EXISTS call_type text,
  ADD COLUMN IF NOT EXISTS pipeline_stage text,
  ADD COLUMN IF NOT EXISTS territory_ms_slug text REFERENCES territories(ms_slug),
  ADD COLUMN IF NOT EXISTS field_name text,
  ADD COLUMN IF NOT EXISTS suggested_value text,
  ADD COLUMN IF NOT EXISTS final_value text,
  ADD COLUMN IF NOT EXISTS confidence text,
  ADD COLUMN IF NOT EXISTS reviewer_id text,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS suggestion_id uuid;

-- Step 2a: data_update_suggestions
CREATE TABLE IF NOT EXISTS data_update_suggestions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id text REFERENCES contacts(ghl_contact_id) ON DELETE CASCADE,
  territory_ms_slug text REFERENCES territories(ms_slug) ON DELETE CASCADE,
  field_name text NOT NULL,
  field_table text NOT NULL,
  current_value text,
  suggested_value text NOT NULL,
  source text NOT NULL CHECK (source IN (
    'call','scout_chat','document','agent_research','webhook','internal_chat'
  )),
  source_id text,
  evidence text,
  confidence text DEFAULT 'medium' CHECK (confidence IN ('high','medium','low')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending','pushed','edited_pushed','skipped','superseded'
  )),
  superseded_by uuid REFERENCES data_update_suggestions(id),
  combined_sources text[],
  combination_note text,
  final_value text,
  reviewer_id text,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT exactly_one_entity CHECK (
    (contact_id IS NOT NULL AND territory_ms_slug IS NULL) OR
    (contact_id IS NULL AND territory_ms_slug IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_dus_contact_pending
  ON data_update_suggestions(contact_id, status)
  WHERE status = 'pending' AND contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dus_territory_pending
  ON data_update_suggestions(territory_ms_slug, status)
  WHERE status = 'pending' AND territory_ms_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dus_source ON data_update_suggestions(source_id);
CREATE INDEX IF NOT EXISTS idx_dus_created ON data_update_suggestions(created_at);

-- Step 2b: integration_logs
CREATE TABLE IF NOT EXISTS integration_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_name text NOT NULL,
  event_type text NOT NULL,
  status text NOT NULL CHECK (status IN ('success','failed','retry')),
  payload_summary text,
  error_message text,
  related_contact_id text REFERENCES contacts(ghl_contact_id),
  related_ms_slug text REFERENCES territories(ms_slug),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_logs_name
  ON integration_logs(integration_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_logs_status
  ON integration_logs(status, created_at DESC);

-- RLS
ALTER TABLE data_update_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dus_read" ON data_update_suggestions FOR SELECT TO authenticated USING (true);
CREATE POLICY "dus_write" ON data_update_suggestions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "dus_update" ON data_update_suggestions FOR UPDATE TO authenticated USING (true);

CREATE POLICY "il_read" ON integration_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "il_write" ON integration_logs FOR INSERT TO authenticated WITH CHECK (true);
