-- Sprint 1: Pipeline app settings — single-row config (§1.20 Group 5)
--
-- NOTE: Named pipeline_app_settings (not app_settings) to avoid collision
-- with the existing app_settings table which uses a different structure
-- (uuid PK + key-value pairs). This table stores pipeline-specific config
-- as a single row with id=1. Decision logged in memory.md.

CREATE TABLE IF NOT EXISTS pipeline_app_settings (
  id int PRIMARY KEY DEFAULT 1,
  time_in_stage_yellow_days int NOT NULL DEFAULT 5,   -- §1.14: 5 days = "At Risk"
  time_in_stage_red_days int NOT NULL DEFAULT 10,     -- §1.14: 10 days = "Losing"
  ghl_sync_enabled boolean NOT NULL DEFAULT true,
  ghl_sync_queue_alert_threshold int NOT NULL DEFAULT 50,
  updated_by_user_id uuid REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure only one row can exist
CREATE UNIQUE INDEX uniq_pipeline_app_settings_singleton ON pipeline_app_settings ((true));

CREATE TRIGGER pipeline_app_settings_updated_at
  BEFORE UPDATE ON pipeline_app_settings
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime(updated_at);
