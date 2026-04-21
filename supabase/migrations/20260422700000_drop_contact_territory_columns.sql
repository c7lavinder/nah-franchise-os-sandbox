-- Final step of the journeys restructure: retire the contact-scoped
-- territory columns. Territory is now sourced from
-- journey_pipeline_state.territory_ms_slug (per-territory jps rows on
-- runway/onboarding, NULL during pre-award sales). The one-column-per-
-- contact shape can't represent multi-territory franchisees correctly,
-- and keeping it around invited the silent-collapse bug we explicitly
-- forbade in the journeys plan.
--
-- All readers have been ported (LeadDetailView, TerritoryDealCards,
-- getContactByIdentifier, pipeline-state route). The PATCH writer's
-- territory allowlist + EOS carry-forward trigger have been removed;
-- carry-forward now fires when a jps row is inserted with a non-NULL
-- territory_ms_slug (advance + auto-advance paths).

ALTER TABLE contacts DROP COLUMN IF EXISTS territory;
ALTER TABLE contacts DROP COLUMN IF EXISTS territory_slug;
