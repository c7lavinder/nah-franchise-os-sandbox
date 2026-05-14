-- Add report_type so users can distinguish bugs (something broken) from
-- improvements (suggestions). Improvements don't fit the small/medium/big/
-- emergency priority scale because nothing is actually broken.

ALTER TABLE bug_reports
  ADD COLUMN IF NOT EXISTS report_type text NOT NULL DEFAULT 'bug'
    CHECK (report_type IN ('bug', 'improvement'));

CREATE INDEX IF NOT EXISTS idx_bug_reports_type ON bug_reports(report_type);
