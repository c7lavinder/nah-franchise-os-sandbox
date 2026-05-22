-- Phase 2: Pre-Computed Briefs — contact_briefs + territory_briefs
-- Stores pre-generated summaries so Scout responds instantly without
-- re-querying all data sources on every request.

CREATE TABLE IF NOT EXISTS contact_briefs (
  contact_id uuid PRIMARY KEY REFERENCES contacts(id) ON DELETE CASCADE,
  brief jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  stale boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS territory_briefs (
  territory_slug text PRIMARY KEY REFERENCES territories("TerritorySlug") ON DELETE CASCADE,
  brief jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  stale boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for cron: find all stale briefs quickly
CREATE INDEX idx_contact_briefs_stale ON contact_briefs(stale) WHERE stale = true;
CREATE INDEX idx_territory_briefs_stale ON territory_briefs(stale) WHERE stale = true;

-- RLS
ALTER TABLE contact_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE territory_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cb_read_authenticated" ON contact_briefs FOR SELECT TO authenticated USING (true);
CREATE POLICY "cb_write_service" ON contact_briefs FOR ALL TO service_role USING (true);

CREATE POLICY "tb_read_authenticated" ON territory_briefs FOR SELECT TO authenticated USING (true);
CREATE POLICY "tb_write_service" ON territory_briefs FOR ALL TO service_role USING (true);
