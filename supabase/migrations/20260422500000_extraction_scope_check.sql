-- Data-lake integrity per the journeys plan: every call_data_extractions
-- row must attach to at least one scope (contact_id, journey_id, or
-- territory_ms_slug). Rows without scope can't be used by the predictive
-- LLM downstream — they're orphan facts.
--
-- Pre-conditions: scripts/resolve-orphan-extractions.ts has been run to
-- rescue 107 legacy rows via call.contact_id and hard-delete 999 team-call
-- mashups from the pre-prompt-fix era. lib/agents/post-call/agent.ts now
-- filters unscoped extractions before insert so new orphans can't appear.

ALTER TABLE call_data_extractions
  ADD CONSTRAINT chk_extraction_has_scope
  CHECK (
    contact_id IS NOT NULL
    OR journey_id IS NOT NULL
    OR territory_ms_slug IS NOT NULL
  );
