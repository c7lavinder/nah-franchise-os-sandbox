-- Add 'ai-auto' as a valid last_updated_by source for auto-saved extractions.
-- 'ai' = pending review (medium confidence), 'ai-auto' = auto-confirmed (high confidence).

ALTER TABLE contact_profile_fields
  DROP CONSTRAINT IF EXISTS contact_profile_fields_last_updated_by_check;

ALTER TABLE contact_profile_fields
  ADD CONSTRAINT contact_profile_fields_last_updated_by_check
  CHECK (last_updated_by IN ('api', 'ai', 'ai-auto', 'manual', 'system'));

-- Also add saved_to_profile tracking on call_data_extractions
-- so we know which extractions were auto-saved vs manual-saved
ALTER TABLE call_data_extractions
  ADD COLUMN IF NOT EXISTS auto_saved boolean NOT NULL DEFAULT false;
