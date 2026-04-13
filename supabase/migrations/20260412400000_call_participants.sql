-- Call participants — links every participant to user/contact records
-- Replaces the ad-hoc participant resolution in detail/route.ts

create table if not exists call_participants (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references calls(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  role text not null check (role in ('nah_team', 'prospect', 'franchisee', 'unknown')),
  display_name text,
  email text,
  created_at timestamptz default now()
);

create index if not exists idx_call_participants_call_id on call_participants(call_id);
create index if not exists idx_call_participants_contact_id on call_participants(contact_id) where contact_id is not null;
create index if not exists idx_call_participants_user_id on call_participants(user_id) where user_id is not null;
