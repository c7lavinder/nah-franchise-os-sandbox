-- Journey Briefs — AI-generated narrative summaries for franchise journeys.
-- Event-driven: regenerated when calls are graded, stages change, or properties sync.
-- Read by the Journey Brief panel on the journey detail page.

CREATE TABLE IF NOT EXISTS journey_briefs (
  journey_id uuid PRIMARY KEY REFERENCES journeys(id) ON DELETE CASCADE,
  narrative text NOT NULL DEFAULT '',
  next_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  data_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  stale boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_journey_briefs_stale ON journey_briefs(stale) WHERE stale = true;

ALTER TABLE journey_briefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jb_read_authenticated" ON journey_briefs FOR SELECT TO authenticated USING (true);
CREATE POLICY "jb_write_service" ON journey_briefs FOR ALL TO service_role USING (true);
