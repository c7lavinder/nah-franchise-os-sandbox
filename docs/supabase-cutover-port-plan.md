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

| #   | Domain                                     | Supabase tables (main)                                                                   | Why this slot                                                                                                                                                                                                                                                                                                                                                                  |
| --- | ------------------------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **`ms_*` mirrors + territories perf data** | `ms_properties` + 12 others, `territory_market_data`                                     | Already MySQL-sourced and read-only in the app — native pages read the real tables directly; retiring these deletes 5 of 6 inbound syncs. Zero data migration.                                                                                                                                                                                                                 |
| 2   | **EOS**                                    | `eos_territory_*`, `eos_contact_*` (12 tables)                                           | Inbound-synced from MySQL already; MasterSuite has native EOS modules. Mostly a read-path retirement.                                                                                                                                                                                                                                                                          |
| 3   | **Workflows**                              | `workflows` + 7 others                                                                   | ALL workflows are paused in DRAFT pending content finalization ([[project_workflow_finalization]]) — flipping a paused system is the cheapest write-domain rehearsal. Long-term the Workflows page is DROPPED in the consolidation (agent pattern replaces it), so this may become "archive, don't port."                                                                      |
| 4   | **Calls / transcripts / grading**          | `calls` + 16 others                                                                      | Self-contained pipeline (Read.ai webhook → transcript-processor → grades). ~~Map into gunner tables~~ **CORRECTED 2026-08-09**: `gunner_call*` is the acquisitions domain, NOT reusable. The 16 `frandev_call*` mirrors already exist AND the native read surface is already built (Calls.cshtml + Call.cshtml + DayHub panel). The real port is the WRITE side only — see §8. |
| 5   | **Contacts + Journeys/Pipeline**           | `contacts` (244 call sites), `journey_pipeline_state` (159), `journeys` (112) + ~20 more | The core CRM — biggest and last of the data domains. Waits for the consolidated Contacts page + Journey detail (panel-registry phases). The 53 custom profile fields and GHL id linkage ride along.                                                                                                                                                                            |
| 6   | **Scout + intelligence/RAG**               | `scout_*`, `knowledge_documents`, `embeddings`, rubrics                                  | Converges with Chiron ("AI dock → one" in the consolidation map). `embeddings` is pgvector — MySQL has no equivalent; Chiron KB (K1/K2, merged 2026-07-21) is the likely landing zone. Needs its own decision.                                                                                                                                                                 |
| 7   | **Platform residue**                       | `users`, `sessions`, `integration_logs`, `cron_job_log`, `app_settings`, `bug_reports`   | Dies with the sandbox app itself — MasterSuite auth/permissions replace `users`/`sessions`; logs archive.                                                                                                                                                                                                                                                                      |

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

## 7. Open decisions (Corey / Ben) — ALL RESOLVED

1. ~~Confirm the strategy in §1~~ **RESOLVED** — ADR-0014 filed 2026-08-09 at
   the first retirement; supersession of ADR-0002/0009 has begun.
2. ~~Domain 3 call~~ **RESOLVED 2026-08-09 (Corey): archive, don't port.**
   Workflows follow the Gunner pattern — the agent generates them; the
   Workflows page is not rebuilt natively.
3. ~~Scout/RAG landing zone~~ **RESOLVED 2026-08-09 (Corey): fold into the
   Chiron knowledge base.** Note: this content is mostly _internal team
   knowledge_, not candidate-facing — treat it as Chiron KB material, not a
   separate vector store.
4. ~~When to stop the 6 inbound syncs~~ **RESOLVED** — go-ahead given.
   `sync-ms-properties` + `sync-ms-lead-list` retired 2026-08-09 (ADR-0014);
   territories + EOS retire as soon as the native reads re-point to the MySQL
   originals (in progress).
5. ~~The 52 app-created EOS rows~~ (11 rocks / 21 todos / 20 issues that drop
   off the native tab when MasterSuite PR #718 deploys) **RESOLVED 2026-08-09
   (Corey): discard.** All 52 are the 2026-04-14 Q2 agent-extraction batch —
   stale, undone, heavy near-duplicates. They are NOT migrated into the
   canonical `Eos_*` tables; they remain archived in Supabase.

**Framing confirmed by Corey 2026-08-09:** MasterSuite already owns the
property / territory / EOS data — native pages read and write those fields
directly, like every other Gunner page. The only data that genuinely lives
app-side and must be _ported_ (not just re-pointed) is **comms/call data and
pipeline stages** (domains 4 + 5).

## 8. Domain 4 scoping (2026-08-09, code-verified)

**Already done, no work:** all 16 `frandev_call*` mirror tables (migration
`2026-06-22 2324 - FranDev calls tables.sql`); the entire native READ surface
(`Pages/Frandev/Calls.cshtml` list, `Call.cshtml` detail with all tabs,
`Gunner/CallsV2.cshtml`, DayHub `_FrandevGrowCalls` panel); one native write
(`set_call_type` drag-retype, round-trips via the journal); the nightly push.

**Column parity verified 2026-08-09** (dry-run push, 21 tables, 23,366 rows,
0 errors): mirrors match Supabase. Only gap: `knowledge_documents.updated_by`
has no mapped mirror column (`UpdatedByUserId` exists but the mapper doesn't
connect them) — cosmetic, fix in passing. `UpdatedAt` mirror columns are
DB-maintained, expected unmapped.

**New consumer since scoping (2026-08-09, MS PR #716):** MasterSuite's
coaching module now reads `frandev_read_ai_session` hourly (coaching-typed,
linked-and-complete sessions → `coaching_module_session_record` via
`ICoachingCallFeedSource`). Domain 4 is no longer just FranDev's pipeline —
the coaching feed dies too if this table stops being fed after cutover.

**Must be built new in .NET (the actual port):**

1. ✅ **BUILT 2026-08-09 (s103, MS PR #722)** — Read.ai webhook receiver:
   HMAC verify + `frandev_read_ai_session` upsert/dedupe + logging, shadow
   mode (`POST /api/hooks/read-ai`; dev-only replay harness at
   `/api/hooks/read-ai-replay`). Validated: all 421 archived `raw_payload`
   rows replay 421 matched / 0 mismatched / 0 parse failures against the
   mirror; `writes=1` re-delivery came back 421 deduped / 0 errors; E2E
   signature paths verified both ways on a running app.
   **Signature policy DECIDED (s103): accept-and-log by default, enforcement
   is a config flip.** Evidence: `read_ai_webhook_keys` has ZERO rows in
   Supabase and no `READ_AI_WEBHOOK_SIGNING_KEY_*` env exists anywhere —
   today's live traffic is 100% unverifiable, so reject-by-default would
   drop every call at cutover. Every delivery's log row records
   `sig=valid|invalid|missing`; SystemConfig
   `Frandev_ReadAi_RequireSignature='on'` turns rejection on. ⚠ Before the
   step-6 flip: either provision real signing keys (rows in
   `frandev_read_ai_webhook_key`, then flip the flag on) or accept unsigned
   explicitly in the cutover note.
2. ✅ **BUILT 2026-08-09 (s104, MS PR #729)** — classifier + the 3 processors
   (prospect / coaching+onboarding / group+internal) writing call, transcript,
   participants, junctions. **Flag-gated, default OFF**: SystemConfig
   `Frandev_ReadAi_NativeProcessing='on'` is the switch; off, the receiver
   stays the step-1 shadow byte-for-byte. Flips at step 6, not before.
   Validated: **transcript parity proven mechanically** — the current TS
   formatter and the C# port are byte-identical on all 421 archived payloads
   (dev-only `read-ai-format-transcript` probe, same team set both sides).
   Classify replay (dev-only `read-ai-classify-replay`, read-only): 421
   scanned / 0 parse failures, durations 415/415, participants 355/357,
   categories 358/421 — all 63 category mismatches are honest drift (the
   replay resolves against TODAY's mirror; journeys advanced/closed and the
   team roster changed since classification day), deterministic across two
   runs. Stored-title (247) and stored-slug (123) diffs are downstream
   features, not the port: the post-call agent re-titles calls 3-5 words
   (step 4) and manual drag-retypes rewrite slugs (`cohort_call` appears — a
   slug the classifier never emits). Flag-on E2E on a running app: synthetic
   prospect delivery → session complete, call + participants + junctions +
   transcript written, contact created (`readai_` placeholder, NeedsReview)
   and reconciled onto its participant row; cleaned up, flag off. The probe
   caught a real bug pre-review (`FULLTEXT` is a MariaDB reserved word).
   One migration: `frandev_contact.IsConvertedFranchisee` — the only
   classifier input the mirror lacked; the schema-driven push auto-maps it
   (no sandbox change; dev backfilled 71 contacts from Supabase in-session).
   ⚠ Step-6 note: the flag flip must also decide what sweeps the backlog of
   `'pending'` sessions accumulated in shadow — the live path only processes
   new deliveries.
3. ✅ **BUILT 2026-08-09 (s105, MS PR #734)** — transcript-job worker +
   native intake. `frandev_transcript_job` gets its first consumer (Whisper
   whisper-1, 25MB cap, one blind retry, attempts-on-pickup — the TS worker's
   exact shape) **plus a stale-'processing' reaper** the TS version lacked.
   Native uploads stop proxying to Vercel when the flag is on: recordings →
   S3 + job queue; transcripts inline with the extract-speakers/resolve/
   reclassify chain. Three Hangfire jobs registered DARK: `frandev-transcript-
jobs` (\*/5), `frandev-readai-sweep` (the flip-day backlog drain + ongoing
   backstop, 3-59/10), `frandev-analyze-calls` (replaces the TS processors'
   step-8/9 fire-and-forget generate calls, 6-59/10). Validated E2E on a
   running app: reaper requeued a 2h-stale claim; 404 audio failed after
   exactly 3 attempts; re-pended session re-processed idempotently
   (`skipped_existing`).
4. ✅ **BUILT 2026-08-09 (s105, MS PR #734)** — post-call agent + grader,
   **PARITY GATE PASSED**. Four live LLM sections ported prompt-byte-for-byte
   (summary+title+classification / extraction / KB intelligence / rubric
   grade) on the pinned Haiku model, no temperature, allSettled orchestration,
   idempotency guard, budget gate, `frandev_llm_call_log` metering (first
   native writer; its JSON_VALID CHECK requires serialized JSON — E2E catch).
   NOT ported, deliberately: generic coaching (dead in TS), next-steps (TS ran
   the LLM then discarded the output), review packages (written, read by
   nothing), commitments writer (dead; reads stay on the pushed mirror).
   **Tier-1 parity (deterministic):** grading prompts for the 15 newest
   graded calls, C# (`read-ai-grade-parity` dev probe, sha256) vs TS
   (`scripts/dump-grade-prompts.ts`, verbatim grader.ts copy): 12/15
   byte-identical; all 3 mismatches are mirror-vs-Supabase data drift (journey
   stages/durations that moved since the nightly push — field-verified), the
   same honest-drift class as the s104 classify replay. **Tier-2 parity
   (statistical):** live re-grade of 8 held-out graded calls, writeGrade=false:
   8/8 letter-grade agreement, avg |score Δ| 1.88, criteria 6/6 on every call.
   No probe wrote a grade row.
5. ✅ **BUILT 2026-08-09 (s105, MS PR #734)** — call-types/rubrics settings
   INSIDE the existing `/Gunner/Settings?tab=calls` page, branched on the
   workspace picker: FranDev lens renders the `frandev_call_type`/`rubric`/
   `rubric_criterion` editor (those tables' first C# writers), Gunner lens
   keeps its calibration-locked set untouched — same page, same rail, no
   duplicated machinery. **Ownership rule:** rubric writes REFUSE while the
   flag is off (the nightly push would clobber them); the tab renders
   read-only with a banner, and unlocks automatically at the step-6 flip.
   `/Gunner/Settings` added to `frandevSharedPages`. E2E via minted JWT: both
   lenses render, add-criterion round-trips.
6. Cutover — **now a checklist, no code left to write** (see below).

**Build sequence (session-sized):** (1) shadow-mode webhook receiver,
ingest-only, replay archived `raw_payload` rows and diff — (2) classifier +
processors behind a flag, validated by replaying archived payloads against
known Supabase output — (3) transcript worker — (4) grader, parity-gated —
(5) settings UI + fan-out (extractions, action items, review packages,
commitments) — (6) flip the webhook, retire crons.

## 9. Domain 4 step 6 — the cutover runbook (written s105)

Preconditions — **1 was found ALREADY SATISFIED by a prod probe on
2026-08-09 (s105)**:

1. ✅ **Prod mirror populated.** The old "prod has 0 rows, blocked on
   Ben's GRANT" picture is stale — the nightly push feeds prod now.
   Measured 2026-08-09: `frandev_call` 494, `frandev_call_transcript`
   343, `frandev_call_type` 14, `frandev_rubric` 14 + 66 criteria,
   `frandev_knowledge_document` 58, `frandev_contact` 3,195 (newest
   UpdatedAt same-day), `frandev_read_ai_session` 450 with **0 pending**.
   (The still-open Ben GRANT is only the notes/chat-table one — Low,
   unrelated to this flip.)
2. **MS PR #734 deployed** (merged 2026-08-09 17:58Z) with all three
   Hangfire jobs visible in the dashboard (they no-op while the flag is
   off).
3. **Signature decision executed** (policy DECIDED s103: accept-and-log).
   Either provision real signing keys (rows in
   `frandev_read_ai_webhook_key`, then SystemConfig
   `Frandev_ReadAi_RequireSignature='on'`) or record "accept unsigned" in
   the cutover note. Today zero keys exist anywhere, so reject-by-default
   would drop every call.

⚠ **Order matters more than the runbook first suggested**: the flag and
the webhook URL flip on the same day, together. Flag-on with the URL
still at Vercel = native uploads diverge from Supabase (the app is still
master) and rubric edits unlock under a push that clobbers them nightly.
URL-at-MS with the flag off = deliveries pile up 'pending' (safe — the
sweep drains them the moment the flag turns on).

Flip day, in order:

1. **Freeze check** (read-only): prod
   `SELECT ProcessingStatus, COUNT(*) FROM frandev_read_ai_session GROUP BY 1;`
   — note the `pending` count (the shadow backlog the sweep will drain).
2. **Flip the flag**: `REPLACE INTO SystemConfig (Id, Value) VALUES
('Frandev_ReadAi_NativeProcessing', 'on');` on prod. Rubric editing in
   Settings unlocks at the same moment (same flag).
3. **Re-point the Read.ai webhook URL** (Read.ai dashboard) from
   `https://nah-franchise-os-sandbox.vercel.app/api/webhooks/read-ai` to
   `https://mastersuiteapp.com/api/hooks/read-ai`. The GET probe on that
   URL answers `{status:"ok"}`.
4. **Watch the sweep drain the backlog** — `frandev-readai-sweep` runs
   every 10 min, 50 sessions/pass, idempotent (`skipped_existing` for
   sessions that already have calls). Verify:
   `SELECT COUNT(*) FROM frandev_read_ai_session WHERE ProcessingStatus='pending';`
   → 0, and `frandev_integration_log` rows with `EventType='backlog_sweep'`.
5. **Verify one live delivery end-to-end**: next real call → session row →
   call + participants + junctions + transcript → (≤10 min later)
   AiSummary/title/grade/extractions/KB items + `frandev_llm_call_log` rows.
6. **Retire the sandbox call crons** (vercel.json): `process-transcripts`,
   `calls/reconcile`, `rubric-review`. KEEP `coaching-brief` +
   `pre-call-briefs` (brief agents, die with domains 5/6). KEEP
   `sync-ms-territories` (domain-5 exit).
7. **Retire the call tables from the push** (`lib/mastersuite/push-frandev.ts`
   `SUPABASE_TABLES`): remove `calls`, `call_transcripts`, `call_grades`,
   `call_participants`, `call_territories`, `call_journeys`,
   `call_action_items`, `call_action_feedback`, `call_data_extractions`,
   `call_review_packages`, `call_types`, `call_coaching`, `call_logs`,
   `transcript_jobs`, `rubrics`, `rubric_criteria`,
   `rubric_review_suggestions` + the `frandev_rubric_criterion` entry in
   `TABLE_OVERRIDES`. **KEEP pushing**: `read_ai_sessions`? NO — the native
   receiver now writes `frandev_read_ai_session` directly (and the webhook
   no longer feeds Supabase), retire it too; `read_ai_webhook_keys` retire
   (keys, if any, are provisioned MS-side now); **KEEP** `commitments`
   (briefs/Scout read the mirror; writer long dead), **KEEP**
   `knowledge_documents` until domain 6 (grader + KB merge read it — the KB
   merge WRITES it natively now, so after the flip the nightly push will
   clobber native KB edits until domain 6 re-points the KB: acceptable
   during the window, or retire it at flip and accept Supabase KB freeze —
   decide in the flip session; the grader's rubric docs are stable either
   way).
8. **Drop `call_coaching`** (Supabase migration; zero readers — confirmed
   in-code comment at `app/api/calls/[callId]/detail/route.ts:441`). KEEP
   `calls.coaching_data` (columns + historical rows; UI reads them).
9. **Roll-back**: set the flag off + re-point the webhook URL back. The
   receiver keeps ingesting sessions either way (shadow upsert), so no
   deliveries are lost in either direction; Supabase misses sessions
   delivered while the URL pointed at MS — replay them from
   `frandev_read_ai_session.RawPayload` if the rollback outlasts a day.

## 10. Domain 5 scoping (2026-08-09, code-verified — 3 full inventories)

**The shape of it:** domain 5 is the write-heavy heart, not another
self-contained pipeline. `journey_pipeline_state` alone has ~40 writers;
20 of the replay's 33 write types are domain-5; every GHL side effect in
the system fires around these tables. The good news: **most of the port
already exists.** The panel consolidation built the native READ surface
nearly complete, and the journal bridge means 19 domain-5 write types are
ALREADY implemented natively in C# (mirror-first + journal + replay). The
flip is less "build a write layer" and more "make the existing native
write layer the only one, and re-home the side effects."

### Already done, no work

- **Mirrors:** every domain-5 table has a `frandev_*` mirror except the
  deliberately-dropped `contact_pipeline_state` (remove from
  `SUPABASE_TABLES` — it skips as `no_supabase_source` every night) and
  the GHL mapping tables (see gap 1 below). `frandev_note` +
  `frandev_journey_chat` are already native-authority.
- **Native reads:** journey/contact/territory record pages (\_RecordShell,
  PR #653/#655/#702), pipeline kanban + unified pipeline page, DayHub
  FranDev lens (21 panels), Contacts directory, Tasks, Messages/Inbox,
  L10, Marketing. Only 9 contact satellites have no native reader
  (profile_datum, related_person, team_member, score, journal,
  zorakle_datum, activity_message, brief, pipeline_app_settings).
- **Native writes (journal-first):** advance/revert/drop/close/board_move,
  create/update/merge/delete_contact, rename/archive/delete_journey,
  update_profile_field, create/toggle_task, sub_task_log, notes ×3 — plus
  Chiron approval-card writes. Emitted set == replay's handled set, no
  drift.
- **Lead sources already in MySQL:** `PathToOwnershipEntries` +
  `FormSubmissions` — the inbound prospect syncs exist only to carry them
  into Supabase.

### The gaps (what must actually be built)

1. **GHL side-effect re-homing** — confirmed as the delicate piece, but
   smaller than first scoped. **Corrected by Corey 2026-08-09: MasterSuite
   already has GHL set up, and FranDev lives on a GHL SUB-ACCOUNT — three
   sub-accounts are already provisioned. The connection work is: connect
   the FranDev sub-account through the marketplace-app login flow (OAuth),
   not build a client or token plumbing from scratch.** Gunner's
   `GhlClient` (v2, method-for-method port of `lib/ghl/client.ts`) exists;
   `MasterSuite.Modules.Frandev` has ZERO references to it yet. Still
   needed after the sub-account connects: a FranDev entry in the GhlConfig
   surface pointing at that sub-account/location; the stage-sync mapping
   (`PIPELINE_FIELD_MAP` + GHL custom-field ids — `ghl_custom_fields` /
   `pipelines.ghl_field_id` have NO mirror; land them in SystemConfig or a
   small config table; note the ids are per-location, so re-resolve them
   against the FranDev sub-account, don't copy Supabase's); confirm token
   refresh rides the existing MS marketplace-app flow (the app-side
   `refresh-ghl-token` cron then retires instead of being ported); native
   task push, contact upsert/update, touch-fields. ⚠ Behavior asymmetry to
   resolve deliberately: replay fires `syncStageToGHL` on revert_stage and
   board_move but the app's own routes don't; drop never syncs either side.
2. **Native lead intake** replaces `sync-ms-prospects`: form-submit →
   contact + journey + journey*contacts + JPS synchronously (kills the
   30-min latency and the `pto*`/`franchise*req*` placeholder-id hack for
   new leads). Must port the dedupe rules (normalized email/phone,
   deterministic ghl_contact_id), the spam filter, AND the easy-to-miss
   "wire an existing contact that has no active Sales journey" branch.
3. **Onboarding/runway derivation** replaces `sync-ms-territories`' JPS
   half: `onboardingStageSlug` + `runwayTargetForFacts` re-derived
   natively from territory facts. The `runway-pipeline-guardian` is the
   ready-made parity instrument — keep it through the flip window as the
   green-light gate, then delete.
4. **Background agents → Hangfire** (the domain-4 `FrandevAnthropic`
   transport is already there): `research-contacts` (also fired inline on
   contact create), `reengagement-scan`, `coaching-brief`, the
   contact-journal half of `journals`. The journey/contact brief agents
   ride along (event-driven Haiku, `frandev_journey_brief` mirror exists).
5. **Intelligence scoring**: `updateCandidateScore` was deliberately NOT
   ported in domain 4 (PostCallWrites header pins it to domain 5);
   `candidate_intelligence`/`candidate_score_history` writers come along
   here.
6. **Satellite decisions** (port / defer / archive, decide per table):
   contact_emails editor (no direct C# writer yet; GHL is authoritative
   for the multi-email set), related people, team members, activity
   messages (@-mentions + notifications), zorakle webhooks (app-side
   handlers today), journey documents (upload → storage + text extract +
   embeddings — embeddings are domain 6), `contact_scores`,
   `contact_profile_data`. Workflow trigger matching (`stage.advanced`,
   `journey.created`) is moot — domain 3 resolved "archive, don't port"
   and every workflow is DRAFT.
7. **Domain-4 stragglers to sweep in** (found by the cron audit): `pre-call-briefs` (MS #733 built a native pre-call cue — likely
   supersedes it; confirm and retire) and `sync-ghl-calendar` (writes
   calls tables via GHL appointment polling and resolves against
   journeys/JPS — port the poll into MS or fold into native calendar).
   Both break at the domain-5 flip if left as-is.

### Flip mechanics (domain-4 recipe, adjusted)

- **The replay inverts per-type, not all at once.** The
  `Frandev_ReadAi_NativeProcessing` pattern: a
  `Frandev_ContactsPipeline_NativeWrites` flag decides, per side effect,
  which side fires GHL (never both — double-fire is the failure mode to
  design against).
- **The push edit is the highest-risk single change**: ~25 domain-5
  tables leave `SUPABASE_TABLES`; any one left behind becomes a blind
  nightly upsert of stale Supabase truth over live native rows.
- **Crons retiring at this flip**: `sync-ms-territories`,
  `sync-ms-prospects`, `runway-pipeline-guardian` (after its parity-gate
  duty), plus the 4 PORTed agents' app-side versions. The replay cron
  (`apply-mastersuite-writes`) SHRINKS but survives — 13 non-domain-5
  types (workflows ×3, EOS ×2, territory ×4, stakeholders ×2, sms/scout
  ×2) still bridge until domains 3/6/7 close out.
- **Parity gates before the flip**: contacts/journeys/JPS row+field parity
  (phase10-audit pattern), guardian green, GHL side-effect dry-run diff
  (log-what-would-fire vs what the app fires).

### Known cross-domain seams (already live today)

- The native post-call agent (domain 4) writes domain-5 tables:
  profile-field auto-saves journal `update_profile_field` with
  `source: 'ai-auto'` since MS #740 (which also fixed the NOT NULL
  `SourceHistory` insert failure found on prod). Territory market-data and
  objection-registry auto-saves are still mirror-only — same clobber class,
  lower stakes (`territory_market_data` is domain 1, `objection_registry`
  domain 6); revisit if they matter before their domains flip.
- Read.ai participant contact creation went native at the domain-4 flip
  (`readai_` placeholders, NeedsReview) — those contacts exist mirror-only
  until domain 5 makes native creation authoritative.

### Bonus findings from the inventory (app-side, small)

- ~~`…/pipelines/[pipelineId]/drop/route.ts` has NO `requireAuth`~~ —
  **FIXED in the scoping session** (every sibling route has it).
- `batch-actions/route.ts:193` issues a malformed `.eq("journey_id",
<query builder>)` before redoing it correctly at :203 — dead first call,
  harmless, retire-with-app.
- `sync-pto-prospects.ts` + `sync-franchise-requests.ts` have zero
  callers — dead code, retire-with-app.
- `zorakle_assessments` (zero refs), `franchise_owners` + `zorakle_profiles`
  (read-only): free flips.

### Build sequence (session-sized, in order)

1. ✅ **BUILT 2026-08-09 (s106, MS PR #741)** — GHL foundation:
   `FrandevGhl.cs` (sub-account credential pair in SystemConfig:
   `Frandev_GhlLocationId` / `Frandev_GhlPrivateToken`, reusing Gunner's
   GhlClient via ForLiteral; PIT deliberately, NOT the sandbox's OAuth
   chain — refresh-token rotation would fork it), `Frandev_GhlStageFieldMap`
   JSON (slug → this location's field id), and read-only smoke
   `GET /api/hooks/frandev-ghl-smoke` (connection state + the location's
   custom fields, so filling the map is copy-paste). Awaits Corey filling
   the two credential rows after connecting the FranDev sub-account.
2. ✅ **BUILT 2026-08-09 (s106, MS PR #741)** — native lead intake
   (`FrandevService.LeadIntake.cs`), sync-ms-prospects ported 1:1 against
   the mirror: deterministic `pto_`/`franchise_req_` ids (NOT EXISTS,
   cursorless), spam rules verbatim (test-pinned), wire-existing branch,
   NO GHL contact (placeholder discipline), journals `intake_contact` /
   `wire_sales_journey` (replay handlers shipped sandbox-side, 698e8a2).
   Hangfire `frandev-lead-intake` dark behind `Frandev_LeadIntake_Native`.
   E2E on dev: scanned 24 / created 12 / wired 1 / 0 errors; extras on
   columns; rows cleaned. ⚠ Flip pairing: flag on + retire
   `sync-ms-prospects` in the SAME window (two importers = dupes).
3. ✅ **BUILT 2026-08-09 (s106, MS PR #741)** — GHL stage write-through
   native behind `Frandev_Ghl_NativeStageSync`
   (`FrandevService.GhlStageSync.cs`): advance/revert/board-move/close
   decide ownership BEFORE the journal write, stamp `ghl_synced` into the
   payload, fire GHL AFTER commit; the replay skips `syncStageToGHL`
   exactly when `ghl_synced=true` (one side fires, never both; unmarked
   pre-flag rows unchanged). Task push / contact upsert / touch-fields
   re-homing rides the same pattern — build at flip-window when the
   sub-account is connected.
4. ✅ **BUILT 2026-08-09 (s106, MS PR #747)** — the four agents +
   candidate scoring, dark behind `Frandev_Agents_Native`, LLM spend on
   the shared FranDev metering table + daily budget: contact journals
   (nightly, prompt byte-for-byte; EmbeddingId NULL — domain 6),
   re-engagement (monthly → `frandev_contact_score`), research (weekly —
   TS whitelist-gated into the EAV profile store, manual-protected;
   E2E caught the ungated registry writing 'location'/'email'), coaching
   briefs (daily, pure SQL → `frandev_notification`).
   `FrandevCandidateScoreRules` pure + 11 pins (funding-path quirk, 5-day
   trainual penalty, object-flags bug); post-call auto-saves now recalc
   updated contacts — the hook #734 left dangling, closed. Settings
   integrations tab (FranDev lens) gained the cutover card: sub-account
   connection + who-runs-what per piece, status-only. E2E on dev flag-on:
   reengagement 2/2, research 1/1, journals/coaching clean zero-runs
   (no same-day activity; zero rep users on dev). Hangfire ×4 dark on the
   app crons' slots.
5. ✅ **BUILT 2026-08-09 (s106, MS PR #741)** — onboarding/runway
   derivation (`FrandevRunwayRules.cs` pure + test-pinned;
   `FrandevService.RunwayDerivation.cs`), re-pointed at the ORIGINAL
   tables. Dry-run = the parity instrument (hook
   `frandev-runway-derivation`); apply dark behind
   `Frandev_RunwayDerivation_Native`, Hangfire twice hourly. Parity on
   dev: 0 insert / 0 deactivate / 0 errors / 3 updates — all three are
   the APP being stale: since the domain-1 flip froze Supabase's
   `ms_property_*` copies, sync-ms-territories has derived runway from
   frozen evidence (CHARSC trained 07-26 still filed "training"; GREENB
   at 3 purchases still "inventory-building"; LAFALA's first completion
   unseen). Native reads live tables — equal rules, fresher facts.
6. ✅ **DECIDED 2026-08-09 (s106)** — satellites, one line each:
   `contact_scores`/`contact_journals`/`notifications` now have native
   writers (step 4). `contact_profile_data` freezes at flip (research
   writes the EAV store instead; nothing reads the flat mirror).
   `contact_activity_messages` (@-mentions) → ARCHIVE — native journey
   chat (J3) supersedes it. `zorakle_assessments` dead (zero refs).
   Three small FLIP-WINDOW build items, none blocking: a native Zorakle
   webhook receiver (read-ai receiver pattern; without it zorakle data
   freezes at flip), a related-people panel (mirror exists, no native
   surface; rarely edited), native journey-document upload (S3 +
   extract; embeddings ride domain 6).
7. ✅ **FLIPPED 2026-08-09 evening (ADR-0015 + MS migration 255, PR #749)**
   — executed in the safe order: prod runway dry-run gate (0/0/0, 2
   live-evidence corrections) → sandbox deploy retiring 6 crons + the 10
   mirror-only push tables (8189d1e) → migration 255 arming the four
   flags. Verified on prod: all 5 Frandev\_\*Native flags 'on'. The
   REPLAY BRIDGE deliberately stays (Supabase trails native writes until
   domain 6); dual-write-consistent tables stay in the push until the
   sandbox write surfaces retire. **Domain-5 tail (small):** native
   Zorakle receiver, related-people panel, journey-doc upload, remove the
   old app's domain-5 write routes, first-native-lead watch.

Estimate was 6–8 sessions; s106 landed ALL SEVEN build steps in one
day (#740/#741/#746/#747 — the sub-account correction shrank step 1, the
journal machinery was shared, and the agents' prompts ported clean).
**Domain 5 is FLIPPED — MasterSuite's MariaDB is the system of record
for the core CRM.** Remaining: the tail items in step 7 + domain 6.
