-- ══════════════════════════════════════════════
-- Transcript Jobs Queue
-- ══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS transcript_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  audio_url text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts int NOT NULL DEFAULT 0,
  error_message text,
  transcript_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

CREATE INDEX idx_tj_status ON transcript_jobs(status) WHERE status IN ('pending', 'processing');
CREATE INDEX idx_tj_call ON transcript_jobs(call_id);

ALTER TABLE transcript_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY read_transcript_jobs ON transcript_jobs FOR SELECT TO authenticated USING (true);
