# Session Handoff — 2026-05-11 — Session 39

## Status

Phase: Data Consolidation + Scout LLM Gaps / Health: Green / Duration: full session

## What Was Built This Session

- **MasterSuite sync cron fix** (`next.config.js`, 5 cron routes): added `serverExternalPackages: ["mysql2", "ws"]` so Vercel bundles them correctly; added try/catch to all 5 MS sync crons so errors log to `cron_job_log` instead of silently crashing — fixed 170 stuck "running" entries
- **Data consolidation — territory page**: merged Details + Market tabs into single "Data" tab (5 tabs → 4); removed quarterly scorecard (MasterSuite aggregated KPIs); removed Financial Performance category from market-field-registry (6 fields)
- **EOS tab read-only**: removed all add/edit/delete UI from 8 EOS sub-components — MasterSuite sync is the only writer; added "Last synced" timestamp
- **Journey territory tab fix** (`TerritoryDataTab.tsx`): replaced empty `territory_profile` reads with performance API data — stat cards now show real numbers
- **Owner & Contact linked** (`DataTab.tsx`): Owner section now shows contact records from `territory_owners`/`journey_contacts` instead of hardcoded text fields on `territories` table
- **Dead KPI cleanup**: dropped 11 NULL columns from `territory_profile`, rebuilt `territory_performance` view, rewrote `north-star` API to calc from `ms_property_inventory`, removed KPI fields from post-call extraction prompt
- **Calls page** (`calls/page.tsx`): removed upcoming/scheduled calls, show completed only
- **Scout rules tightened** (`client.ts`): no dramatizing empty data (rule 12), no proposing features (rule 11), DRC must show full draft details (To/From/Subject/Body), hard separation between FranDev and Acquisitions worlds with ambiguous term examples
- **Scout data bugs fixed** (`tool-executor.ts`, `data-tools.ts`): `network_benchmarks` was querying `ms_property_inventory.TerritorySlug` (doesn't exist) — fixed to join through `ms_properties`; `getContactProfile` was querying legacy `call_logs` table — fixed to use `calls` via `call_participants`
- **ADR-0012**: documented 5 Scout LLM gaps from real user conversations
- **Gap 2 — `get_contact_calls` tool** (`tools.ts`, `tool-executor.ts`, `types/scout.ts`): new tool returns call history for a contact with title, date, duration, type, grade, summary, action items
- **Gap 3 — Session persistence** (`QuickAsk.tsx`, `session/route.ts`): loads most recent active session on panel mount; shows last exchange for context; "New conversation" button to start fresh
- **Gap 4 — Data freshness** (`client.ts`): system prompt now includes last sync timestamps from `cron_job_log`; if data is stale (>24h), Scout says so instead of speculating
- **Gap 5 — World labels** (`tool-executor.ts`, `data-tools.ts`): all tool responses tagged with `world: "frandev"` or `world: "acquisitions"` so Scout never mixes metrics
- **Gap 1 — Coaching brief cron** (`coaching-brief/route.ts`, `vercel.json`): daily 7 AM for rep users — top 3 leads needing action, overdue follow-ups, call quality trend, objection patterns, weekly scorecard on Mondays

## What Is Confirmed Working

- `npx tsc --noEmit` — 0 errors
- 129 tests passing (13 test files)
- Migration `20260511100000` applied to live Supabase — 11 columns dropped, view rebuilt
- 170 stuck cron_job_log entries cleaned up (marked as failed)
- PTO sync function ran successfully locally (wired 6 contacts)
- 11 commits pushed to main

## What Is Broken or Incomplete

- MasterSuite DB (`db-production.mastersuiteapp.com`) stopped receiving new data on May 5 — waiting on Ben to investigate — Critical
- Kyle Duggan does not exist in MasterSuite — no "Kyle Duggan" in any table — Low
- `ghl_custom_fields` table still not applied to live DB — High (carried forward)
- Coaching brief cron depends on pipeline data flowing to be useful — blocked by MasterSuite DB — Medium
- Scout brevity rules are prompt-based — improved but LLM may still occasionally be verbose — Low

## Decisions Made

- MasterSuite is source of truth for raw data; NAH OS calculates its own KPIs — Corey approved
- Per-property calculated fields (profit, ARV) kept; multi-property aggregated KPIs removed — Corey approved
- Details + Market merged into "Data" tab (4 tabs instead of 5) — Corey approved
- EOS tab is read-only mirror of MasterSuite — Corey approved
- Journey page keeps territory data inline (daily driver, not duplication) — Corey approved
- FranDev and Acquisitions are "two completely separate worlds" — Matt flagged, Corey approved
- Scout must never propose building new features — Corey approved after reviewing Matt's conversation
- Scout DRC must always show full draft details (To/From/Subject/Body) — Corey approved after reviewing conversation

## Files Created

- `components/territories/tabs/DataTab.tsx`
- `app/api/cron/coaching-brief/route.ts`
- `supabase/migrations/20260511100000_drop_aggregated_kpi_columns.sql`
- `docs/adr/0012-scout-llm-gap-analysis.md`

## Files Modified

- `next.config.js` — serverExternalPackages
- `vercel.json` — coaching-brief cron added
- `app/(auth)/calls/page.tsx` — completed calls only
- `app/(auth)/contacts/[contactId]/page.tsx` — territory KPIs from performance API
- `app/(auth)/territories/[TerritorySlug]/page.tsx` — quarterly scorecard removed, tabs merged, Data tab
- `app/api/cron/sync-ms-prospects/route.ts` — try/catch error handling
- `app/api/cron/sync-ms-properties/route.ts` — try/catch error handling
- `app/api/cron/sync-ms-territories/route.ts` — try/catch error handling
- `app/api/cron/sync-ms-eos/route.ts` — try/catch error handling
- `app/api/cron/sync-ms-lead-list/route.ts` — try/catch error handling
- `app/api/metrics/north-star/route.ts` — rewritten to calc from ms_property_inventory
- `app/api/scout/session/route.ts` — returns lastActivity for session persistence
- `app/api/settings/cron-jobs/route.ts` — coaching-brief added
- `components/contact/TerritoryDataTab.tsx` — performance API instead of empty territory_profile
- `components/scout/QuickAsk.tsx` — session persistence + new conversation button
- `components/territories/eos/TerritoryEosGoals.tsx` — read-only
- `components/territories/eos/TerritoryEosHabits.tsx` — read-only
- `components/territories/eos/TerritoryEosIssues.tsx` — read-only
- `components/territories/eos/TerritoryEosLeadChannels.tsx` — read-only
- `components/territories/eos/TerritoryEosMonthlySpend.tsx` — read-only
- `components/territories/eos/TerritoryEosRocks.tsx` — read-only
- `components/territories/eos/TerritoryEosScorecard.tsx` — read-only
- `components/territories/eos/TerritoryEosTodos.tsx` — read-only
- `components/territories/tabs/EosTab.tsx` — read-only + last synced
- `lib/agents/post-call/prompts/extraction.ts` — removed dead KPI extraction fields
- `lib/scout/client.ts` — rules tightened, FranDev/Acquisitions separation, data freshness, DRC details
- `lib/scout/data-tools.ts` — world labels, contact call lookup fix
- `lib/scout/tool-executor.ts` — network_benchmarks join fix, get_contact_calls, world labels
- `lib/scout/tools.ts` — get_contact_calls tool definition
- `lib/territory/market-field-registry.ts` — financial_performance category removed
- `types/scout.ts` — get_contact_calls added to ScoutToolName

## Files Deleted

- `app/api/territories/[TerritorySlug]/quarterly-grades/route.ts`
- `components/territories/tabs/DetailsTab.tsx` (merged into DataTab)

## Open Issues Carried Forward

- MasterSuite DB stopped writing May 5 — Ben notified, awaiting response — Critical
- `ghl_custom_fields` table needs migration applied + populated from GHL — High
- No pipelines in GHL location (sandbox state) — Medium
- `ghl_workflows` table empty — Medium
- PTO prospects need real GHL contact creation or sync — Medium
- Phase 3 supporting table sync (mortgages, comparables, royalty, etc.) — Medium
- pgvector embeddings need backfill for RAG — Medium
- Scout session persistence shows last response only — could evolve to full chat log UI — Low

## Exact Next Step

Follow up with Ben on MasterSuite DB status, then test Scout with Matt's exact questions to verify network_benchmarks returns real data, call history works, and FranDev/Acquisitions separation holds.

## Copy This To Start Next Session In Claude.ai

---

Read this file then tell me: current status, last session summary, open issues, what we build today.
GitHub: https://github.com/c7lavinder/nah-franchise-os-sandbox/blob/main/SESSION_START.md
Then: Follow up with Ben on MasterSuite DB, test Scout with Matt's questions to verify network_benchmarks, call history, and FranDev/Acquisitions separation.

---
