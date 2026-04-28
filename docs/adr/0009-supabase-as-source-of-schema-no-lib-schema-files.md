# ADR 0009: Schema lives in supabase/migrations/ only

## Status
Accepted

## Context
Schema was fragmented across supabase/migrations/, lib/intelligence/schema.sql, and lib/workflows/schema.sql. This caused confusion about source of truth and risked divergence.

## Decision
All database schema lives in supabase/migrations/ as numbered files. The lib/*/schema.sql files were moved to 006_intelligence_tables.sql and 007_workflow_tables.sql in Session A.

## Consequences
- Single location for all schema
- Setup scripts updated to reference new paths
- New tables: create a new numbered migration file
- No more schema files in lib/ directories
