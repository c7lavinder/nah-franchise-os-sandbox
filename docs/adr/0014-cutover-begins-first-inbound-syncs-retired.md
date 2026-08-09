# ADR-0014: The cutover begins — first inbound syncs retired

Date: 2026-08-09
Status: Accepted

## Context

`docs/supabase-cutover-port-plan.md` (2026-07-21) set the strategy: the cutover is
completed BY the native rebuild, domain by domain — never by re-pointing the Next.js
app at MySQL. It called for a superseding ADR at the first domain flip. This is that
ADR. As of session 100 the preconditions are real: all 15 walkthrough items are live
on production MasterSuite, the bidirectional pipeline runs against production
(write target flipped, mirror unfrozen at 104,706 rows, 73 journal rows replayed
end-to-end today with zero failures), and native property reads go straight to the
MySQL originals (`PropertyRoyalty` et al.), not the mirrors.

## Decision

1. **This ADR begins the supersession of ADR-0002 (Supabase as app-state source of
   truth) and ADR-0009 (Supabase as source of schema).** They remain in force per
   domain until that domain flips; each flip retires them further. End state:
   MasterSuite MySQL is the only master.

2. **Retired today (removed from `vercel.json` crons):**
   - `sync-ms-properties` (was every 30 min) — wrote `ms_properties`,
     `ms_property_calculations`, `ms_property_inventory`, `ms_property_status_history`,
     `ms_property_royalty`.
   - `sync-ms-lead-list` (was twice hourly) — wrote `ms_lead_list_counts`,
     `ms_lead_list_properties`.

   Test applied: a sync is redundant only when the native surface reads the MySQL
   originals directly AND no app-side write path consumes the mirror. Both pass:
   native FranDev reads `PropertyRoyalty`/property tables directly (zero native reads
   of `frandev_ms_property*` or `frandev_lead_list*`), and every app-side consumer is
   read-only display (metrics, pipeline cards, L10, scorecards, revenue panel), Scout
   property lookups, or the deliberately-held brief generators.

3. **Deliberately KEPT, with exit criteria:**
   - `sync-ms-territories` — `territories` is the reference table journeys/workflows
     FK to, and `territory_market_data` ROUND-TRIPS: MySQL → Supabase → nightly push →
     `frandev_territory_market_data`, which `FrandevService.Territories.cs` reads.
     Retires when native territory reads re-point to the MySQL originals.
   - `sync-ms-eos` — same round-trip through `frandev_eos_territory_scorecard`
     (`FrandevService.TerritoryEos.cs`). Same exit criterion.
   - `sync-ms-prospects` — the live lead inflow (creates contacts/journeys). Retires
     only at the domain-5 (contacts/journeys) flip.
   - `sync-ghl-calendar` — GHL-sourced, not part of the MasterSuite inbound set.

## Consequences

- The Vercel app's property/revenue/lead-list surfaces (revenue panel, scorecards,
  L10 numbers, Scout property answers) now show a **2026-08-09 snapshot** and will
  not refresh. Current numbers live in native MasterSuite, which reads the originals.
- The nightly push keeps mirroring the frozen `ms_*` Supabase rows — harmless, and it
  stops mattering as those tables archive with their domain.
- The round-trip dependency discovered here (native pages reading push-fed mirrors of
  sync-fed tables) is the concrete work item blocking the next two retirements; it
  belongs in MasterSuite, not in this repo.

## Correction (2026-08-09, session 101)

Direct verification against both databases refined the "Deliberately KEPT" analysis:

- **`territory_market_data` does NOT round-trip.** No inbound sync writes it — it is
  app-born (call-extraction agents, Scout, manual edits) and flows one direction:
  Supabase → nightly push → `frandev_territory_market_data` → native read. That
  mirror read is the _correct_ direction and is not an exit criterion for anything.
  `sync-ms-territories` is kept for its real reasons alone: `territories` is the
  reference table app-side journeys/workflows FK to, and the same cron seeds
  `journey_pipeline_state` (onboarding/runway) — it retires at the domain-5 flip,
  not before.
- **The `sync-ms-eos` round-trip is 7 tables wide, not 1**: scorecard, rocks, todos,
  issues, budgets, habits, lead channels all flow MySQL → Supabase → push → mirror →
  native read. MasterSuite PR #718 re-points all 7 reads to the `Eos_*` originals;
  once deployed, `sync-ms-eos` can retire. Parity verified against prod: scorecard
  goals and habits match exactly, every territory. The item lists shrink on purpose:
  the sync only ever upserted, so Supabase/the mirror still carries ~48 rocks,
  ~196 todos, ~167 issues, ~9 budgets **deleted from `Eos_*` long ago**, plus 52
  app-created rows (11 rocks / 21 todos / 20 issues, mostly stale Q2 agent
  extractions). The mirror was showing deleted items; the originals are current.
- `eos_territory_goals` (the Goals tab) is app-born like market data — its mirror
  read also stays, correctly.

## Supersedes / relates

- Begins superseding: ADR-0002, ADR-0009 (per-domain, as flips land)
- Executes: `docs/supabase-cutover-port-plan.md` §3 domain 1 (partial), §7.1, §7.4
