-- Reorder Territories pipeline: Inactive → Available → Active
UPDATE pipeline_stages SET sort_order = 0 WHERE slug = 'inactive' AND pipeline_id = (SELECT id FROM pipelines WHERE slug = 'territories');
UPDATE pipeline_stages SET sort_order = 1 WHERE slug = 'available' AND pipeline_id = (SELECT id FROM pipelines WHERE slug = 'territories');
UPDATE pipeline_stages SET sort_order = 2 WHERE slug = 'active' AND pipeline_id = (SELECT id FROM pipelines WHERE slug = 'territories');
