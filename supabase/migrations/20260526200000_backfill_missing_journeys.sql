-- ═══════════════════════════════════════════════════════════════════
-- Backfill: restore thousands of missing pipeline journeys.
--
-- Root cause: a prior archival pass set is_active=false on 2,385
-- Follow-up/Nurture pipeline rows AND archived their parent journeys.
-- Additionally, ~450 contacts never got journeys at all (missed by
-- the original 20260422100001 backfill). 23 of those were duplicates
-- of existing contacts and were merged.
--
-- RAN MANUALLY 2026-05-26. This file documents what was executed.
-- ═══════════════════════════════════════════════════════════════════

-- ── Step 1: Reactivate 2,385 inactive Nurture pipeline rows ──────
-- UPDATE journey_pipeline_state
-- SET is_active = true, updated_at = now()
-- WHERE is_active = false
--   AND pipeline_id = 'a0000000-0000-0000-0000-000000000002'
--   AND current_stage_id = 'c0000000-0000-0000-0000-000000000002';
-- Result: UPDATE 2385

-- ── Step 2: Merge 23 duplicate orphan contacts ───────────────────
-- Orphans matched by exact first+last name to existing contacts with journeys.
-- Child records (call_participants, contact_emails, contact_related_people)
-- reassigned to keep contact. Duplicate profile fields deleted.
-- Orphan contacts marked with merged_into_contact_id.
-- Result: 23 contacts merged

-- ── Step 3: Create journeys for 427 remaining orphan contacts ────
-- Excluded: @newagainhouses.com team emails, already-merged contacts.
-- Each got: journey (active) + journey_contacts (primary) +
-- journey_pipeline_state (Follow-up → Nurture, is_active=true).
-- Result: INSERT 427 journeys, 446 memberships, 427 pipeline rows

-- ── Step 4: Reactivate 2,381 archived journeys ──────────────────
-- UPDATE journeys SET status = 'active', updated_at = now()
-- WHERE status = 'archived'
--   AND EXISTS (SELECT 1 FROM journey_pipeline_state jps
--     WHERE jps.journey_id = journeys.id AND jps.is_active = true);
-- Result: UPDATE 2381

-- Final state: 3,011 active Nurture rows, 3,171 total active pipeline rows.
