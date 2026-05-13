-- Bug reports table for in-app bug reporting
create table if not exists bug_reports (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id),
  user_name     text not null,
  description   text not null,
  screenshot_url text,
  priority      text not null default 'medium' check (priority in ('small', 'medium', 'big', 'emergency')),
  status        text not null default 'needs_review' check (status in ('needs_review', 'working_on_it', 'fixed', 'skipped')),
  page_url      text,
  created_at    timestamptz not null default now()
);

-- Index for listing by status (audit page)
create index idx_bug_reports_status on bug_reports(status);

-- Index for listing by user
create index idx_bug_reports_user on bug_reports(user_id);
