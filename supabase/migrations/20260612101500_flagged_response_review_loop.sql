-- Add an operational review loop for Scout feedback submitted from highlighted responses.
alter table flagged_responses
  add column if not exists status text not null default 'needs_review'
    check (status in ('needs_review', 'working_on_it', 'fixed', 'skipped')),
  add column if not exists reviewed_at timestamptz,
  add column if not exists resolved_at timestamptz;

create index if not exists idx_flagged_responses_status
  on flagged_responses(status);

create index if not exists idx_flagged_responses_status_created
  on flagged_responses(status, created_at desc);
