-- Enable pg_trgm for fuzzy/trigram contact search
-- Fixes: "Chuck Rearson" not matching "Chuck Rierson" in search_contacts
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram indexes on name columns for fast similarity queries
CREATE INDEX IF NOT EXISTS idx_contacts_first_name_trgm
  ON contacts USING gin (first_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_contacts_last_name_trgm
  ON contacts USING gin (last_name gin_trgm_ops);

-- RPC function: fuzzy contact search with similarity scoring
CREATE OR REPLACE FUNCTION search_contacts_fuzzy(
  search_query text,
  max_results int DEFAULT 10,
  similarity_threshold float DEFAULT 0.2
)
RETURNS TABLE (
  id uuid,
  ghl_contact_id text,
  first_name text,
  last_name text,
  email text,
  phone text,
  city text,
  state text,
  opportunity_source text,
  territory_interest text,
  "NonRetirementCapitalAvailable" text,
  scout_lead_score numeric,
  similarity_score float
)
LANGUAGE plpgsql
AS $$
DECLARE
  words text[];
  first_word text;
  last_words text;
BEGIN
  words := string_to_array(trim(search_query), ' ');

  IF array_length(words, 1) >= 2 THEN
    first_word := words[1];
    last_words := array_to_string(words[2:], ' ');

    RETURN QUERY
      SELECT
        c.id, c.ghl_contact_id, c.first_name, c.last_name,
        c.email, c.phone, c.city, c.state,
        c.opportunity_source, c.territory_interest,
        c."NonRetirementCapitalAvailable", c.scout_lead_score,
        (similarity(c.first_name, first_word) + similarity(c.last_name, last_words)) / 2.0 AS similarity_score
      FROM contacts c
      WHERE
        similarity(c.first_name, first_word) > similarity_threshold
        OR similarity(c.last_name, last_words) > similarity_threshold
      ORDER BY similarity_score DESC
      LIMIT max_results;
  ELSE
    RETURN QUERY
      SELECT
        c.id, c.ghl_contact_id, c.first_name, c.last_name,
        c.email, c.phone, c.city, c.state,
        c.opportunity_source, c.territory_interest,
        c."NonRetirementCapitalAvailable", c.scout_lead_score,
        greatest(
          similarity(c.first_name, search_query),
          similarity(c.last_name, search_query)
        ) AS similarity_score
      FROM contacts c
      WHERE
        similarity(c.first_name, search_query) > similarity_threshold
        OR similarity(c.last_name, search_query) > similarity_threshold
      ORDER BY similarity_score DESC
      LIMIT max_results;
  END IF;
END;
$$;
