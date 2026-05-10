-- Fix: add missing column from PropertyCalculations
ALTER TABLE ms_property_calculations
  ADD COLUMN IF NOT EXISTS "Calculated_AuctionMinimumPriceMeta" text;
