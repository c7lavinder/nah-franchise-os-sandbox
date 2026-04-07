-- Sprint 1: Cron job log table (§1.20 Group 5)
-- Powers the Settings calendar view showing when cron jobs fire

CREATE TABLE IF NOT EXISTS cron_job_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status cron_job_status NOT NULL DEFAULT 'running',
  result jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
