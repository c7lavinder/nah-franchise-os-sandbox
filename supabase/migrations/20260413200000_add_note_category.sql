-- Add 'note' to the category check constraint on call_action_items
alter table call_action_items drop constraint if exists call_action_items_category_check;
alter table call_action_items add constraint call_action_items_category_check
  check (category in ('pipeline', 'apt', 'task', 'comms', 'workflow', 'data', 'note'));
