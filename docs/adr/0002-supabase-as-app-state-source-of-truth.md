# ADR 0002: Supabase as app state source of truth

## Status
Accepted

## Context
The app needs to store pipeline configurations, scoring data, workflow definitions, EOS data, knowledge base, and user sessions. GHL doesn't support this level of custom data.

## Decision
Supabase (PostgreSQL) is the source of truth for all app state that isn't contact/messaging data. This includes pipelines, stages, sub-tasks, journeys, intelligence scores, workflows, EOS, knowledge base, and user sessions.

## Consequences
- Schema managed via numbered migrations in supabase/migrations/
- Service role key used server-side (bypasses RLS, app-level auth instead)
- All app-level data queries go through Supabase, not GHL
- GHL data is mirrored to Supabase for joins and fast access
