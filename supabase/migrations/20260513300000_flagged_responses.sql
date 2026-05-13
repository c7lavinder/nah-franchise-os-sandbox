-- Flagged Scout responses for admin review
create table if not exists flagged_responses (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid references sessions(id) on delete set null,
  user_id       uuid not null references users(id),
  user_name     text not null,
  user_message  text not null,
  ai_response   text not null,
  page_url      text,
  created_at    timestamptz not null default now()
);

create index idx_flagged_responses_created on flagged_responses(created_at desc);
