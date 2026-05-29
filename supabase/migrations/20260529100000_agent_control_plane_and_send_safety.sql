-- Phase 4 hardening: approval/send safety contract + agent control-plane foundation.
-- This migration does not enable autonomous sends. It records the gates required
-- before any customer-facing send can execute.

ALTER TABLE scout_action_logs
  ADD COLUMN IF NOT EXISTS risk_tier text CHECK (risk_tier IN ('low', 'medium', 'high', 'critical')),
  ADD COLUMN IF NOT EXISTS approval_source text,
  ADD COLUMN IF NOT EXISTS approved_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS safety_checks jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS output_schema_version text NOT NULL DEFAULT 'send-safety.v1';

ALTER TABLE ghl_action_drafts
  ADD COLUMN IF NOT EXISTS risk_tier text CHECK (risk_tier IN ('low', 'medium', 'high', 'critical')),
  ADD COLUMN IF NOT EXISTS approval_source text,
  ADD COLUMN IF NOT EXISTS approved_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS safety_checks jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS output_schema_version text NOT NULL DEFAULT 'send-safety.v1';

CREATE OR REPLACE FUNCTION block_immutable_row_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only and cannot be updated or deleted', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION protect_scout_action_log_audit_fields()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'scout_action_logs is append-only and cannot be deleted';
  END IF;

  -- Contact merge tooling may reassign history from a duplicate GHL contact
  -- to the keeper. All audit fields remain immutable.
  IF (to_jsonb(NEW) - 'ghl_contact_id') = (to_jsonb(OLD) - 'ghl_contact_id') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'scout_action_logs audit fields are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS scout_action_logs_append_only ON scout_action_logs;
CREATE TRIGGER scout_action_logs_append_only
  BEFORE UPDATE OR DELETE ON scout_action_logs
  FOR EACH ROW EXECUTE FUNCTION protect_scout_action_log_audit_fields();

CREATE TABLE IF NOT EXISTS agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_key text NOT NULL,
  agent_name text,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'awaiting_approval', 'completed', 'failed', 'cancelled')),
  requested_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  output jsonb,
  output_schema_version text NOT NULL DEFAULT 'agent-run.v1',
  retry_policy jsonb NOT NULL DEFAULT '{"max_attempts": 0, "backoff": "none"}'::jsonb,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_agent_key ON agent_runs(agent_key);
CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON agent_runs(status);
CREATE INDEX IF NOT EXISTS idx_agent_runs_requested_by ON agent_runs(requested_by_user_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_created_at ON agent_runs(created_at);

DROP TRIGGER IF EXISTS agent_runs_updated_at ON agent_runs;
CREATE TRIGGER agent_runs_updated_at
  BEFORE UPDATE ON agent_runs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS agent_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  target_type text,
  target_id text,
  status text NOT NULL DEFAULT 'drafted'
    CHECK (status IN ('drafted', 'awaiting_approval', 'approved', 'rejected', 'executing', 'executed', 'failed', 'cancelled')),
  risk_tier text NOT NULL DEFAULT 'low'
    CHECK (risk_tier IN ('low', 'medium', 'high', 'critical')),
  requires_human_approval boolean NOT NULL DEFAULT true,
  proposed_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  final_payload jsonb,
  provider_gate jsonb NOT NULL DEFAULT '{}'::jsonb,
  suppression_checks jsonb NOT NULL DEFAULT '{}'::jsonb,
  quiet_hours_check jsonb NOT NULL DEFAULT '{}'::jsonb,
  send_cap_check jsonb NOT NULL DEFAULT '{}'::jsonb,
  template_check jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_schema_version text NOT NULL DEFAULT 'agent-action.v1',
  retry_policy jsonb NOT NULL DEFAULT '{"max_attempts": 0, "backoff": "none"}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  executed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_agent_actions_run_id ON agent_actions(run_id);
CREATE INDEX IF NOT EXISTS idx_agent_actions_status ON agent_actions(status);
CREATE INDEX IF NOT EXISTS idx_agent_actions_risk_tier ON agent_actions(risk_tier);
CREATE INDEX IF NOT EXISTS idx_agent_actions_target ON agent_actions(target_type, target_id);

CREATE TABLE IF NOT EXISTS agent_run_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  action_id uuid REFERENCES agent_actions(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_schema_version text NOT NULL DEFAULT 'agent-run-event.v1',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_run_events_run_id ON agent_run_events(run_id);
CREATE INDEX IF NOT EXISTS idx_agent_run_events_action_id ON agent_run_events(action_id);
CREATE INDEX IF NOT EXISTS idx_agent_run_events_created_at ON agent_run_events(created_at);

DROP TRIGGER IF EXISTS agent_run_events_append_only ON agent_run_events;
CREATE TRIGGER agent_run_events_append_only
  BEFORE UPDATE OR DELETE ON agent_run_events
  FOR EACH ROW EXECUTE FUNCTION block_immutable_row_mutation();

CREATE TABLE IF NOT EXISTS agent_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES agent_runs(id) ON DELETE CASCADE,
  action_id uuid NOT NULL REFERENCES agent_actions(id) ON DELETE CASCADE,
  requested_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  decided_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  decision text NOT NULL CHECK (decision IN ('approved', 'rejected')),
  decision_reason text,
  final_payload jsonb,
  approval_source text NOT NULL DEFAULT 'human_control_plane',
  output_schema_version text NOT NULL DEFAULT 'agent-approval.v1',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_approvals_run_id ON agent_approvals(run_id);
CREATE INDEX IF NOT EXISTS idx_agent_approvals_action_id ON agent_approvals(action_id);
CREATE INDEX IF NOT EXISTS idx_agent_approvals_decided_by ON agent_approvals(decided_by_user_id);

DROP TRIGGER IF EXISTS agent_approvals_append_only ON agent_approvals;
CREATE TRIGGER agent_approvals_append_only
  BEFORE UPDATE OR DELETE ON agent_approvals
  FOR EACH ROW EXECUTE FUNCTION block_immutable_row_mutation();

ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_run_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_runs_read_authenticated"
  ON agent_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "agent_runs_insert_authenticated"
  ON agent_runs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "agent_runs_update_authenticated"
  ON agent_runs FOR UPDATE TO authenticated USING (true);

CREATE POLICY "agent_actions_read_authenticated"
  ON agent_actions FOR SELECT TO authenticated USING (true);
CREATE POLICY "agent_actions_insert_authenticated"
  ON agent_actions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "agent_actions_update_authenticated"
  ON agent_actions FOR UPDATE TO authenticated USING (true);

CREATE POLICY "agent_run_events_read_authenticated"
  ON agent_run_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "agent_run_events_insert_authenticated"
  ON agent_run_events FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "agent_approvals_read_authenticated"
  ON agent_approvals FOR SELECT TO authenticated USING (true);
CREATE POLICY "agent_approvals_insert_authenticated"
  ON agent_approvals FOR INSERT TO authenticated WITH CHECK (true);
