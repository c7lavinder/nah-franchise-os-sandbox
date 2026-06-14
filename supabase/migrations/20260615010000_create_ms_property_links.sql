-- MasterSuite property links used by coaching dashboard checks.
CREATE TABLE IF NOT EXISTS ms_property_links (
  "PropertyId" int NOT NULL REFERENCES ms_properties("PropertyId") ON DELETE CASCADE,
  "LinkName" text NOT NULL,
  "Url" text,
  "ms_synced_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("PropertyId", "LinkName")
);

CREATE INDEX IF NOT EXISTS idx_ms_property_links_property ON ms_property_links("PropertyId");
CREATE INDEX IF NOT EXISTS idx_ms_property_links_name ON ms_property_links("LinkName");
