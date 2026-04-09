-- Sprint LLM-5: KB health columns + scout performance reports + rubric review suggestions

-- Add health tracking columns to knowledge_documents
ALTER TABLE knowledge_documents
  ADD COLUMN IF NOT EXISTS last_retrieved_at timestamptz,
  ADD COLUMN IF NOT EXISTS retrieval_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retrieval_quality_score float,
  ADD COLUMN IF NOT EXISTS flagged_as_stale boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gap_signal text,
  ADD COLUMN IF NOT EXISTS seeded_from text;

-- Weekly Scout performance reports
CREATE TABLE IF NOT EXISTS scout_performance_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL,
  week_end date NOT NULL,
  total_suggestions int NOT NULL DEFAULT 0,
  acceptance_rate float,
  edit_rate float,
  rejection_rate float,
  top_rejected_types jsonb DEFAULT '[]'::jsonb,
  most_edited_fields jsonb DEFAULT '[]'::jsonb,
  kb_retrieval_count int NOT NULL DEFAULT 0,
  kb_gap_signals jsonb DEFAULT '[]'::jsonb,
  rep_breakdown jsonb DEFAULT '{}'::jsonb,
  action_type_breakdown jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_report_week UNIQUE (week_start, week_end)
);

CREATE INDEX idx_spr_week ON scout_performance_reports(week_start);

-- Rubric review suggestions (monthly, admin-only)
CREATE TABLE IF NOT EXISTS rubric_review_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_month date NOT NULL,
  criterion_id uuid REFERENCES rubric_criteria(id) ON DELETE SET NULL,
  criterion_name text NOT NULL,
  issue_type text NOT NULL CHECK (issue_type IN ('low_confidence', 'high_edit_rate', 'low_relevance', 'missing_coverage')),
  current_state jsonb,
  suggested_change text,
  supporting_data jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'deferred')),
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rrs_month ON rubric_review_suggestions(review_month);
CREATE INDEX idx_rrs_status ON rubric_review_suggestions(status);

-- KB gap tracking
CREATE TABLE IF NOT EXISTS kb_gap_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query text NOT NULL,
  searched_at timestamptz NOT NULL DEFAULT now(),
  results_found int NOT NULL DEFAULT 0,
  suggested_category text,
  resolved boolean NOT NULL DEFAULT false,
  resolved_by_doc_id uuid REFERENCES knowledge_documents(id) ON DELETE SET NULL
);

CREATE INDEX idx_kgs_resolved ON kb_gap_signals(resolved);

-- RLS
ALTER TABLE scout_performance_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE rubric_review_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_gap_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "spr_read_authenticated" ON scout_performance_reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "spr_write_authenticated" ON scout_performance_reports FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "rrs_read_authenticated" ON rubric_review_suggestions FOR SELECT TO authenticated USING (true);
CREATE POLICY "rrs_write_authenticated" ON rubric_review_suggestions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "rrs_update_authenticated" ON rubric_review_suggestions FOR UPDATE TO authenticated USING (true);

CREATE POLICY "kgs_read_authenticated" ON kb_gap_signals FOR SELECT TO authenticated USING (true);
CREATE POLICY "kgs_write_authenticated" ON kb_gap_signals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "kgs_update_authenticated" ON kb_gap_signals FOR UPDATE TO authenticated USING (true);
