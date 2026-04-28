# ADR 0001: GHL as source of truth for contacts

## Status
Accepted

## Context
NAH uses GoHighLevel (GHL) as its CRM. Contacts, messaging, and appointment data originate in GHL. The app needs access to this data for Scout, pipeline management, and intelligence.

## Decision
GHL is the source of truth for contact records, messaging, tasks, and appointments. The app mirrors contact data to Supabase for fast access and enrichment, but GHL remains the canonical source. All outbound actions (send message, create task, move stage) go through GHL's API.

## Consequences
- App must sync with GHL (via polling or webhooks) to stay current
- Contact writes go through GHL API, not directly to Supabase
- GHL OAuth token refresh is critical infrastructure (cron job every 12h)
- Pipeline stage logic lives in the app, not in GHL
