-- Expand workflow_steps step_type CHECK constraint to include all 16 step types.
-- Original constraint only allowed 8 types from the initial build.
-- Action-parity types (appointment, send_reminder, etc.) were added in code but not in schema.

ALTER TABLE workflow_steps
  DROP CONSTRAINT IF EXISTS workflow_steps_step_type_check;

ALTER TABLE workflow_steps
  ADD CONSTRAINT workflow_steps_step_type_check
  CHECK (step_type IN (
    'sms',
    'email',
    'chad_call_task',
    'team_notify',
    'ai_agent_action',
    'condition_check',
    'stage_move_suggestion',
    'trainual_check',
    'appointment',
    'send_reminder',
    'internal_note',
    'add_tag',
    'remove_tag',
    'update_contact',
    'pipeline_move',
    'trigger_workflow'
  ));
