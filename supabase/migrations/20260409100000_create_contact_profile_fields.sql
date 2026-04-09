-- Sprint LLM-1 Task 1: Contact Profile Fields (EAV pattern)
-- Stores all 199 profile fields per contact with per-field source metadata.
-- One row per (contact_id, field_name) pair.

CREATE TABLE IF NOT EXISTS contact_profile_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  field_value jsonb,
  last_updated_by text NOT NULL DEFAULT 'manual'
    CHECK (last_updated_by IN ('api', 'ai', 'manual', 'system')),
  last_updated_at timestamptz NOT NULL DEFAULT now(),
  source_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_contact_field UNIQUE (contact_id, field_name)
);

-- Indexes
CREATE INDEX idx_cpf_contact_id ON contact_profile_fields(contact_id);
CREATE INDEX idx_cpf_field_name ON contact_profile_fields(field_name);
CREATE INDEX idx_cpf_updated_by ON contact_profile_fields(last_updated_by);
CREATE INDEX idx_cpf_updated_at ON contact_profile_fields(last_updated_at);

-- Composite index for common query pattern: all fields for a contact
CREATE INDEX idx_cpf_contact_field ON contact_profile_fields(contact_id, field_name);

-- RLS
ALTER TABLE contact_profile_fields ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all profile fields (role filtering at app level)
CREATE POLICY "cpf_read_authenticated"
  ON contact_profile_fields FOR SELECT TO authenticated USING (true);

-- Service role handles all writes (bypasses RLS automatically)
-- Authenticated users can insert/update via app layer validation
CREATE POLICY "cpf_write_authenticated"
  ON contact_profile_fields FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cpf_update_authenticated"
  ON contact_profile_fields FOR UPDATE TO authenticated USING (true);

-- Trigger: auto-append to source_history on update (keep last 3)
CREATE OR REPLACE FUNCTION update_profile_field_source_history()
RETURNS TRIGGER AS $$
BEGIN
  -- Append the old value to source_history, keep last 3
  NEW.source_history = (
    SELECT jsonb_agg(entry)
    FROM (
      SELECT entry FROM (
        SELECT jsonb_build_object(
          'value', OLD.field_value,
          'updated_by', OLD.last_updated_by,
          'updated_at', OLD.last_updated_at
        ) AS entry
        UNION ALL
        SELECT jsonb_array_elements(OLD.source_history) AS entry
      ) sub
      LIMIT 3
    ) limited
  );
  IF NEW.source_history IS NULL THEN
    NEW.source_history = '[]'::jsonb;
  END IF;
  NEW.last_updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cpf_source_history
  BEFORE UPDATE ON contact_profile_fields
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_field_source_history();
