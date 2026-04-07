-- Sprint 1: Seed pipeline_app_settings with defaults (§1.14, §1.16)

INSERT INTO pipeline_app_settings (id, time_in_stage_yellow_days, time_in_stage_red_days, ghl_sync_enabled, ghl_sync_queue_alert_threshold)
VALUES (1, 5, 10, true, 50)
ON CONFLICT (id) DO NOTHING;
