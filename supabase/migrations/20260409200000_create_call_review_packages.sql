-- Sprint LLM-2 Task 1: Call Review Packages
-- Stores the full Scout review output for each call (grade, coaching, profile suggestions, next steps).

CREATE TABLE IF NOT EXISTS call_review_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  rep_id uuid REFERENCES users(id) ON DELETE SET NULL,
  grade text CHECK (grade IN ('A','B','C','D','F')),
  grade_detail jsonb,
  coaching_feedback text,
  coaching_citations jsonb DEFAULT '[]'::jsonb,
  profile_suggestions jsonb DEFAULT '[]'::jsonb,
  next_step_cards jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'partially_reviewed', 'complete')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_crp_call_id ON call_review_packages(call_id);
CREATE INDEX idx_crp_contact_id ON call_review_packages(contact_id);
CREATE INDEX idx_crp_rep_id ON call_review_packages(rep_id);
CREATE INDEX idx_crp_status ON call_review_packages(status);
CREATE INDEX idx_crp_created_at ON call_review_packages(created_at);

-- Sprint LLM-2 Task 4: Suggestion Feedback Logger
-- Logs every card outcome (accepted / edited / skipped) for learning.

CREATE TABLE IF NOT EXISTS suggestion_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_type text NOT NULL
    CHECK (suggestion_type IN ('profile_update', 'next_step', 'coaching_edit', 'rubric_edit')),
  call_id uuid REFERENCES calls(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  rep_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_value jsonb,
  accepted_value jsonb,
  outcome text NOT NULL CHECK (outcome IN ('accepted', 'edited', 'skipped')),
  edit_delta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sf_suggestion_type ON suggestion_feedback(suggestion_type);
CREATE INDEX idx_sf_call_id ON suggestion_feedback(call_id);
CREATE INDEX idx_sf_contact_id ON suggestion_feedback(contact_id);
CREATE INDEX idx_sf_rep_id ON suggestion_feedback(rep_id);
CREATE INDEX idx_sf_outcome ON suggestion_feedback(outcome);
CREATE INDEX idx_sf_created_at ON suggestion_feedback(created_at);

-- RLS
ALTER TABLE call_review_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestion_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crp_read_authenticated"
  ON call_review_packages FOR SELECT TO authenticated USING (true);
CREATE POLICY "crp_write_authenticated"
  ON call_review_packages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "crp_update_authenticated"
  ON call_review_packages FOR UPDATE TO authenticated USING (true);

CREATE POLICY "sf_read_authenticated"
  ON suggestion_feedback FOR SELECT TO authenticated USING (true);
CREATE POLICY "sf_write_authenticated"
  ON suggestion_feedback FOR INSERT TO authenticated WITH CHECK (true);
