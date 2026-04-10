-- ══════════════════════════════════════════════
-- Reorder Follow-up pipeline stages: Nurture → Follow Up → Re-engaged
-- DB sort_order now matches display order.
-- ══════════════════════════════════════════════

-- Nurture = stage 1 (cold storage, entry point)
UPDATE pipeline_stages SET sort_order = 0
WHERE id = 'c0000000-0000-0000-0000-000000000002';

-- Follow-up = stage 2 (specific reason to resume)
UPDATE pipeline_stages SET sort_order = 1
WHERE id = 'c0000000-0000-0000-0000-000000000001';

-- Re-engaged = stage 3 (ready to resume Sales) — unchanged
UPDATE pipeline_stages SET sort_order = 2
WHERE id = 'c0000000-0000-0000-0000-000000000003';
