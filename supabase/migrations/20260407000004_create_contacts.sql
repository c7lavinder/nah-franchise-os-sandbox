-- Sprint 1: Contacts mirror table (§1.20 Group 2)
-- Local mirror of GHL contact, synced via webhook on create/update
-- This is the source of truth for contact data within our app

CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ghl_contact_id text UNIQUE NOT NULL,  -- GHL's ID — the sync key
  first_name text,
  last_name text,
  email text,
  phone text,
  address text,
  city text,
  state text,
  zip text,
  opportunity_source text,
  notes text,  -- Initial notes brought over from GHL
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime(updated_at);
