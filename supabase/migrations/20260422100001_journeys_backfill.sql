-- ═══════════════════════════════════════════════════════════════════
-- Sprint: journeys-v1 — one-off backfill from existing data.
--
-- Rule: one journey per distinct contact that has ever had a row in
-- contact_pipeline_state. Primary membership is the contact themselves.
-- Pipeline state rows copy 1:1 (no multi-territory fan-out needed in
-- current data per the audit). Territory-owner franchisees get
-- is_converted_franchisee flipped true. Extraction/action journey_id
-- backfilled via the call's primary contact.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Flip is_converted_franchisee for active territory owners ──
UPDATE contacts c
SET is_converted_franchisee = true,
    updated_at = now()
FROM territory_owners o
WHERE o.ghl_contact_id = c.ghl_contact_id
  AND o.end_date IS NULL
  AND c.is_converted_franchisee IS DISTINCT FROM true;

-- ── 2. Create one journey per distinct pipeline-enrolled contact ─
INSERT INTO journeys (primary_contact_id, name, status, created_at, updated_at)
SELECT
  cps.contact_id,
  COALESCE(
    NULLIF(TRIM(BOTH ' ' FROM (COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, ''))), ''),
    c.email,
    'Unnamed'
  ) AS name,
  'active',
  now(),
  now()
FROM (SELECT DISTINCT contact_id FROM contact_pipeline_state) cps
JOIN contacts c ON c.id = cps.contact_id
WHERE NOT EXISTS (
  SELECT 1 FROM journeys j WHERE j.primary_contact_id = cps.contact_id
);

-- ── 3. Primary membership for every journey ──────────────────────
INSERT INTO journey_contacts (journey_id, contact_id, role, joined_at)
SELECT j.id, j.primary_contact_id, 'primary', j.created_at
FROM journeys j
WHERE NOT EXISTS (
  SELECT 1 FROM journey_contacts jc
  WHERE jc.journey_id = j.id
    AND jc.contact_id = j.primary_contact_id
    AND jc.left_at IS NULL
);

-- ── 4. Co-primary partners (business_partner + linked_contact_id) ─
-- None in current data; idempotent, future-proofed.
INSERT INTO journey_contacts (journey_id, contact_id, role, role_notes, joined_at)
SELECT j.id, crp.linked_contact_id, 'co_primary', crp.relationship_notes, crp.created_at
FROM contact_related_people crp
JOIN journeys j ON j.primary_contact_id = crp.contact_id
WHERE crp.role = 'business_partner'
  AND crp.linked_contact_id IS NOT NULL
  AND crp.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM journey_contacts jc
    WHERE jc.journey_id = j.id
      AND jc.contact_id = crp.linked_contact_id
      AND jc.left_at IS NULL
  );

-- ── 5. Other linked related-people (spouse, attorney, etc.) ──────
-- None in current data; idempotent.
INSERT INTO journey_contacts (journey_id, contact_id, role, role_notes, joined_at)
SELECT j.id, crp.linked_contact_id, crp.role, crp.relationship_notes, crp.created_at
FROM contact_related_people crp
JOIN journeys j ON j.primary_contact_id = crp.contact_id
WHERE crp.role <> 'business_partner'
  AND crp.role IN ('spouse','family','attorney','accountant','financial_advisor','other')
  AND crp.linked_contact_id IS NOT NULL
  AND crp.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM journey_contacts jc
    WHERE jc.journey_id = j.id
      AND jc.contact_id = crp.linked_contact_id
      AND jc.left_at IS NULL
  );

-- ── 6. Copy pipeline state ───────────────────────────────────────
-- For runway/onboarding pipelines, use the first active territory owned
-- by the contact. For sales/followup, territory_ms_slug stays NULL.
-- Multi-territory fan-out (extra rows for territories beyond the first)
-- is a no-op on current data — see audit.
INSERT INTO journey_pipeline_state (
  journey_id, territory_ms_slug, pipeline_id, current_stage_id, current_sub_task_id,
  current_sub_task_started_at, entered_pipeline_at, entered_current_stage_at,
  assigned_user_id, is_active, closed_reason, closed_at, created_at, updated_at
)
SELECT
  j.id,
  CASE
    WHEN p.slug IN ('runway','onboarding') THEN (
      SELECT o.ms_slug FROM territory_owners o
      WHERE o.ghl_contact_id = c.ghl_contact_id AND o.end_date IS NULL
      ORDER BY o.start_date ASC
      LIMIT 1
    )
    ELSE NULL
  END,
  cps.pipeline_id,
  cps.current_stage_id,
  cps.current_sub_task_id,
  cps.current_sub_task_started_at,
  cps.entered_pipeline_at,
  cps.entered_current_stage_at,
  cps.assigned_user_id,
  cps.is_active,
  cps.closed_reason,
  cps.closed_at,
  cps.created_at,
  cps.updated_at
FROM contact_pipeline_state cps
JOIN contacts c ON c.id = cps.contact_id
JOIN journeys j ON j.primary_contact_id = cps.contact_id
JOIN pipelines p ON p.id = cps.pipeline_id
WHERE NOT EXISTS (
  SELECT 1 FROM journey_pipeline_state jps
  WHERE jps.journey_id = j.id
    AND jps.pipeline_id = cps.pipeline_id
    AND COALESCE(jps.territory_ms_slug, '') = COALESCE(
      CASE
        WHEN p.slug IN ('runway','onboarding') THEN (
          SELECT o.ms_slug FROM territory_owners o
          WHERE o.ghl_contact_id = c.ghl_contact_id AND o.end_date IS NULL
          ORDER BY o.start_date ASC
          LIMIT 1
        )
        ELSE NULL
      END, ''
    )
);

-- ── 7. Backfill journey_id on extractions and action items ───────
UPDATE call_data_extractions cde
SET journey_id = j.id
FROM calls ca
JOIN journeys j ON j.primary_contact_id = ca.contact_id
WHERE cde.call_id = ca.id
  AND cde.journey_id IS NULL
  AND ca.contact_id IS NOT NULL;

UPDATE call_action_items cai
SET journey_id = j.id
FROM calls ca
JOIN journeys j ON j.primary_contact_id = ca.contact_id
WHERE cai.call_id = ca.id
  AND cai.journey_id IS NULL
  AND ca.contact_id IS NOT NULL;
