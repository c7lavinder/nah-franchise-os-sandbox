-- Migration: Call Page v2 — add summary_bullets for 3-bullet digest
-- contact_id already exists, call_data_capture not needed (call_data_extractions table handles this)

ALTER TABLE calls
ADD COLUMN IF NOT EXISTS summary_bullets TEXT[];
