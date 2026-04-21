-- Sprint: call-classification-consolidation (Phase 3).
-- Store the plain-English reason the shared classifier produced alongside the
-- call_type_id. Lets admins audit why a given call was classified a certain
-- way without digging through code or logs.

ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS classification_reason text NULL;
