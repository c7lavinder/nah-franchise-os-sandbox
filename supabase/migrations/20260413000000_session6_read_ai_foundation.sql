-- Session 6: Read.ai integration foundation
-- Tables: coach_assignments, read_ai_sessions
-- Columns: calls (read_ai fields), contacts (needs_review, source), knowledge_documents (status)

-- ═══════════════════════════════════════════════
-- 1. COACH ASSIGNMENTS
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS coach_assignments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_user_id text NOT NULL,
  territory_ms_slug text NOT NULL REFERENCES territories(ms_slug),
  specialty text,
  assigned_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  UNIQUE(coach_user_id, territory_ms_slug)
);

CREATE INDEX IF NOT EXISTS idx_coach_assignments_territory
  ON coach_assignments(territory_ms_slug)
  WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_coach_assignments_coach
  ON coach_assignments(coach_user_id)
  WHERE ended_at IS NULL;

-- ═══════════════════════════════════════════════
-- 2. READ.AI SESSIONS
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS read_ai_sessions (
  session_id text PRIMARY KEY,
  title text,
  start_time timestamptz,
  end_time timestamptz,
  platform text,
  owner_email text,
  participant_emails text[],
  raw_payload jsonb,
  call_type text CHECK (call_type IN (
    'prospect', 'coaching', 'group', 'internal', 'unknown'
  )),
  classified_at timestamptz,
  processed_at timestamptz,
  processing_status text DEFAULT 'pending' CHECK (processing_status IN (
    'pending', 'processing', 'complete', 'failed', 'skipped'
  )),
  linked_call_id uuid,
  error_message text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_read_ai_sessions_status
  ON read_ai_sessions(processing_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_read_ai_sessions_owner
  ON read_ai_sessions(owner_email);

-- ═══════════════════════════════════════════════
-- 3. CALLS TABLE — add Read.ai columns
-- ═══════════════════════════════════════════════
ALTER TABLE calls ADD COLUMN IF NOT EXISTS read_ai_session_id text;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS territory_ms_slug text REFERENCES territories(ms_slug);
ALTER TABLE calls ADD COLUMN IF NOT EXISTS coach_user_id uuid REFERENCES users(id);
ALTER TABLE calls ADD COLUMN IF NOT EXISTS participant_count int;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS summary text;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS action_items jsonb;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS source text DEFAULT 'ghl';
ALTER TABLE calls ADD COLUMN IF NOT EXISTS raw_transcript text;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS title text;

CREATE INDEX IF NOT EXISTS idx_calls_read_ai ON calls(read_ai_session_id) WHERE read_ai_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calls_territory ON calls(territory_ms_slug) WHERE territory_ms_slug IS NOT NULL;

-- ═══════════════════════════════════════════════
-- 4. CONTACTS TABLE — add needs_review + source
-- ═══════════════════════════════════════════════
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS needs_review boolean DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS source text;

-- ═══════════════════════════════════════════════
-- 5. KNOWLEDGE DOCUMENTS — add status column
-- ═══════════════════════════════════════════════
ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS status text DEFAULT 'active'
  CHECK (status IN ('active', 'pending_review', 'archived'));

-- Backfill: all existing docs are active
UPDATE knowledge_documents SET status = 'active' WHERE status IS NULL;

-- ═══════════════════════════════════════════════
-- 6. READ.AI WEBHOOK KEYS (per-user)
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS read_ai_webhook_keys (
  user_email text PRIMARY KEY,
  signing_key text NOT NULL,
  created_at timestamptz DEFAULT now()
);
