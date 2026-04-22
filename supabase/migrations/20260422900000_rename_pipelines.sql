-- Human-friendly pipeline names. The UI shows these labels directly in the
-- pipeline bar, Scout context, and OwnershipPath visual. Keeps slugs stable
-- so every route, webhook, and automation keeps working — we're only
-- editing the display name.

UPDATE pipelines SET name = 'Path to Ownership' WHERE slug = 'sales';
UPDATE pipelines SET name = 'Onboarding' WHERE slug = 'onboarding';
UPDATE pipelines SET name = 'Path to Inventory' WHERE slug = 'runway';
UPDATE pipelines SET name = 'Follow-up' WHERE slug = 'followup';
