-- ============================================================
-- MasterSuite Lead List Properties
-- Lean raw Stage 0 rows for properties still in "0 Lead List".
--
-- These rows intentionally do not FK to ms_properties because the full
-- property sync only starts once a property leaves "0 Lead List".
-- PropertyId is the bridge when a property graduates to Stage 1+.
-- ============================================================

CREATE TABLE IF NOT EXISTS ms_lead_list_properties (
  "PropertyId" int PRIMARY KEY,
  "Archived" boolean NOT NULL DEFAULT false,
  "TerritorySlug" text REFERENCES territories("TerritorySlug") ON DELETE RESTRICT,
  "PropertyType" text,
  "BatchId" text,
  "Inserted" timestamptz,
  "InsertedBy" text,
  "LastModified" timestamptz,
  "LastModifiedBy" text,
  "PropertyReviewedDate" timestamptz,
  "PropertyReviewedBy" text,
  "PropertyReviewedByFriendlyName" text,
  "PropertyUrl" text,
  "AddressSlugVerbose" text,
  "AddressSlugShort" text,
  "Address1" text,
  "Streetname" text,
  "Zip" text,
  "City" text,
  "State" text,
  "County" text,
  "GoogleCity" text,
  "GoogleState" text,
  "GoogleCounty" text,
  "Latitude" decimal(9,6),
  "Longitude" decimal(9,6),
  "AutoTerritorySlug" text,
  "ZillowPropertyId" text,
  "OwnerOfferStatus" text,
  "DirectSellerNotes" text,
  "OwnerLeadSource" text,
  "Vacant" text,
  "Septic" text,
  "RoadType" text,
  "LeadCategory" text,
  "LeadType" text,
  "LeadClassification" text,
  "LeadSubType2" text,
  "Status" text,
  "is_current_lead_list" boolean NOT NULL DEFAULT true,
  "ms_synced_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ms_llp_territory ON ms_lead_list_properties("TerritorySlug");
CREATE INDEX IF NOT EXISTS idx_ms_llp_inserted ON ms_lead_list_properties("Inserted");
CREATE INDEX IF NOT EXISTS idx_ms_llp_last_modified ON ms_lead_list_properties("LastModified");
CREATE INDEX IF NOT EXISTS idx_ms_llp_status ON ms_lead_list_properties("Status");
CREATE INDEX IF NOT EXISTS idx_ms_llp_current ON ms_lead_list_properties("is_current_lead_list");
CREATE INDEX IF NOT EXISTS idx_ms_llp_category_type ON ms_lead_list_properties("LeadCategory", "LeadType");
