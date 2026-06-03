-- Rename the Runway Inventory Building offer milestone from 100 Offers to 25 Offers.

DO $$
DECLARE
  v_inventory_id uuid;
BEGIN
  SELECT id INTO v_inventory_id
  FROM pipeline_stages
  WHERE slug = 'inventory-building'
  LIMIT 1;

  IF v_inventory_id IS NOT NULL THEN
    UPDATE pipeline_sub_tasks
    SET slug = 'twenty-five-offers',
        name = '25 Offers',
        sort_order = 2
    WHERE stage_id = v_inventory_id
      AND slug = 'hundred-offers';

    UPDATE pipeline_sub_tasks
    SET name = '25 Offers',
        sort_order = 2
    WHERE stage_id = v_inventory_id
      AND slug = 'twenty-five-offers';

    UPDATE pipeline_sub_tasks
    SET sort_order = 1
    WHERE stage_id = v_inventory_id
      AND slug = 'first-completed';

    UPDATE pipeline_sub_tasks
    SET sort_order = 3
    WHERE stage_id = v_inventory_id
      AND slug = 'three-purchased';
  END IF;
END $$;
