-- Foundation for incremental MasterSuite sync ownership.
-- First scoped stream: sync-ms-prospects. The cron route reads and writes this
-- table so Scout/admin health can distinguish run success from source freshness.

CREATE TABLE IF NOT EXISTS sync_watermarks (
  stream_name text PRIMARY KEY,
  last_success_cursor text,
  last_success_at timestamptz,
  last_attempt_cursor text,
  last_attempt_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO sync_watermarks (stream_name)
VALUES ('sync-ms-prospects')
ON CONFLICT (stream_name) DO NOTHING;
