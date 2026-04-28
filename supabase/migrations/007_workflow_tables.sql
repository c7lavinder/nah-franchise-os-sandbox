-- Workflow Intelligence Engine — Database Migration
-- 7 tables: workflows, workflow_versions, workflow_steps,
-- workflow_enrollments, workflow_step_logs, workflow_ab_tests, workflow_approvals
--
-- Run via: npx tsx scripts/setup-workflow-tables.ts
-- Safe to run multiple times — uses IF NOT EXISTS.

-- ═══════════════════════════════════════════════════════
-- 1. WORKFLOWS — top-level workflow definitions
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  workflow_type VARCHAR(100) NOT NULL,
  trigger_type VARCHAR(100) NOT NULL,
  trigger_config JSONB DEFAULT '{}'::jsonb,
  exit_conditions JSONB DEFAULT '{}'::jsonb,
  pause_conditions JSONB DEFAULT '{}'::jsonb,
  health_score CHAR(1) DEFAULT 'C' CHECK (health_score IN ('A','B','C','D','F')),
  status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_approval','live','paused','archived')),
  current_version_id UUID,
  active_enrollee_count INTEGER DEFAULT 0,
  primary_metric_name VARCHAR(100),
  primary_metric_value DECIMAL(5,2),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
CREATE INDEX IF NOT EXISTS idx_workflows_type ON workflows(workflow_type);
CREATE INDEX IF NOT EXISTS idx_workflows_health ON workflows(health_score);

-- ═══════════════════════════════════════════════════════
-- 2. WORKFLOW VERSIONS — immutable version history
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS workflow_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  change_description TEXT,
  update_mode VARCHAR(50) CHECK (update_mode IN ('new_enrollees_only','full_overwrite')),
  created_by UUID NOT NULL REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workflow_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_wf_versions_workflow ON workflow_versions(workflow_id);

-- Now add the FK from workflows.current_version_id → workflow_versions.id
-- (deferred because workflow_versions didn't exist when workflows was created)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_workflows_current_version'
  ) THEN
    ALTER TABLE workflows
      ADD CONSTRAINT fk_workflows_current_version
      FOREIGN KEY (current_version_id) REFERENCES workflow_versions(id);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════
-- 3. WORKFLOW STEPS — individual steps within a version
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS workflow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_version_id UUID NOT NULL REFERENCES workflow_versions(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  day_number INTEGER NOT NULL,
  step_type VARCHAR(50) NOT NULL CHECK (step_type IN ('sms','email','chad_call_task','team_notify','ai_agent_action','condition_check','stage_move_suggestion','trainual_check')),
  content TEXT,
  subject VARCHAR(500),
  send_time TIME,
  condition_config JSONB,
  requires_confirmation BOOLEAN DEFAULT true,
  performance_status VARCHAR(20) DEFAULT 'neutral' CHECK (performance_status IN ('green','yellow','red','neutral')),
  open_rate DECIMAL(5,2),
  click_rate DECIMAL(5,2),
  response_rate DECIMAL(5,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workflow_version_id, step_number)
);

CREATE INDEX IF NOT EXISTS idx_wf_steps_version ON workflow_steps(workflow_version_id);
CREATE INDEX IF NOT EXISTS idx_wf_steps_day ON workflow_steps(day_number);

-- ═══════════════════════════════════════════════════════
-- 4. WORKFLOW ENROLLMENTS — contacts enrolled in workflows
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS workflow_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id),
  workflow_version_id UUID NOT NULL REFERENCES workflow_versions(id),
  ghl_contact_id VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  current_day INTEGER DEFAULT 1,
  current_step_id UUID REFERENCES workflow_steps(id),
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','completed','exited','expired')),
  exit_reason VARCHAR(255),
  goal_achieved BOOLEAN DEFAULT false,
  enrolled_at TIMESTAMPTZ DEFAULT now(),
  last_step_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_wf_enrollments_workflow ON workflow_enrollments(workflow_id);
CREATE INDEX IF NOT EXISTS idx_wf_enrollments_contact ON workflow_enrollments(ghl_contact_id);
CREATE INDEX IF NOT EXISTS idx_wf_enrollments_status ON workflow_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_wf_enrollments_active ON workflow_enrollments(workflow_id, status) WHERE status = 'active';

-- ═══════════════════════════════════════════════════════
-- 5. WORKFLOW STEP LOGS — execution log for every step
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS workflow_step_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES workflow_enrollments(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES workflow_steps(id),
  ghl_contact_id VARCHAR(255) NOT NULL,
  step_type VARCHAR(50) NOT NULL,
  content_sent TEXT,
  ghl_message_id VARCHAR(255),
  delivered BOOLEAN DEFAULT false,
  opened BOOLEAN DEFAULT false,
  clicked BOOLEAN DEFAULT false,
  responded BOOLEAN DEFAULT false,
  confirmed_by UUID REFERENCES users(id),
  confirmed_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  delivery_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wf_step_logs_enrollment ON workflow_step_logs(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_wf_step_logs_step ON workflow_step_logs(step_id);
CREATE INDEX IF NOT EXISTS idx_wf_step_logs_contact ON workflow_step_logs(ghl_contact_id);
CREATE INDEX IF NOT EXISTS idx_wf_step_logs_executed ON workflow_step_logs(executed_at);

-- ═══════════════════════════════════════════════════════
-- 6. WORKFLOW A/B TESTS — experimentation engine
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS workflow_ab_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id),
  test_type VARCHAR(50) NOT NULL CHECK (test_type IN ('step','full_workflow')),
  variant_a_step_id UUID REFERENCES workflow_steps(id),
  variant_b_step_id UUID REFERENCES workflow_steps(id),
  variant_a_version_id UUID REFERENCES workflow_versions(id),
  variant_b_version_id UUID REFERENCES workflow_versions(id),
  min_sample_size INTEGER DEFAULT 20,
  variant_a_count INTEGER DEFAULT 0,
  variant_b_count INTEGER DEFAULT 0,
  variant_a_metric DECIMAL(5,2),
  variant_b_metric DECIMAL(5,2),
  winner VARCHAR(10) CHECK (winner IN ('A','B')),
  winner_explanation TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_approval','running','complete','archived')),
  created_by UUID NOT NULL REFERENCES users(id),
  declared_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_wf_ab_tests_workflow ON workflow_ab_tests(workflow_id);
CREATE INDEX IF NOT EXISTS idx_wf_ab_tests_status ON workflow_ab_tests(status);

-- ═══════════════════════════════════════════════════════
-- 7. WORKFLOW APPROVALS — approval queue for changes
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS workflow_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id),
  workflow_version_id UUID REFERENCES workflow_versions(id),
  ab_test_id UUID REFERENCES workflow_ab_tests(id),
  approval_type VARCHAR(50) NOT NULL CHECK (approval_type IN ('publish','pause','archive','ab_test_start','ab_test_winner','rollback')),
  submitted_by UUID NOT NULL REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  notes TEXT,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_wf_approvals_workflow ON workflow_approvals(workflow_id);
CREATE INDEX IF NOT EXISTS idx_wf_approvals_status ON workflow_approvals(status);

-- ═══════════════════════════════════════════════════════
-- ROW LEVEL SECURITY — enabled on all 7 tables
-- ═══════════════════════════════════════════════════════

ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_step_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_ab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_approvals ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS automatically.
-- Authenticated users get read access to all workflow data (role filtering done at app level).

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'workflows', 'workflow_versions', 'workflow_steps',
    'workflow_enrollments', 'workflow_step_logs',
    'workflow_ab_tests', 'workflow_approvals'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = tbl AND policyname = 'allow_authenticated_read_' || tbl
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (true)',
        'allow_authenticated_read_' || tbl, tbl
      );
    END IF;
  END LOOP;
END $$;
