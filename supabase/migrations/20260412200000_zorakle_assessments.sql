-- Zorakle Eclipse assessment results

CREATE TABLE IF NOT EXISTS zorakle_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  ms_slug text,
  full_name text NOT NULL,
  batch text,
  eclipse_overall int,
  values_score int,
  stages_score int,
  cultural_score int,
  sales_score int,
  biz_path_score int,
  values_type text,
  culture text,
  work_style text,
  eclipse_drive_id text,
  spoton_drive_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_zorakle_contact ON zorakle_assessments(contact_id);
CREATE INDEX idx_zorakle_slug ON zorakle_assessments(ms_slug);
