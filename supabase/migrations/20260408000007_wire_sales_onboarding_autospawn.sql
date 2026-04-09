-- Wire Sales → Onboarding: when a contact reaches Closed stage, auto-spawn Onboarding pipeline
UPDATE pipeline_stages
SET auto_spawn_pipeline_id = 'a0000000-0000-0000-0000-000000000003'
WHERE id = 'b0000000-0000-0000-0000-000000000006'  -- Closed stage in Sales pipeline
  AND pipeline_id = 'a0000000-0000-0000-0000-000000000001';
