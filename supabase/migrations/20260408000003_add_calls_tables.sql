-- Sprint 9: Calls, transcripts, grades, and coaching tables.

CREATE TABLE IF NOT EXISTS calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ghl_event_id text,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  call_type_id uuid REFERENCES call_types(id),
  sub_task_id uuid REFERENCES pipeline_sub_tasks(id),
  contact_pipeline_state_id uuid REFERENCES contact_pipeline_state(id),
  scheduled_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds int,
  meeting_link text,
  recording_url text,
  hosted_by_user_id uuid REFERENCES users(id),
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','missed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_calls_ghl_event ON calls(ghl_event_id) WHERE ghl_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calls_contact ON calls(contact_id);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
CREATE INDEX IF NOT EXISTS idx_calls_scheduled ON calls(scheduled_at);

CREATE TABLE IF NOT EXISTS call_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('whisper','manual_paste','upload')),
  full_text text NOT NULL,
  word_count int,
  language text DEFAULT 'en',
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_transcripts_call ON call_transcripts(call_id);

CREATE TABLE IF NOT EXISTS call_grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  rubric_id uuid REFERENCES rubrics(id),
  overall_grade text CHECK (overall_grade IN ('A','B','C','D','F')),
  overall_score numeric,
  criterion_scores jsonb,
  strengths text[],
  improvements text[],
  suggested_next_action text,
  graded_by text NOT NULL DEFAULT 'scout',
  scout_model text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_grades_call ON call_grades(call_id);

CREATE TABLE IF NOT EXISTS call_coaching (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  kb_snippets_used uuid[],
  coaching_notes text,
  coaching_plan text,
  created_by text NOT NULL DEFAULT 'scout',
  scout_model text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_coaching_call ON call_coaching(call_id);
