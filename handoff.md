# Session Handoff — 2026-08-09 — Session 106

## Status

Phase: **CUTOVER TRACK — domain 5 (contacts + pipeline) SCOPED AND 4 OF 7
BUILD STEPS SHIPPED DARK in one session. §10 written from three parallel
code inventories; MS PR #741 landed steps 1 (GHL foundation) + 2 (native
lead intake) + 3 (stage write-through handshake) + 5 (runway derivation),
every one flag-gated OFF. Also: MS PR #740 fixed the post-call profile
auto-save BEFORE the first live call hits it (prod probe found 2
db_write_error rows). Domain 4 first-call watch still open — nothing has
ended a meeting since the flip.** / Health: Green / Duration: full session

## What Was Built This Session

**MS PR #740** (merged + deployed) — post-call auto-save fix, found by prod
probe: the INSERT into `frandev_contact_profile_field` omitted NOT-NULL
`SourceHistory` (every NEW field row failed; dev E2E only exercised the
ON-DUPLICATE branch) + saves were mirror-only (unjournaled → invisible to
Supabase, clobbered nightly). Now `'[]'` on insert + journals
`update_profile_field` source `ai-auto`.

**MS PR #741** (branch `s106-d5-build`, CI running at wrap) — domain-5
steps 1+2+3+5, all dark:

- **Step 1 — GHL foundation**: `FrandevGhl.cs` — FranDev sub-account
  credentials in SystemConfig (`Frandev_GhlLocationId` /
  `Frandev_GhlPrivateToken`; PIT via GhlConfig.ForLiteral, NOT the
  sandbox's OAuth chain), `Frandev_GhlStageFieldMap` (slug → per-location
  field id), smoke `GET /api/hooks/frandev-ghl-smoke` (lists the
  location's custom fields — map-filling is copy-paste).
- **Step 2 — native lead intake**: `FrandevService.LeadIntake.cs` —
  sync-ms-prospects 1:1 (PTO + FRANCHISE_REQUEST → contact + journey +
  membership + Sales state; deterministic ids; spam rules test-pinned;
  wire-existing branch; journals `intake_contact`/`wire_sales_journey`).
  Hangfire `frandev-lead-intake` dark (`Frandev_LeadIntake_Native`).
- **Step 3 — stage write-through handshake**:
  `FrandevService.GhlStageSync.cs` — advance/revert/board-move/close
  stamp `ghl_synced` into the journal BEFORE commit, fire GHL AFTER;
  dark (`Frandev_Ghl_NativeStageSync`).
- **Step 5 — runway derivation**: `FrandevRunwayRules.cs` (pure ladder,
  9 pins) + `FrandevService.RunwayDerivation.cs` reading the ORIGINAL
  tables; dry-run hook = parity instrument; apply dark
  (`Frandev_RunwayDerivation_Native`), Hangfire twice hourly.

**Sandbox** (60898a4, 6a06682, 7f6cf81, 698e8a2): replay honors
`ai-auto` profile saves (manual wins); §10 scoping written + GHL
sub-account correction; `requireAuth` added to the pipeline drop route
(was the only unauthenticated pipeline write); `contact_pipeline_state`
out of `SUPABASE_TABLES`; replay handlers `intake_contact` /
`wire_sales_journey` + the `ghl_synced` skip in all four stage handlers.

## What Is Confirmed Working

**Measured, not predicted.**

- **Lead intake E2E on dev** (running app): scanned 24 / created 12 /
  wired 1 / 0 errors — synthetic PTO row with extras on columns
  (PartnerName, PreferredWeeklyHours, LeadSource), journey + Sales state +
  primary membership correct, wire branch attached a Sales journey to an
  existing contact, 13 journal rows carried minted ids. All E2E rows
  cleaned; dev flag reset off.
- **Runway parity on dev**: 0 insert / 0 deactivate / 0 errors /
  3 updates — ALL THREE are the app being stale, not the port being wrong
  (domain-1 flip froze Supabase's `ms_property_*`, so sync-ms-territories
  derives from frozen evidence: CHARSC trained 07-26 still "training";
  GREENB 3 purchases still "inventory-building"; LAFALA first completion
  unseen). Native reads live tables.
- **Profile-fix shapes round-tripped on dev MariaDB**
  (JSON_VALID(SourceHistory)=1; journal insert clean); #740 deployed to
  prod (CI + deploy green).
- MS: build green, **5724 platform tests** (21 intake + 9 runway pins).
  Sandbox: tsc clean, **327 vitest** (84 replay incl. 6 new), next build
  green.

## What Is Broken or Incomplete

- **No live Read.ai delivery observed yet** (newest session 2026-08-07;
  flip was Saturday evening) — first-call verification still next
  session's opening move — **Medium (watch)**
- **MS PR #741 CI running at wrap** — merge when green (all code dark;
  zero behavior until flags) — **action item**
- **Step 4 not built**: the 4 LLM agents (research-contacts,
  reengagement-scan, coaching-brief, contact journals) + intelligence
  scoring — needs domain-4-style prompt-parity discipline, own session(s)
- **Step 6 not decided**: satellites (contact_emails editor, related
  people, activity messages, zorakle webhooks, journey documents)
- Territory market-data + objection-registry auto-saves still mirror-only
  (accepted; domains 1/6) — **Low**
- Domain-4 tail unchanged: call_coaching drop, signature enforcement —
  **Low**

## Decisions Made

- **FranDev GHL = existing SUB-ACCOUNT** (Corey): three sub-accounts
  already provisioned; connect via marketplace-app login. MS-side uses a
  PIT (GhlConfig doctrine: a second OAuth consumer forks the sandbox's
  refresh chain); field ids are per-location — resolve via the smoke
  hook, never copy Supabase's map. — Corey/Claude
- **Ownership handshake over big-bang**: journal payloads carry
  `ghl_synced`; the side that owns the GHL write is decided per-row,
  pre-commit. Old rows (no marker) behave exactly as before. — Claude
- **Intake replay ≠ create_contact replay**: no GHL upsert, no side
  effects (sync parity), placeholder ids stay. — Claude
- **Runway derivation reads ORIGINAL tables** (not mirrors) — which also
  fixes placements silently frozen since the domain-1 flip. — Claude
- **ai-auto keeps its label** through the replay; manual always wins. —
  Claude (MS #740)

## Files Created

- MS #741: `MasterSuite.Modules.Frandev/{FrandevGhl,FrandevRunwayRules}.cs`,
  `FrandevService.{GhlStageSync,LeadIntake,RunwayDerivation}.cs`,
  `IFrandevService.{LeadIntake,RunwayDerivation}.cs`,
  `Jobs/FrandevLeadIntakeJobs.cs`,
  `MasterSuite.Platform.Tests/Frandev/Frandev{LeadIntake,RunwayRules}Tests.cs`

## Files Modified

- MS #741: `FrandevConfig.cs` (3 new flags), `FrandevService.Writes.cs` +
  `.Board.cs` (ghl_synced + FireGhlStageSync ×4), `FrandevHooks.cs`
  (3 hooks), `FrandevWriteExtras.cs` (entities), Frandev csproj (+Gunner
  ref), `DependencyInjectionConfig.cs`, `HangfireConfiguration.cs` (2 jobs
  dark)
- MS #740: `FrandevService.PostCallWrites.cs`
- Sandbox: `lib/mastersuite/apply-native-writes.ts`,
  `tests/business-logic/apply-native-writes.test.ts`,
  `docs/supabase-cutover-port-plan.md` (§10 + build-sequence statuses),
  `app/api/contacts/[contactId]/pipelines/[pipelineId]/drop/route.ts`,
  `lib/mastersuite/push-frandev.ts`, `handoff.md`

## Files Deleted

- None (E2E rows cleaned in-session; wt-s106-profilefix removed after
  #740 merged; wt-s106-d5build stays until #741 merges)

## Open Issues Carried Forward

All standing traps stand (CHAR(36)→Guid CAST; MariaDB not MySQL —
JSON*VALID CHECKs need serialized JSON; verified WRITE proves nothing
about the READ; minted-JWT recipe; green build proves nothing about SQL;
git hook misparses "push <word>" — commit with `-F` AND keep `git push`
as its own command; solution at `apps/analysis-api/MasterSuite.sln`;
⚠ Vercel writes PRODUCTION Supabase + prod MariaDB journal; new
`frandev*\*`table needs migration + grant same PR; local-run`dotnet run --no-launch-profile`+`ASPNETCORE_URLS=http://localhost:5199`,
creds from `~/.zshrc`; `dotnet test`from`apps/analysis-api/`). Plus:

- **`sync-ms-territories` + `sync-ms-prospects` + guardian retire at the
  DOMAIN-5 flip** — now with named native replacements — **FYI**
- **Held until off Vercel (Corey, s96)**: 4 nightly jobs, journey-brief
  run — **carried**

## THE GAMEPLAN TO GET OFF VERCEL (domain scoreboard)

| #   | Domain                | State                                                                   |
| --- | --------------------- | ----------------------------------------------------------------------- |
| 1   | Properties/mirrors    | ✅ **DONE**                                                             |
| 2   | EOS                   | ✅ **DONE**                                                             |
| 3   | Workflows             | ✅ RESOLVED — archive, don't port                                       |
| 4   | Calls                 | ✅ **LIVE** — first-call watch open; #740 hardened it pre-first-call    |
| 5   | **Contacts+pipeline** | 🔨 **4/7 steps BUILT DARK** (#741) — left: agents, satellites, flip day |
| 6   | Scout/RAG → Chiron KB | ⏳ after 5                                                              |
| 7   | Platform residue      | ⏳ dies with the app                                                    |

**What is left, in order:**

1. Merge #741 when CI greens (dark, safe).
2. Verify the first live Read.ai call end-to-end.
3. **Corey**: connect the FranDev GHL sub-account (marketplace-app login),
   mint a PIT there, fill `Frandev_GhlLocationId` +
   `Frandev_GhlPrivateToken`; then the smoke hook lists field ids to fill
   `Frandev_GhlStageFieldMap`.
4. **Step 4**: the 4 LLM agents + intelligence scoring (own session,
   prompt-parity gates).
5. **Step 6**: satellite decisions.
6. **Flip day** (runbook in §10 step 7): arm 3 flags + retire 3 crons +
   replay types + ~25 tables from the push + retire sandbox pages + ADR.

## Exact Next Step

Merge MS #741 (CI was running at wrap). Then verify the first live
Read.ai delivery end-to-end (unchanged from s105). Then build step 4:
port research-contacts / reengagement-scan / coaching-brief / contact
journals onto FrandevAnthropic with prompt-byte parity, dark.

## Copy This To Start Next Session In Claude.ai

---

Read this file then tell me: current status, last session summary, open issues, what we build today.
GitHub: https://github.com/c7lavinder/nah-franchise-os-sandbox/blob/main/SESSION_START.md
Then: (1) check MS PR #741 merged (domain-5 steps 1+2+3+5, all dark) — merge if CI green. (2) Verify the newest Read.ai delivery processed natively end-to-end on prod (frandev_integration_log → frandev_call → transcript → grade/KB ≤10 min). (3) Build domain-5 step 4: port the 4 LLM agents (research-contacts, reengagement-scan, coaching-brief, contact-journals) + updateCandidateScore onto FrandevAnthropic, prompt-byte-parity, flag-gated dark — see port-plan §10. Do NOT retire sync-ms-territories/sync-ms-prospects/guardian (they retire at the domain-5 flip, which needs Corey's GHL sub-account connect first).

---
