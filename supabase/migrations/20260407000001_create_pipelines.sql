-- Sprint 1: Pipeline definition table (§1.20 Group 1)
-- Top-level pipeline definition: Sales, Onboarding, Coaching, Follow-up

CREATE TABLE IF NOT EXISTS pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  ghl_field_id text,  -- The GHL custom field ID this pipeline writes to (§1.16)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE TRIGGER pipelines_updated_at
  BEFORE UPDATE ON pipelines
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime(updated_at);
