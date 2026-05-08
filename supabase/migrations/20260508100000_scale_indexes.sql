-- P1.1: Add missing indexes for scale
-- Targets: query patterns identified in calls list, pending steps,
-- pipeline user filtering, and contact scoring.

-- ═══════════════════════════════════════════════════════════════
-- calls — list page sorts by created_at, filters by type/host/deleted
-- ═══════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_calls_created_at
  ON calls (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_calls_call_type
  ON calls (call_type_id);

CREATE INDEX IF NOT EXISTS idx_calls_hosted_by
  ON calls (hosted_by_user_id);

-- Composite covering the default list query: non-deleted, newest first
CREATE INDEX IF NOT EXISTS idx_calls_list_default
  ON calls (created_at DESC)
  WHERE deleted_at IS NULL;

-- ═══════════════════════════════════════════════════════════════
-- workflow_step_logs — pending confirmations query (NULL/NULL check)
-- ═══════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_wf_step_logs_pending
  ON workflow_step_logs (created_at ASC)
  WHERE confirmed_at IS NULL AND executed_at IS NULL;

-- ═══════════════════════════════════════════════════════════════
-- journey_pipeline_state — user assignment filter (Daily HQ, Scout)
-- ═══════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_jps_assigned_user
  ON journey_pipeline_state (assigned_user_id)
  WHERE is_active = true;

-- ═══════════════════════════════════════════════════════════════
-- contacts — lead scoring sort + time-based filtering
-- ═══════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_contacts_lead_score
  ON contacts (scout_lead_score DESC NULLS LAST)
  WHERE scout_lead_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_created_at
  ON contacts (created_at DESC);
