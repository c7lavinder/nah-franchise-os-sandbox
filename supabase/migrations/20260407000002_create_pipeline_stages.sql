-- Sprint 1: Pipeline stages table (§1.20 Group 1)
-- Stages within a pipeline: Engagement, Qualification, etc.

CREATE TABLE IF NOT EXISTS pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES pipelines(id) ON DELETE RESTRICT,
  slug text NOT NULL,
  name text NOT NULL,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  is_terminal boolean NOT NULL DEFAULT false,
  auto_advance_enabled boolean NOT NULL DEFAULT false,  -- §1.7: OFF by default at MVP
  auto_spawn_pipeline_id uuid REFERENCES pipelines(id),  -- §1.13: e.g. Sales→Onboarding
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER pipeline_stages_updated_at
  BEFORE UPDATE ON pipeline_stages
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime(updated_at);
