-- Sprint: call-matching-consolidation (Phase 1).
-- Store the confidence score (0..1) and plain-English reason the shared
-- participant resolver produced, so operators can see why a call was tied to
-- a given contact/territory and flag uncertain matches for review.

ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS match_confidence numeric(3, 2) NULL,
  ADD COLUMN IF NOT EXISTS match_reason text NULL;
