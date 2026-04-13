-- Add metadata jsonb + display fields to call_action_items
-- metadata stores per-category pre-filled fields (apt dates, comms body, etc.)

alter table call_action_items
  add column if not exists metadata jsonb,
  add column if not exists contact_name text,
  add column if not exists assigned_to_name text,
  add column if not exists why text;
