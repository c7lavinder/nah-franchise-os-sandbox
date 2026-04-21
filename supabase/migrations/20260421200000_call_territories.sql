-- Sprint: call-mapping-v2 (Phase 5).
-- Multi-territory support: a single call can touch multiple territories
-- (e.g. Phil holds several territories and discusses each). calls.territory_ms_slug
-- remains the "primary" pointer for backwards compatibility; the join table
-- carries the full list plus the is_primary flag.

CREATE TABLE IF NOT EXISTS call_territories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  territory_ms_slug text NOT NULL REFERENCES territories(ms_slug) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (call_id, territory_ms_slug)
);

CREATE INDEX IF NOT EXISTS idx_call_territories_call
  ON call_territories(call_id);

CREATE INDEX IF NOT EXISTS idx_call_territories_territory
  ON call_territories(territory_ms_slug);

-- At most one primary territory per call.
CREATE UNIQUE INDEX IF NOT EXISTS uq_call_territories_primary
  ON call_territories(call_id)
  WHERE is_primary = true;

-- Backfill existing calls: mirror calls.territory_ms_slug into the join table
-- as the primary row.
INSERT INTO call_territories (call_id, territory_ms_slug, is_primary)
SELECT id, territory_ms_slug, true
FROM calls
WHERE territory_ms_slug IS NOT NULL
  AND deleted_at IS NULL
ON CONFLICT (call_id, territory_ms_slug) DO NOTHING;
