-- Add payload column to call_action_feedback for structured edit tracking.
-- Stores the full action fields as pushed/edited by the user, enabling
-- the learning loop to see exactly what the team changed.

alter table call_action_feedback add column if not exists payload jsonb;

-- Also make call_action_item_id nullable (already done in 20260413000001
-- for extraction feedback, but be explicit)
alter table call_action_feedback alter column call_action_item_id drop not null;
