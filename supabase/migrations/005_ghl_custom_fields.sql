-- 005_ghl_custom_fields.sql
-- Caches GHL custom field IDs for contacts and opportunities

CREATE TABLE ghl_custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_key VARCHAR(255) NOT NULL,
  field_name VARCHAR(255) NOT NULL,
  field_type VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('contact', 'opportunity')),
  ghl_field_id VARCHAR(255) NOT NULL,
  dropdown_options JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(entity_type, field_key)
);
CREATE INDEX idx_ghl_fields_entity ON ghl_custom_fields(entity_type);
CREATE INDEX idx_ghl_fields_key ON ghl_custom_fields(field_key);
