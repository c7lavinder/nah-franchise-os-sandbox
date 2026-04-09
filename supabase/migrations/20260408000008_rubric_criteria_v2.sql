-- Mega Sprint D1: Add hybrid rubric fields to rubric_criteria
ALTER TABLE rubric_criteria ADD COLUMN IF NOT EXISTS positive_examples text[];
ALTER TABLE rubric_criteria ADD COLUMN IF NOT EXISTS negative_examples text[];
ALTER TABLE rubric_criteria ADD COLUMN IF NOT EXISTS example_phrases_positive text[];
ALTER TABLE rubric_criteria ADD COLUMN IF NOT EXISTS example_phrases_negative text[];
ALTER TABLE rubric_criteria ADD COLUMN IF NOT EXISTS kb_document_ids uuid[];
