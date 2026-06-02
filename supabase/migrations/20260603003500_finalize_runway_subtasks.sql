-- Finalize Runway sub-stages.
--
-- Earlier seeds left both the original two-state runway tasks and the newer
-- single-state spec in production. Keep the finalized single-state set and
-- preserve any existing references before removing the old duplicates.

DO $$
DECLARE
  v_first_lead uuid;
  v_three_purchased uuid;
  v_first_completed uuid;
BEGIN
  SELECT id INTO v_first_lead FROM pipeline_sub_tasks WHERE slug = 'first-lead' LIMIT 1;
  SELECT id INTO v_three_purchased FROM pipeline_sub_tasks WHERE slug = 'three-purchased' LIMIT 1;
  SELECT id INTO v_first_completed FROM pipeline_sub_tasks WHERE slug = 'first-completed' LIMIT 1;

  IF v_first_lead IS NOT NULL THEN
    UPDATE contact_sub_task_logs
    SET
      sub_task_id = v_first_lead,
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('migrated_from_sub_task_slug', 'marketing-optimized')
    WHERE sub_task_id IN (SELECT id FROM pipeline_sub_tasks WHERE slug = 'marketing-optimized');
  END IF;

  IF v_three_purchased IS NOT NULL THEN
    UPDATE journey_pipeline_state
    SET current_sub_task_id = v_three_purchased
    WHERE current_sub_task_id IN (SELECT id FROM pipeline_sub_tasks WHERE slug = 'two-properties-inventory');
  END IF;

  IF v_first_completed IS NOT NULL THEN
    UPDATE journey_pipeline_state
    SET current_sub_task_id = v_first_completed
    WHERE current_sub_task_id IN (SELECT id FROM pipeline_sub_tasks WHERE slug = 'first-sale-closed');
  END IF;

  DELETE FROM pipeline_sub_tasks
  WHERE slug IN (
    'marketing-optimized',
    'offers-sent-10',
    'first-property-contract',
    'first-property-closed',
    'rehab-started',
    'second-property-contract',
    'two-properties-inventory',
    'first-sale-closed',
    'graduate-independent'
  )
  AND id NOT IN (SELECT DISTINCT sub_task_id FROM contact_sub_task_logs WHERE sub_task_id IS NOT NULL)
  AND id NOT IN (SELECT DISTINCT current_sub_task_id FROM journey_pipeline_state WHERE current_sub_task_id IS NOT NULL);

  UPDATE pipeline_sub_tasks
  SET state_type = 'single', default_logger_type = 'user', is_required = true
  WHERE slug IN (
    'first-lead',
    'first-walkthrough',
    'first-offer',
    'ten-offers',
    'first-contract',
    'closing-set',
    'closing',
    'construction-start',
    'hundred-offers',
    'three-purchased',
    'first-completed'
  );
END $$;

