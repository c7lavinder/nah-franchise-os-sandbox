# Session Handoff — 2026-08-09 — Session 101

## Status

Phase: **CUTOVER TRACK — domain 1+2 read-path fix BUILT and verified (MasterSuite
PR #718 open); all port-plan open decisions RESOLVED by Corey. Everything left
outstanding is waiting on Ben (back in ~24h): GitHub billing fix, GRANT run, #718
merge.** / Health: Green / Duration: short session

## What Was Built This Session

- **All four port-plan §7 open decisions RESOLVED** (Corey): (1) strategy stands
  (ADR-0014); (2) workflows = **archive, don't port** (agent-generated, Gunner
  pattern); (3) Scout/RAG → **fold into Chiron KB** (mostly internal team
  knowledge); (4) sync-retirement go-ahead standing. Recorded in
  `docs/supabase-cutover-port-plan.md` §7.
- **MasterSuite PR #718** (branch `frandev-s101-eos-originals`, worktree
  `wt-eos-repoint`): the FranDev territory EOS tab now reads the `Eos_*` ORIGINALS
  (Eos*Goals wide row → 7-metric scorecard, Eos_Rocks, Eos_Todos, Eos_Issues,
  Eos_Budgets, Eos_Habits wide row, Eos_MarketingChannels wide row) instead of the
  7 `frandev_eos_territory*\*`round-trip mirrors. All app display rules preserved
(whitelist+order, budget/target filter, ungraded-habit hiding,
Agents+IndustryNetwork merge, live-computed actuals). Rock quarter/year meta
line guarded (originals never had those columns). Files:`FrandevService.TerritoryEos.cs`(rewritten),`FrandevService.Territories.cs`(comment),`\_TabTerritoryEos.cshtml` (guard).
- **ADR-0014 corrected** (dated Correction section): `territory_market_data` NEVER
  round-tripped — it is app-born (call-extraction agents, Scout, manual edits); its
  mirror read is the _correct_ direction. `sync-ms-territories` is kept for the
  `territories` FK reference + `journey_pipeline_state` seeding → retires at the
  domain-5 flip, not before. And the EOS round-trip was 7 tables wide, not 1.

## What Is Confirmed Working

**Measured against PRODUCTION. None predicted.**

- PR #718's queries executed directly against prod MariaDB: **scorecard goals and
  habits match the mirror EXACTLY, every territory, all 7 metrics — zero
  mismatches.**
- The list-count differences are the mirror's fault, not the re-point's: the
  inbound sync only ever upserted, so Supabase/the mirror still shows **~48 rocks,
  ~196 todos, ~167 issues, ~9 budgets deleted from `Eos_*` long ago** + 52
  app-created rows (11 rocks / 21 todos / 20 issues, mostly stale Q2-2026 agent
  extractions, near-duplicates). The re-point is a correctness FIX — the native tab
  will finally match what the EOS module actually maintains.
- MasterSuite build: 0 errors. All 8 CI-gated test suites run locally in Release:
  **4,836 tests, 0 failures** (Valuation 912, Coaching 258, Gunner 1749, Training
  37, Chiron 228, Platform 176, Intake 68, Property 1408).
- `bit(1) Done → bool` and `tinyint(1) → bool` Dapper mappings proven by existing
  prod precedent (GetConstructionEos, FrandevTerritoryDetails).

## What Is Broken or Incomplete

- **GitHub Actions is billing-blocked ORG-WIDE** — every run since ~11:40 UTC Aug 9
  fails "account payments have failed / spending limit" (pre-11:25 runs green;
  other people's PRs equally hit). #718 cannot go CI-green until an org admin fixes
  Billing & plans — **High (blocks all merges, not just ours)**
- **Notes still don't cross until Ben runs #709's SQL** (carried from s100; merge
  done, execution pending, needs his root credential). 3 frandev_note rows
  unpushable meanwhile — **Medium**
- **PR #718 awaits CI + merge + deploy** via Ben's release train; until it's live
  in prod, the native EOS tab still reads mirrors and `sync-ms-eos` MUST NOT be
  retired — **Medium (sequenced, not broken)**
- 52 app-created EOS rows (above) drop off the native tab when #718 deploys; they
  remain in Supabase; disposition (migrate into Eos\_\* vs discard as stale) is an
  open call for Corey/Ben — **Low**
- Vercel app's property/revenue/L10/Scout-property surfaces frozen at Aug 9
  snapshot — BY DESIGN (ADR-0014) — **Low/FYI**
- `charleston@newagainhouses.com` office-named-as-person rename candidate — **Low**
- Carried, all Low: three inline-edit implementations; `ResolveUser`/`ResolveUsername`
  duplicated; `updateCandidateScore`/`Flags` write on every event; `GetAvgCycleDays`
  uncalled; ungraded calls read "Group Call"; `DataAccess.Tests` empty

## Decisions Made

- **Workflows: archive, don't port** — agent-generated workflows (Gunner pattern)
  replace the page. — Corey
- **Scout/RAG: fold into Chiron KB** — content is mostly internal team knowledge,
  not a separate vector store. — Corey
- **The only data that truly PORTS is comms/call data + pipeline stages (domains
  4+5)**; property/territory/EOS are re-points because MasterSuite already owns
  that data. — Corey (framing), verified in code by Claude
- **All 7 sync-fed EOS reads re-point at once** (not just the scorecard the s100
  analysis named) — provenance verified table-by-table against both DBs. — Claude
- **Goals tab + market data deliberately STAY on mirrors** (app-born, no MySQL
  original), with code comments so nobody "fixes" them later. — Claude
- **The 52 app-created EOS rows are NOT migrated in #718** — flagged instead;
  mostly stale Q2 agent extractions with near-duplicates; blanket-inserting them
  into the canonical Eos\_\* tables would inject junk. — Claude
- **sync-ms-eos retirement is sequenced AFTER #718 deploys to prod** — retiring
  first would freeze the native EOS tab. — Claude

## Files Created

- MasterSuite: PR #718 (no new files — 3 modified; worktree `wt-eos-repoint` kept
  until merge)
- Memory: `decision_cutover_domain_calls.md`

## Files Modified

- Sandbox: `docs/supabase-cutover-port-plan.md` (§7 decisions resolved + framing),
  `docs/adr/0014-cutover-begins-first-inbound-syncs-retired.md` (Correction
  section, 2 commits), `handoff.md`
- MasterSuite (`frandev-s101-eos-originals`, commit `a56f168c9`):
  `apps/analysis-api/MasterSuite.Modules.Frandev/FrandevService.TerritoryEos.cs`,
  `FrandevService.Territories.cs`,
  `apps/analysis-api/MasterSuite/Pages/Frandev/RecordPanels/_TabTerritoryEos.cshtml`

## Files Deleted

- None (temp verification scripts created and removed in-session)

## Open Issues Carried Forward

All session-99/100 standing traps stand (MySqlConnector CHAR(36)→Guid; verified
WRITE proves nothing about the READ; minted-JWT prod-driving recipe; MariaDB not
MySQL; green build proves nothing about SQL — this session's prod parity run is
the model; git hook misparses "push <word>" — commit with `-F <file>`; solution at
`apps/analysis-api/MasterSuite.sln`; ⚠ Vercel WRITES PRODUCTION; ⚠ new `frandev_`
table needs migration + grant in the SAME PR; replay batch limit 50). Plus:

- **⚠ GH Actions org billing** — nothing merges anywhere until fixed — **High**
- **The inbound EOS sync never deleted** — Supabase `eos_territory_*` is a
  historical superset (~420 MySQL-deleted rows); remember this when archiving
  those tables at the domain flip — **FYI**
- **Retire `sync-ms-eos` ONLY after #718 is live in prod** (vercel.json − 1 cron +
  `scheduler-ownership.test.ts` new contract, mutation-tested, per the ADR-0014
  pattern) — **Medium (the next sandbox change)**
- **`sync-ms-territories` does NOT retire at any re-point** — FK reference +
  pipeline seeding; domain-5 exit — **FYI (ADR-0014 Correction is authoritative)**
- **Held until FranDev is fully off Vercel (Corey, s96)**: four nightly jobs
  deliberately unscheduled; journey briefs ~3,175-LLM-call deliberate run — **carried**

## Exact Next Step

Three Ben items, in order: fix GitHub org billing (Settings → Billing & plans),
run `database/2026-08-09_grant_frandev_note_chat_write.sql` against prod (30 sec,
from s100), and merge PR #718 once CI goes green — then, AFTER #718 deploys via
his release train, retire `sync-ms-eos` from `vercel.json` + update
`scheduler-ownership.test.ts` (ADR-0014 pattern), verify the 3 note rows crossed
in the nightly push, and domains 1+2's read-path work is complete.

## Copy This To Start Next Session In Claude.ai

---

Read this file then tell me: current status, last session summary, open issues, what we build today.
GitHub: https://github.com/c7lavinder/nah-franchise-os-sandbox/blob/main/SESSION_START.md
Then: Three Ben items, in order: fix GitHub org billing, run database/2026-08-09*grant_frandev_note_chat_write.sql against prod (30 sec), and merge MasterSuite PR #718 (EOS reads re-pointed to Eos*\* originals — built, prod-parity-verified, 4,836 local tests green; CI is billing-blocked org-wide). AFTER #718 deploys: retire sync-ms-eos from vercel.json + update scheduler-ownership.test.ts (ADR-0014 pattern) and verify the 3 frandev_note rows crossed in the nightly push. Do NOT retire sync-ms-territories — ADR-0014's Correction says it holds until the domain-5 flip (FK reference + pipeline seeding; market data proved app-native). Corey's resolved decisions: workflows archive-not-port; Scout KB → Chiron KB; only calls+pipeline truly port.

---
