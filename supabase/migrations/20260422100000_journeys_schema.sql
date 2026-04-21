-- ═══════════════════════════════════════════════════════════════════
-- Sprint: journeys-v1 (Phase 1 of contacts restructure).
--
-- Introduces "journeys" — a new entity above contacts that carries
-- pipeline state. A journey represents one partnership/ownership
-- configuration (Phil solo, Ryan+Shannon joint, etc.) and can attach
-- N contacts with explicit roles and N territories each with their
-- own pipeline stage.
--
-- Contacts stay 1:1 with GHL. contact_pipeline_state stays for now —
-- it will be read in parallel and deprecated in a later sprint.
-- ═══════════════════════════════════════════════════════════════════

-- Extend pipeline_close_reason enum to support partnership splits.
-- (Used later when the split-journey UI ships.)
ALTER TYPE pipeline_close_reason ADD VALUE IF NOT EXISTS 'split';

-- ── 1. journeys ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS journeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','archived','closed')),
  close_reason pipeline_close_reason,
  primary_contact_id uuid NOT NULL
    REFERENCES contacts(id) ON DELETE RESTRICT,
  parent_journey_id uuid REFERENCES journeys(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_journeys_primary_contact
  ON journeys(primary_contact_id);
CREATE INDEX IF NOT EXISTS idx_journeys_status
  ON journeys(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_journeys_parent
  ON journeys(parent_journey_id) WHERE parent_journey_id IS NOT NULL;

CREATE TRIGGER journeys_updated_at
  BEFORE UPDATE ON journeys
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime(updated_at);

-- ── 2. journey_contacts ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS journey_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  role text NOT NULL CHECK (role IN (
    'primary','co_primary','spouse','family','attorney',
    'accountant','financial_advisor','business_partner','other'
  )),
  is_primary_decision_maker boolean NOT NULL DEFAULT false,
  role_notes text,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- At most one active membership per (journey, contact).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_journey_contact
  ON journey_contacts(journey_id, contact_id)
  WHERE left_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_journey_contacts_contact
  ON journey_contacts(contact_id) WHERE left_at IS NULL;

CREATE TRIGGER journey_contacts_updated_at
  BEFORE UPDATE ON journey_contacts
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime(updated_at);

-- ── 3. journey_pipeline_state ────────────────────────────────────
-- Pipeline state is scoped by (journey, territory, pipeline). A single
-- journey can have multiple rows when the partnership works several
-- territories simultaneously, each in its own stage. territory_ms_slug
-- is NULL pre-award when no territory has been assigned yet.
CREATE TABLE IF NOT EXISTS journey_pipeline_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  territory_ms_slug text REFERENCES territories(ms_slug) ON DELETE SET NULL,
  pipeline_id uuid NOT NULL REFERENCES pipelines(id) ON DELETE RESTRICT,
  current_stage_id uuid NOT NULL REFERENCES pipeline_stages(id),
  current_sub_task_id uuid REFERENCES pipeline_sub_tasks(id),
  current_sub_task_started_at timestamptz,
  entered_pipeline_at timestamptz NOT NULL DEFAULT now(),
  entered_current_stage_at timestamptz NOT NULL DEFAULT now(),
  assigned_user_id uuid REFERENCES users(id),
  is_active boolean NOT NULL DEFAULT true,
  closed_reason pipeline_close_reason,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Uniqueness: one active row per (journey, territory, pipeline) when
-- territory is set, and one active pre-award row per (journey, pipeline)
-- when no territory yet.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_journey_territory_pipeline
  ON journey_pipeline_state(journey_id, territory_ms_slug, pipeline_id)
  WHERE is_active = true AND territory_ms_slug IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_journey_pipeline_no_territory
  ON journey_pipeline_state(journey_id, pipeline_id)
  WHERE is_active = true AND territory_ms_slug IS NULL;

CREATE INDEX IF NOT EXISTS idx_journey_pipeline_state_stage
  ON journey_pipeline_state(current_stage_id) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_journey_pipeline_state_journey
  ON journey_pipeline_state(journey_id) WHERE is_active = true;

CREATE TRIGGER journey_pipeline_state_updated_at
  BEFORE UPDATE ON journey_pipeline_state
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime(updated_at);

-- ── 4. journey_id on calls-adjacent data ─────────────────────────
ALTER TABLE call_data_extractions
  ADD COLUMN IF NOT EXISTS journey_id uuid
  REFERENCES journeys(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_extractions_journey
  ON call_data_extractions(journey_id)
  WHERE journey_id IS NOT NULL;

ALTER TABLE call_action_items
  ADD COLUMN IF NOT EXISTS journey_id uuid
  REFERENCES journeys(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_actions_journey
  ON call_action_items(journey_id)
  WHERE journey_id IS NOT NULL;
