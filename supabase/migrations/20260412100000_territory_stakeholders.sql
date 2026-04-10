-- Territory ecosystem stakeholders — agents, contractors, family, lawyers, partners, etc.

CREATE TABLE IF NOT EXISTS territory_stakeholders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ms_slug text NOT NULL REFERENCES territories(ms_slug) ON DELETE CASCADE,
  first_name text,
  last_name text,
  email text,
  phone text,
  company text,
  role text NOT NULL DEFAULT 'other',
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_territory_stakeholders_slug ON territory_stakeholders(ms_slug);
