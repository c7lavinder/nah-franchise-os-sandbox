# Session Handoff — 2026-05-26 — Session 58

## Status

Phase: Journey detail page overhaul — Brief + Revenue panels / Health: Yellow / Duration: full session

## What Was Built This Session

- **Journey Brief panel** — AI-generated narrative summary replacing the Entity panel on journey detail page. Uses Claude Haiku 4.5 with compact context payload. Stored in `journey_briefs` table, event-driven regeneration (stage change, call graded, property sync), inline generation on first visit (~3-5s), instant from cache after that. Refresh button for manual regen.
- **Journey Brief agent** — `lib/briefs/journey-brief-agent.ts` with stage-aware context (STAGE_CONTEXT map), deterministic next actions, territory_owners fallback for start date + territory resolution
- **Revenue panel** — replacing the Deal panel. Shows franchise fee (editable), royalty paid, royalty due with color-matched numbers (blue/green/orange). Horizontal stacked progress bar toward $500k/10yr goal. Pace indicator (ahead/on/behind) based on royalty-only vs $460k target. Network median marker.
- **ms_property_royalty sync** — added PropertyRoyalty sync as step 5 in `syncProperties()`. Table existed but was never synced (0 rows). Now syncs 1,791 rows.
- **L10 admin guard** — L10 page now redirects non-admin users to /daily-hq
- **Journey Brief agent in Settings** — shows in Settings > Agents panel with toggle and manual Run button
- **Stale trigger system** — `lib/briefs/mark-journey-brief-stale.ts` with helpers for contact, journey, and territory. Wired into pipeline advance/revert, call grading, and MasterSuite property sync.
- **Cron integration** — `generate-briefs` cron now handles journey briefs (stale regen + seeding new ones)

## What Is Confirmed Working

- Journey Brief generates and displays on journey page with Refresh button
- Revenue panel shows real royalty data from ms_property_royalty (verified Brad Nicholson NWOHIO)
- MasterSuite royalty sync ran successfully (1,791 rows)
- L10 page redirects non-admin users
- Journey Brief agent appears in Settings with Run button
- All 138 tests passing, 0 TypeScript errors across all commits
- Vercel deploys all successful

## What Is Broken or Incomplete

- **Journey Brief narrative quality** — Claude sometimes misinterprets data (e.g. call coaching suggestions leaking in, property lead counts vs purchased counts). Fixed the known issues but needs more real-world testing across different journey types — High
- **Revenue panel for sales pipeline prospects** — shows "No revenue data yet" for prospects not yet awarded a territory, which is correct but the panel takes up space with no value for these contacts — Medium
- **Network median calculation** — queries all territory_owners + their properties + royalties on every revenue page load. Could be slow with more data. Should be cached/precomputed — Low
- **Franchise fee not populated** — many contacts have null franchise_fee. Needs manual entry or backfill — Low

## Decisions Made

- Journey Brief uses Claude Haiku for narrative (not deterministic) — Corey approved
- Revenue goal is $500k over 10 years, pace measured on royalty only ($460k) excluding franchise fee — Corey approved
- Royalty computed from per-property ms_property_royalty rows (paid/due), not MasterSuite pre-calculated aggregates — Corey approved
- Entity and Deal panels removed from journey page, replaced with Brief + Revenue — Corey approved
- Journey Brief agent is event-driven + cached, not regenerated on every page load — Corey approved

## Files Created

- `supabase/migrations/20260526100000_create_journey_briefs.sql`
- `lib/briefs/journey-brief-agent.ts`
- `lib/briefs/mark-journey-brief-stale.ts`
- `app/api/journeys/[journeyId]/brief/route.ts`
- `app/api/journeys/[journeyId]/revenue/route.ts`
- `components/contact/JourneyBriefCard.tsx`
- `components/contact/RevenueCard.tsx`

## Files Modified

- `app/(auth)/l10/page.tsx` — admin guard
- `app/api/calls/[callId]/grade-rubric/route.ts` — stale trigger
- `app/api/contacts/[contactId]/pipelines/[pipelineId]/advance/route.ts` — stale trigger
- `app/api/contacts/[contactId]/pipelines/[pipelineId]/revert/route.ts` — stale trigger
- `app/api/cron/generate-briefs/route.ts` — journey briefs section added
- `app/api/settings/agents/route.ts` — journey-brief agent definition
- `components/leads/LeadDetailView.tsx` — swapped Entity/Deal for Brief/Revenue
- `components/settings/AgentsPanel.tsx` — journey-brief agent definition
- `lib/mastersuite/sync-properties.ts` — added ms_property_royalty sync + stale trigger
- `lib/rag/embedder.ts` — added "journey" entity type
- `package.json` — added/removed recharts (ended up not using it)

## Files Deleted

- `app/api/journeys/[journeyId]/debug-revenue/route.ts` — temporary debug endpoint

## Open Issues Carried Forward

- Journey Brief narrative needs real-world validation across more journey types (sales prospects, new franchisees, veteran franchisees) — High
- Revenue panel empty state for sales prospects needs design decision (hide panel? show different content?) — Medium
- Network median should be cached/precomputed rather than calculated per request — Low
- TerritoryDealCards.tsx is now unused (was imported as Entity/Deal panels) — can be deleted — Low

## Exact Next Step

Test the Journey Brief and Revenue panels across 5-10 different journeys (mix of sales prospects, new franchisees, veterans) and note any data inaccuracies or UI issues to iterate on.

## Copy This To Start Next Session In Claude.ai

---

Read this file then tell me: current status, last session summary, open issues, what we build today.
GitHub: https://github.com/c7lavinder/nah-franchise-os-sandbox/blob/main/SESSION_START.md
Then: Test the Journey Brief and Revenue panels across 5-10 different journeys (mix of sales prospects, new franchisees, veterans) and note any data inaccuracies or UI issues to iterate on.

---
