-- Put 1st Completed before 25 Offers in Runway Inventory Building.

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
    SET sort_order = CASE slug
      WHEN 'first-completed' THEN 1
      WHEN 'twenty-five-offers' THEN 2
      WHEN 'three-purchased' THEN 3
      ELSE sort_order
    END
    WHERE stage_id = v_inventory_id
      AND slug IN ('first-completed', 'twenty-five-offers', 'three-purchased');
  END IF;
END $$;
