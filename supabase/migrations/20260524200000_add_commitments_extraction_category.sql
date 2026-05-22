-- Phase 9: Add 'commitments' to extraction field_category constraint
ALTER TABLE call_data_extractions
  DROP CONSTRAINT IF EXISTS call_data_extractions_field_category_check;

ALTER TABLE call_data_extractions
  ADD CONSTRAINT call_data_extractions_field_category_check
  CHECK (field_category IN (
    'contact', 'contact_eos',
    'territory', 'territory_eos', 'territory_market',
    'market', 'business_financials', 'business_health',
    'commitments'
  ));
