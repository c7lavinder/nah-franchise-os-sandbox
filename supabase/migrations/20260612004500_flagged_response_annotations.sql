-- Add highlight-level Scout feedback fields for audit review.
alter table flagged_responses
  add column if not exists selected_text text,
  add column if not exists concern_type text,
  add column if not exists correction_note text;

create index if not exists idx_flagged_responses_concern_type
  on flagged_responses(concern_type);
