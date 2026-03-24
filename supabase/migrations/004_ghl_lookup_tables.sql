-- 004_ghl_lookup_tables.sql
-- Creates GHL lookup tables for workflow webhook URLs and pipeline stage mappings

-- 1. ghl_workflows — maps workflow names to their webhook/trigger URLs
CREATE TABLE ghl_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  ghl_workflow_id VARCHAR(255),
  webhook_url TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_ghl_workflows_name ON ghl_workflows(name);

-- 2. ghl_pipeline_stages — caches pipeline stage name-to-ID mappings
CREATE TABLE ghl_pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id VARCHAR(255) NOT NULL,
  stage_id VARCHAR(255) NOT NULL,
  stage_name VARCHAR(255) NOT NULL,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(pipeline_id, stage_id)
);
CREATE INDEX idx_ghl_stages_name ON ghl_pipeline_stages(stage_name);
CREATE INDEX idx_ghl_stages_pipeline ON ghl_pipeline_stages(pipeline_id);
