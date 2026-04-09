-- Sprint LLM-3 Task 4: GHL Action Drafts table
-- Draft → Review → Confirm queue for all 30 GHL actions.

CREATE TABLE IF NOT EXISTS ghl_action_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type text NOT NULL,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  drafted_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  drafted_by_source text NOT NULL DEFAULT 'scout'
    CHECK (drafted_by_source IN ('scout', 'user')),
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  edited_params jsonb,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'confirmed', 'rejected', 'executed', 'failed')),
  outcome jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  executed_at timestamptz
);

CREATE INDEX idx_gad_action_type ON ghl_action_drafts(action_type);
CREATE INDEX idx_gad_contact_id ON ghl_action_drafts(contact_id);
CREATE INDEX idx_gad_user_id ON ghl_action_drafts(drafted_by_user_id);
CREATE INDEX idx_gad_status ON ghl_action_drafts(status);
CREATE INDEX idx_gad_created_at ON ghl_action_drafts(created_at);

ALTER TABLE ghl_action_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gad_read_authenticated"
  ON ghl_action_drafts FOR SELECT TO authenticated USING (true);
CREATE POLICY "gad_write_authenticated"
  ON ghl_action_drafts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "gad_update_authenticated"
  ON ghl_action_drafts FOR UPDATE TO authenticated USING (true);
