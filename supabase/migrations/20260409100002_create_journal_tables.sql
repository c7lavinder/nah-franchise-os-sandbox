-- Sprint LLM-1 Task 4: Journal System — 3 tables
-- Contact journals (per contact per day), Rep journals (per rep per day), System logs (audit)

-- ═══════════════════════════════════════════════════════
-- 1. CONTACT JOURNALS — daily AI-generated summary per contact
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS contact_journals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  tenant_id uuid,
  journal_date date NOT NULL,
  summary text NOT NULL,
  interactions jsonb NOT NULL DEFAULT '[]'::jsonb,
  signals_extracted jsonb NOT NULL DEFAULT '[]'::jsonb,
  embedding_id uuid REFERENCES embeddings(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_contact_journal_date UNIQUE (contact_id, journal_date)
);

CREATE INDEX idx_cj_contact_id ON contact_journals(contact_id);
CREATE INDEX idx_cj_journal_date ON contact_journals(journal_date);
CREATE INDEX idx_cj_contact_date ON contact_journals(contact_id, journal_date);

-- ═══════════════════════════════════════════════════════
-- 2. REP JOURNALS — daily AI-generated summary per rep
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS rep_journals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id uuid,
  journal_date date NOT NULL,
  summary text NOT NULL,
  contacts_touched int NOT NULL DEFAULT 0,
  calls_completed int NOT NULL DEFAULT 0,
  sub_tasks_logged int NOT NULL DEFAULT 0,
  ghl_actions_fired int NOT NULL DEFAULT 0,
  coaching_notes text,
  focus_tomorrow text,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_rep_journal_date UNIQUE (user_id, journal_date)
);

CREATE INDEX idx_rj_user_id ON rep_journals(user_id);
CREATE INDEX idx_rj_journal_date ON rep_journals(journal_date);
CREATE INDEX idx_rj_user_date ON rep_journals(user_id, journal_date);

-- ═══════════════════════════════════════════════════════
-- 3. SYSTEM LOGS — tenant-wide audit of all AI actions
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS system_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  action_type text NOT NULL,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  input_params jsonb,
  result_summary text,
  was_auto boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sl_log_date ON system_logs(log_date);
CREATE INDEX idx_sl_action_type ON system_logs(action_type);
CREATE INDEX idx_sl_contact_id ON system_logs(contact_id);
CREATE INDEX idx_sl_user_id ON system_logs(user_id);
CREATE INDEX idx_sl_was_auto ON system_logs(was_auto);

-- RLS on all 3 tables
ALTER TABLE contact_journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE rep_journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cj_read_authenticated"
  ON contact_journals FOR SELECT TO authenticated USING (true);
CREATE POLICY "cj_write_authenticated"
  ON contact_journals FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "rj_read_authenticated"
  ON rep_journals FOR SELECT TO authenticated USING (true);
CREATE POLICY "rj_write_authenticated"
  ON rep_journals FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "sl_read_authenticated"
  ON system_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "sl_write_authenticated"
  ON system_logs FOR INSERT TO authenticated WITH CHECK (true);
