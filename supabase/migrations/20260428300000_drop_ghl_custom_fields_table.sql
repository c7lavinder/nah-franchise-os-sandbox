-- Drop the ghl_custom_fields mapping table.
-- Custom field data has been migrated to contacts table columns.
-- GHL custom field definitions have been deleted from GHL.
-- This table is no longer needed.
DROP TABLE IF EXISTS ghl_custom_fields;
