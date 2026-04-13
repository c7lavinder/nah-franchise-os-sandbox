-- Add extraction_id to call_action_feedback for data field feedback tracking
alter table call_action_feedback
  add column if not exists extraction_id uuid references call_data_extractions(id) on delete cascade;

-- Make call_action_item_id nullable (data field feedback has no action item)
alter table call_action_feedback
  alter column call_action_item_id drop not null;
