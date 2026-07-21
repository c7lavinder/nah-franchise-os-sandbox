# Supabase → MasterSuite Cutover — Port Plan

> Drafted 2026-07-21 from a full code inventory. Turns the standing decision
> ("Supabase is transition-only; the end state is MasterSuite's MySQL DB" —
> [[decision_supabase_transition_only]]) into a sequenced plan. When executed,
> this plan **supersedes ADR-0002 (Supabase as app-state source of truth) and
> ADR-0009 (Supabase as source of schema)** — a new ADR should be filed at the
> first domain flip.
>
> Companion docs: `mastersuite-data-audit.md` (schema mapping, 37 renames),
> `mastersuite-sync-boundaries.md` (every sync, inbound + outbound),
> `mastersuite-schema-map.md` (MySQL prod: 153 tables), `dayhub-panel-registry-phase1.md`
>
> - `property-page-panel-registry-phase1b.md` (the consolidation that makes
>   this cutover possible).

---

## 1. The one-sentence strategy

**The cutover is completed BY the panel consolidation, domain by domain — not
by re-pointing the Next.js app at MySQL.** Each FranDev surface that goes
native inside MasterSuite (as registry panels/pages reading MySQL directly)
retires its Supabase tables; the sandbox app shrinks until Supabase can be
archived. We never do a big-bang database swap under the existing app.

Why not re-point the app: 238 of its 293 API routes touch Supabase through an
**untyped** client (typing debt: ~168 errors across 64 files if generics are
enabled), so a same-app engine swap would be the riskiest possible path. The
consolidation already rebuilds each surface natively with Dapper + typed
entities — that rebuild IS the port.

## 2. Current state (inventoried 2026-07-21)

- **~100 canonical FranDev tables** in Supabase (the `SUPABASE_TABLES` array in
  `lib/mastersuite/push-frandev.ts` is the authoritative list; `.from()` grep
  shows ~140 names incl. legacy noise). 159 migration files.
- **Inbound syncs (MySQL → Supabase, 6 crons, 15–30 min):** territories,
  properties (`ms_*` mirrors), prospects/PTO/franchise-requests
  (contacts/journeys), EOS, lead lists. All `ms_*` data is **read-only** in the
  app.
- **Outbound push (Supabase → MySQL dev, nightly 6:30am Central):**
  `push-frandev.ts` mirrors all 100 tables into 114 `frandev_*` tables
  (73,960 rows / 0 errors on first full load).
- **The bidirectional seam:** `apply-native-writes.ts` replays MasterSuite's
  `frandev_native_write` journal (Scout approval-card writes made natively)
  back into Supabase every 15 min, firing side effects there (GHL stage sync,
  task creation). This exists **only because Supabase is currently master** —
  it inverts and then disappears as domains flip.
- **MySQL-direct code is contained:** 4 modules, all in `lib/mastersuite/`
  (read client, dev write client, push, native-write replay).

## 3. Flip order (per-domain, easiest → hardest)

Each domain flips with the same recipe: **(a)** its native MasterSuite surface
ships (consolidation wave) reading/writing MySQL as master → **(b)** the
domain's tables drop out of the outbound push → **(c)** its inbound sync (if
any) reverses or retires → **(d)** its Supabase tables go read-only, then get
archived. A domain is "done" when nothing reads its Supabase tables.

| #   | Domain                                     | Supabase tables (main)                                                                   | Why this slot                                                                                                                                                                                                                                                                                             |
| --- | ------------------------------------------ | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **`ms_*` mirrors + territories perf data** | `ms_properties` + 12 others, `territory_market_data`                                     | Already MySQL-sourced and read-only in the app — native pages read the real tables directly; retiring these deletes 5 of 6 inbound syncs. Zero data migration.                                                                                                                                            |
| 2   | **EOS**                                    | `eos_territory_*`, `eos_contact_*` (12 tables)                                           | Inbound-synced from MySQL already; MasterSuite has native EOS modules. Mostly a read-path retirement.                                                                                                                                                                                                     |
| 3   | **Workflows**                              | `workflows` + 7 others                                                                   | ALL workflows are paused in DRAFT pending content finalization ([[project_workflow_finalization]]) — flipping a paused system is the cheapest write-domain rehearsal. Long-term the Workflows page is DROPPED in the consolidation (agent pattern replaces it), so this may become "archive, don't port." |
| 4   | **Calls / transcripts / grading**          | `calls` + 16 others                                                                      | Self-contained pipeline (Read.ai webhook → transcript-processor → grades). MasterSuite already has gunner call/grading tables — port = map into them per `mastersuite-data-audit.md`, re-point the webhook.                                                                                               |
| 5   | **Contacts + Journeys/Pipeline**           | `contacts` (244 call sites), `journey_pipeline_state` (159), `journeys` (112) + ~20 more | The core CRM — biggest and last of the data domains. Waits for the consolidated Contacts page + Journey detail (panel-registry phases). The 53 custom profile fields and GHL id linkage ride along.                                                                                                       |
| 6   | **Scout + intelligence/RAG**               | `scout_*`, `knowledge_documents`, `embeddings`, rubrics                                  | Converges with Chiron ("AI dock → one" in the consolidation map). `embeddings` is pgvector — MySQL has no equivalent; Chiron KB (K1/K2, merged 2026-07-21) is the likely landing zone. Needs its own decision.                                                                                            |
| 7   | **Platform residue**                       | `users`, `sessions`, `integration_logs`, `cron_job_log`, `app_settings`, `bug_reports`   | Dies with the sandbox app itself — MasterSuite auth/permissions replace `users`/`sessions`; logs archive.                                                                                                                                                                                                 |

## 4. Bridge mechanics during the transition

- **Freeze rule (start now):** no new Supabase tables. New features build
  native-first; anything that must land app-side gets a `frandev_*` mirror in
  the same PR so the push stays complete.
- **Native-write journal inverts per domain:** once MySQL is master for a
  domain, the app stops writing it in Supabase; if the app still _displays_ it,
  it reads through a sync the other way (or, better, the surface is already
  native and there is nothing to display app-side). Side effects currently
  fired on replay (GHL stage sync via `syncStageToGHL()`, task creation) must
  be **re-homed into MasterSuite services** at flip time — this is the single
  most delicate piece of the whole cutover.
- **Watermarks + parity:** keep `sync_watermarks` + a per-domain parity check
  (the `phase10-data-audit` pattern) running until a domain's Supabase side is
  archived. Flip only on a green parity report.
- **ID mapping:** Supabase uuids vs MySQL ints — the push already maintains the
  mapping (`frandev_*` PascalCase schema); each domain flip must keep GHL
  contact ids as the stable cross-system key (and never compare GHL ids
  against uuid columns — [[bug_uuid_typecast]]).

## 5. Prod vs dev

Everything outbound today targets **dev** (`db-development.mastersuiteapp.com`;
the write client hard-refuses hosts matching `/prod/i`). The cutover reaches
prod only through Ben's normal MasterSuite release train — migrations + native
pages merge and deploy like any other MasterSuite work. No direct
sandbox-app → prod-MySQL writes, ever.

## 6. Risks

1. **Side-effect re-homing** (GHL sync, task creation) — see §4.
2. **Untyped Supabase client** — schema drift during the long transition is
   invisible at compile time app-side. Mitigate with the freeze rule + parity
   checks rather than paying down the 168-error typing debt on a dying app.
3. **37 renames / 164+ files** (`ms_slug`→`TerritorySlug` etc.) from the data
   audit — applies to whichever domains still map through the push.
4. **pgvector embeddings** have no MySQL home — Scout/RAG domain needs a
   destination decision (Chiron KB retrieval vs external vector store).
5. **~90 maintenance scripts** in `scripts/` assume Supabase — accept breakage;
   they retire with the app (don't port them).

## 7. Open decisions (Corey / Ben)

1. Confirm the strategy in §1 (consolidation-completes-cutover; no app
   re-point) → file the superseding ADR.
2. Domain 3 call: port workflows or archive them (agent pattern replaces the
   page)?
3. Scout/RAG landing zone: fold into Chiron KB, or keep a separate vector
   store?
4. When to stop the 6 inbound syncs for domain 1 (they're pure cost once
   native pages read MySQL) — needs nothing but a go-ahead.
