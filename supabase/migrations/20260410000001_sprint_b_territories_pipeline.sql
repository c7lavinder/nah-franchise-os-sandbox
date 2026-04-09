-- Sprint B: Insert Territories pipeline + fix Long-term sort_order
-- Runway sub-tasks aligned to spec (all single-state)

-- Insert Territories pipeline
INSERT INTO pipelines (id, slug, name, description, is_active, sort_order, entity_type, is_visible_in_nav)
VALUES (
  'd0000000-0000-0000-0000-000000000004',
  'territories',
  'Territories',
  'Territory network health: Active, Inactive, Available',
  true, 4, 'territory', true
)
ON CONFLICT (id) DO NOTHING;

-- Fix Long-term (Follow-up) sort_order to 5
UPDATE pipelines SET sort_order = 5 WHERE slug = 'followup';

-- Territories stages (no sub-tasks)
INSERT INTO pipeline_stages (id, pipeline_id, slug, name, sort_order, is_terminal)
VALUES
  ('d1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'active', 'Active', 1, false),
  ('d1000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000004', 'inactive', 'Inactive', 2, false),
  ('d1000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000004', 'available', 'Available', 3, false)
ON CONFLICT (id) DO NOTHING;

-- Ensure Runway sub-tasks exist and are single-state
-- Get Runway stage IDs
DO $$
DECLARE
  v_first_offer_id uuid;
  v_first_purchase_id uuid;
  v_inventory_id uuid;
BEGIN
  SELECT id INTO v_first_offer_id FROM pipeline_stages WHERE slug = 'first-offer' LIMIT 1;
  SELECT id INTO v_first_purchase_id FROM pipeline_stages WHERE slug = 'first-purchase' LIMIT 1;
  SELECT id INTO v_inventory_id FROM pipeline_stages WHERE slug = 'inventory-building' LIMIT 1;

  -- First Offer sub-tasks
  IF v_first_offer_id IS NOT NULL THEN
    INSERT INTO pipeline_sub_tasks (stage_id, slug, name, sort_order, state_type, is_required, default_logger_type)
    VALUES
      (v_first_offer_id, 'first-lead', 'First Lead', 1, 'single', true, 'user'),
      (v_first_offer_id, 'first-walkthrough', 'First Walkthrough', 2, 'single', true, 'user'),
      (v_first_offer_id, 'first-offer', 'First Offer', 3, 'single', true, 'user'),
      (v_first_offer_id, 'ten-offers', '10 Offers', 4, 'single', true, 'user')
    ON CONFLICT DO NOTHING;
  END IF;

  -- First Purchase sub-tasks
  IF v_first_purchase_id IS NOT NULL THEN
    INSERT INTO pipeline_sub_tasks (stage_id, slug, name, sort_order, state_type, is_required, default_logger_type)
    VALUES
      (v_first_purchase_id, 'first-contract', 'First Contract', 1, 'single', true, 'user'),
      (v_first_purchase_id, 'closing-set', 'Closing Set', 2, 'single', true, 'user'),
      (v_first_purchase_id, 'closing', 'Closing', 3, 'single', true, 'user'),
      (v_first_purchase_id, 'construction-start', 'Construction Start', 4, 'single', true, 'user')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Inventory Building sub-tasks
  IF v_inventory_id IS NOT NULL THEN
    INSERT INTO pipeline_sub_tasks (stage_id, slug, name, sort_order, state_type, is_required, default_logger_type)
    VALUES
      (v_inventory_id, 'hundred-offers', '100 Offers', 1, 'single', true, 'user'),
      (v_inventory_id, 'three-purchased', '3 Purchased', 2, 'single', true, 'user'),
      (v_inventory_id, 'first-completed', '1st Completed', 3, 'single', true, 'user')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- NOTE: Runway time thresholds are handled in lib/runway-health.ts
-- (pipeline_stages table does not have per-stage threshold columns;
--  global thresholds live in pipeline_app_settings)
