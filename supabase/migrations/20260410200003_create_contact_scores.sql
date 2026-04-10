-- ══════════════════════════════════════════════
-- Contact Scores — re-engagement signals + lead scores
-- ══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS contact_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ghl_contact_id text NOT NULL REFERENCES contacts(ghl_contact_id) ON DELETE CASCADE,
  score_type text NOT NULL CHECK (score_type IN ('reengagement', 'lead_score', 'fit_score')),
  score_value text NOT NULL,
  reason text,
  confidence text CHECK (confidence IN ('low', 'medium', 'high')),
  source text NOT NULL DEFAULT 'agent',
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cs_contact ON contact_scores(ghl_contact_id);
CREATE INDEX idx_cs_type ON contact_scores(score_type);
CREATE UNIQUE INDEX idx_cs_unique_type ON contact_scores(ghl_contact_id, score_type);

ALTER TABLE contact_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY read_contact_scores ON contact_scores FOR SELECT TO authenticated USING (true);
