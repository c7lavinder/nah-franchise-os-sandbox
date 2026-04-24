-- Per-extraction partner targeting for partnership journeys (Kevin + Kylie
-- Kremer, spouses, etc). Scout fills target_scope = 'single' for partner-
-- specific facts (personality, skills, license) and 'both' for shared facts
-- (timeline, capital, market interest, family situation). NULL means legacy
-- single-contact behavior — write to the extraction's contact_id only.
--
-- The rep can override before clicking Save via the segmented picker in the
-- Data tab UI; the override flows through the save route's request body and
-- does not require updating this column.

ALTER TABLE call_data_extractions
  ADD COLUMN target_scope text
    CHECK (target_scope IS NULL OR target_scope IN ('single', 'both'));

COMMENT ON COLUMN call_data_extractions.target_scope IS
  'For contact-category extractions on partnership journeys: ''single'' = write only to contact_id, ''both'' = fan out to every primary + co_primary on the journey. NULL = legacy single-target behavior.';
