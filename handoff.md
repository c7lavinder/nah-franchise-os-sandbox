# Session Handoff — 2026-08-17 — Session 110

## Status

Phase: **LAUNCH-AUDIT COMPLETE — full code/visual/functional audit of the
native FranDev build ran against prod (13 agents + hands-on Chrome pass,
all 20 serious claims adversarially CONFIRMED, none refuted). The living
report + 3-wave plan of attack is published and replaces the Aug-10
review. Two same-day fixes by Corey: Anthropic cap FIXED (verified live —
a real brief generated 14:49 UTC), Read.ai fix ATTEMPTED but unverifiable
until a call happens (nothing anywhere since Fri Aug 14 18:09).** /
Health: Yellow (build is close; access + dead feeds gate the team) /
Duration: full session

## What Was Built This Session

- **The audit itself** (no product code was changed — this session was
  investigation + the plan): 10 area agents over
  `Mastersuite/mastersuite/apps/analysis-api` (Pages/Frandev,
  Pages/Gunner FranDev surfaces, MasterSuite.Modules.Frandev) with
  read-only prod SQL, then 2 adversarial verifiers (20/20 confirmed) and
  a completeness critic, plus a click-through of every page in Corey's
  logged-in Chrome.
- **The living audit report** (topic rail, launch scoreboard, fix-first
  10, per-page findings, 3-wave plan):
  **https://claude.ai/code/artifact/0ce7d5bf-2ebc-42d2-af73-a72ea8aa831d**
  — THE document to talk through; the old Aug-10 artifact was deleted.
- **Anthropic key verification harness**: proved the key works by GETting
  a briefless journey page with a minted JWT (enqueues on-visit regen) —
  brief row appeared ≤2 min. Reusable as a 2-minute key probe.
- Memory updated: `project_site_qa_phase.md` rewritten for s110 (artifact
  URL, fix-first list, verification states).

## What Is Confirmed Working

(All verified this session with SQL output, live API results, or in-browser.)

- **Anthropic API key**: FIXED — live brief generated for
  `yuban-ruiz-tobon` at 2026-08-17 14:49:55 UTC after Corey lifted the cap.
- **Lead intake end-to-end**: form → contact + journey + pipeline state in
  3–7 min; 11 real imports since the flip; a NEW real lead (Yuban Ruiz
  Tobon) arrived and journeyed TODAY.
- **Knowledge-base port is DONE**: 58/58 docs native, titles byte-identical
  to Supabase; retrieval ranked + flag on; Chiron DRC enforced in code
  (writes physically require approval), conversations logged.
- **Kanban math**: every stage badge reproduces exactly against prod SQL;
  fan-out rule respected; 0 dangling call/data-graph links (440 calls).
- **Auth**: all 18 FranDev pages behind one uniform gate; zero surviving
  UI links to the old Vercel app.
- **Day Hub error isolation** (failed card ≠ empty card, self-healing) —
  the pattern the record pages should copy.
- Journey/territory record pages render well with real data; cross-links
  contact ↔ territory verified both directions.

## What Is Broken or Incomplete

**THE FIX-FIRST TEN** (talk-through order; full detail in the artifact):

1. **Read.ai deliveries dead since Aug 13 20:31 UTC** — old app got 4 more
   calls Aug 14 that native missed. Corey changed something Aug 17 but NO
   call has happened since, so unproven; receiver GET-probes 200; signing
   keys unchanged since Aug 9. Verify on Monday's first call or a Read.ai
   test-send; re-ingest the 4 missed calls. — **Critical**
2. ~~Anthropic cap~~ — **FIXED + verified.** Still owed: mark-stale sweep
   (38 briefs are stale-in-fact with wrong stage advice rendered), budget
   gate on on-visit regen (2,982 briefless nurture journeys). — Medium
3. **Three access locks keep the team out**: (a) registry beta rows —
   20 `dayhub-frandev` + 5 `strip_fd_*` all beta for corey/matt/ben;
   (b) Frandev permission =1 only for john/matt/will — **Chad has NO
   grant** (admin bypass only); (c) `Gunner_AccountAccess_Frandev`
   allowlist = matt/ben/corey/chad only. One data-only pass once Corey
   sends the roster. — **Critical (waiting on roster — Corey says soon)**
4. **No UI door into FranDev**: all 11 home tiles inert; account picker
   can't be operated (row not clickable, OK dead, scope never applies);
   headers have no FranDev entry; 8 of 18 pages have zero inbound links;
   /frandev/pipeline orphaned yet ScoutPrompt still points there. — **Critical**
5. **Chiron chat input takes no text anywhere** (own page, docks, bubble);
   backend + history fine. Also: FranDev lens of Day Hub opens the GUNNER
   Chiron; tools are permission-scoped not account-scoped (#895 never
   reached Scout); no transcript search survived the port. — **Critical**
6. **Calls page renders 0 of 440 calls**; filter tabs dead; raw-UTC times
   (4–5h off); "All" silently caps at 200; **28 of last 54 calls have
   HostedByUserId='0'** (attribution broken → per-rep views miss half);
   coaching-brief job selects Role='rep' which NO user has — zero briefs
   ever. — **High**
7. **Onboarding page + Day Hub card read `frandev_market_signal` (0 rows
   ever)** → "0 franchisees" while the onboarding pipeline holds 55
   journeys / 5 territories mid-onboarding. Re-point at pipeline states. — **High**
8. **Data repairs**: 4 active journeys with dangling PrimaryContactId
   (Colman/Bara/Abraham/Pearson — Pearson also has NO pipeline state and
   an unexplained write path); contact pages double-list the primary
   journey for 3,101/3,209 contacts (`Contacts.cs:41`); 8 duplicate-person
   pairs each with two active journeys; 10 test contacts on active
   journeys; 7 falsely-Active territories; 425 slugs with spaces. — **High**
9. **All 8 webhook token doors OPEN** (no tokens ever generated — unauth
   POSTs can create pipeline contacts); native comms has sent ZERO
   messages ever (Twilio grant pending); kanban writes lack CSRF; new
   leads can't be texted/emailed (placeholder `pto_` GHL ids, no promotion
   path); no native add-lead form; no new-lead notification. — **High**
10. **Grades all F** (0–1 scores vs 0–100 buckets, `DayHubCards.cs:277`)
    - Territories list stamps "Below target" on every row. One-line SQL fix. — **Medium**

**Also (talk-through worthy):** appointments mirror dead (17 rows, newest
start Jun 10 — nothing writes it; where does THIS week's booked call
appear?); SMS frozen Jun 25 (9 rows, no native writer — Messages hub is a
museum of June test data); ~46 swallowed reads across contact/journey/
territory pages (crash renders as clean empty state); journey brief's
"next actions" generated but rendered NOWHERE; 4 dead `/frandev/messaging`
links (page is `/frandev/messages`); journey docs' files still live in
Supabase storage (die at teardown); NOW()-vs-UTC read math ~4h off
app-wide; dev placeholder text ("renders here once the enrollment read is
wired") ships on every record page; no alerting anywhere — nobody owns
the morning watch.

## Decisions Made

- The audit artifact **replaces** the Aug-10 review as the living QA/plan
  doc — Corey (this was the request).
- Team access can wait a beat but "need to get them on soon" — Corey;
  unlock executes the moment the roster arrives.
- API-cap fix confirmed shipped — Corey did the console action; verified
  live this session.

## Files Created

- (artifact) `frandev-launch-audit.html` → published at
  https://claude.ai/code/artifact/0ce7d5bf-2ebc-42d2-af73-a72ea8aa831d
  (source in session scratchpad; recreate from workflow journal
  `subagents/workflows/wf_22f94429-10f/journal.jsonl` if needed)

## Files Modified

- `handoff.md` (this file)
- memory: `project_site_qa_phase.md` (rewritten for s110), `MEMORY.md`
  (index line updated)

## Files Deleted

- none (no repo code touched — audit-only session)

## Open Issues Carried Forward

- Read.ai delivery verification — **Critical** (first real call proves it)
- Team roster → access unlock (beta rows + permissions + allowlist) — **Critical**
- Fix-first items 4–10 above (Wave 1–2 build work) — **High**
- Comms first-send smoke (blocked on Twilio grant) → then wave-3 old-app
  retirement; provider tokens; the kill checklist gains: migrate 3 journey
  docs off Supabase storage, re-point CallsV2 uploads to native. — **High**
- Appointments feed decision (revive vs. remove surfaces) — needs Corey/Ben — **Medium**
- Split-brain inventory: which old-app routes still accept writes / which
  journaled write types still need old-app replay — **Medium**
- Mobile pass + unaudited thin pages (Marketing, L10, Inventory lead
  panel) — **Low**

## Exact Next Step

Confirm Monday's first Read.ai call landed natively (`frandev_integration_log`
IntegrationName='read_ai' after Aug 17), then start Wave 1 from the artifact:
access unlock (needs Corey's roster), home-tile/picker navigation, Chiron
input wiring, Calls page fixes, and the data-repair batch.

## Copy This To Start Next Session In Claude.ai

---

Read this file then tell me: current status, last session summary, open issues, what we build today.
GitHub: https://github.com/c7lavinder/nah-franchise-os-sandbox/blob/main/SESSION_START.md
Then: Confirm Monday's first Read.ai call landed natively, then start Wave 1 from the audit artifact (access unlock needs my roster; navigation, Chiron input, Calls page, data repairs).

---
