# Session Handoff — 2026-08-10 — Session 109

## Status

Phase: **CUTOVER TRACK — THE DOMAIN-7 TAIL COLLAPSED IN ONE OVERNIGHT
SESSION. Three MS PRs merged + deployed green (#755 related-people panel,
#756 journey-doc upload, #757 comms-native DARK), migration 257 verified in
prod, and the app's retirement wave shipped: related-people, contact notes,
journey docs, emails/team/messages, and pipeline CONFIG are all 410 now.
Overnight native first-runs VERIFIED (journey-briefs 35/0 errors). Corey
ruled on all four open build-vs-freeze questions. What remains of the
gameplan is exactly: the comms flip (staged as draft PR #759), the webhook
fates decision, the website form re-point, the Read.ai watch, and the kill
itself.** / Health: Green / Duration: full overnight autonomous session

## What Was Built This Session

**MasterSuite (all merged + deployed green):**

- **#755 — Related-people panel** (contact rail): six-field composer,
  inline edit, two-click armed soft delete. Migration 257 (LinkedContactId
  column + PagePanels seed row) verified applied in prod. Journals
  create/update/delete_related_person. 14 new tests, 326/326.
- **#756 — Journey-doc upload**: S3 (recordings bucket, journey-documents/
  prefix, PublicRead + uuid keys — old-app links to native docs WORK),
  Claude-based extraction (PDF as document block, FIELDS-first so
  truncation never costs fields; txt/csv in-process; docx/xlsx store-only
  v1), auto-applies extracted fields via source 'ai-auto'. Two replay-
  safety rules: nda→other (the app's CHECK has no nda), manual-wins
  enforced mirror-side. 23 new tests, 334/334.
- **#757 — Comms native, DARK**: `Frandev_Comms_Native` (absent=off) sends
  SMS/email/tasks straight through MS's own GHL connection (SAME location
  as the app — verified) instead of journaling. GHL failure → no journal
  row (no double-send window). 15 new tests, 325/325.
- **Draft PR #759 — the comms flip**, HELD: migration 258 with the
  pre-flip checklist in the header (drain bridge → currently 0 pending;
  verify location default phone line + email sending domain; smoke to an
  internal number).

**Sandbox app (3 commits, deployed + E2E-verified):**

- **6f015d1**: territory-research truncation fix (max_tokens 4096→16000 +
  explicit stop_reason error — the 11-errors-in-8-days bug); call_coaching
  writer removed + dead /coach route deleted (296 rows archived to Desktop
  JSON; DROP migration committed, see Open Issues); replay handlers for
  the five s109 write types (shipped BEFORE the MS side so no journal row
  ever hits an unhandled type); port-plan §12 corrections + rulings.
- **23c2fcb**: the retirement wave — related-people, notes POST, journey
  docs, emails/team/messages, pipeline CONFIG → 410. 11 pins updated.
- **888fe85**: E2E verification caught that related-people + emails routes
  IMPORT requireAuth but never CALLED it (pre-existing auth gap) — six
  write handlers gained the guard, which is also what makes their 410s
  fire.

## What Is Confirmed Working

- **Overnight native first-runs**: journey-briefs 03:01 UTC "processed 35,
  empty 0, errors 0"; contact-journals 04:02 UTC clean. ⚠ The handoff-108
  times were wrong: Hangfire `localhour()` is **CENTRAL**, not ET.
- Migration 257 applied (column + panel row + \_\_DatabaseMigrations entry);
  `Frandev_Comms_Native` correctly ABSENT (dark).
- Native lead-intake alive: "scanned 16, created 3, dup 13" (Sun 21:55 UTC).
- Replay journal fully drained: 0 pending, all historical types applied.
- E2E on prod (minted JWT): journey-doc POST/DELETE → 410, board/move →
  410, knowledge GET → 200 stays readable; related-people/emails 410s
  verified after 888fe85 (see Exact Next Step if unverified rows remain).
- Sandbox suite: 337 vitest (2 new pin blocks), tsc, next build green.

## What Is Broken or Incomplete

- **call_coaching DROP is staged, not run** — the guardrail correctly
  blocks autonomous DDL. Corey: run
  `supabase/migrations/20260810000000_drop_call_coaching.sql` in the
  Supabase SQL editor. Archive: Desktop/call_coaching_archive_2026-08-10.json
  (296 rows). Zero risk meanwhile (no reader, no writer). — **Corey, 2 min**
- **Comms flip pending** — merge draft MS PR #759 after its 3-item
  checklist. After it settles: retire app GHL task/send/schedule routes +
  Scout comms actions, then refresh-ghl-token retires once
  sync-ghl-calendar is ruled. — **Corey decision + one merge**
- **Webhook fates undecided** — Corey: "we will build these in app i
  think, but have not thought through it." Evidence for the decision: all
  10 candidate hooks (Zorakle, Trainual, DocuSign, payment, BatchLeads,
  FBR, form-submission, Google Meet, 2 GHL) have ZERO events ever;
  contact_zorakle_data is empty; SignalHouse's last event was Jun 22 and
  Vonage replaces it anyway. — **Corey/Ben**
- **Read.ai: still zero delivery rows ever** — first-call E2E watch stays
  open; also gates the sig flip (zero signing keys exist — flipping
  `Frandev_ReadAi_RequireSignature` now would reject 100% of future
  traffic; provision keys from the Read.ai dashboard first) — **Medium**
- **Website form re-point**: the form host is NOT identifiable from the
  repo, and the app intake path has had zero events in 30 days. Target:
  `POST https://mastersuiteapp.com/api/hooks/leads/{source}` with
  `x-gunner-intake-token` (set the per-source token in MS SystemConfig
  first — provider is dark/503 until then). — **needs website owner**
- Unauthenticated GETs remain on several contact satellite routes
  (pre-existing; only writes got the guard) — dies with the app — **Low**

## Decisions Made (Corey, in-session)

- **Emails/team/messages: FREEZE** — "we should already have this in
  gunner." No native build; write routes 410 now; data stays as history.
- **Pipeline CONFIG: FREEZE** — "should already have this in gunner
  settings we can use." Write routes 410 now.
- **Territory research: KEEP + fix** — MS actively reads it
  (FrandevService.Territories + PostCallPrompts). Bug fixed this session.
- **Webhooks: DEFERRED** — no receivers built, nothing ruled dead.
- (Claude) Comms flip staged as a DRAFT PR rather than flipped tonight —
  it changes the transport of real outbound sends; the checklist + smoke
  belong to a human-supervised window.
- (Claude) The freeze rulings retire app writes NOW (per the option Corey
  picked: "they stay read-only history and die with the old app").

## Files Created / Modified

- Sandbox: lib/agents/territory-market.ts, lib/calls/coach.ts (−insert),
  types/supabase.ts (−call_coaching), lib/mastersuite/apply-native-writes.ts
  (+5 write types), lib/auth/retired-writes.ts (+10 patterns),
  tests/critical-paths/retired-writes.test.ts, 4 route files (+requireAuth),
  supabase/migrations/20260810000000_drop_call_coaching.sql,
  docs/supabase-cutover-port-plan.md (§12 corrections + rulings), handoff.md.
  Deleted: app/api/calls/[callId]/coach/.
- MS: PRs #755/#756/#757 merged (branches + worktrees cleaned);
  draft PR #759 open on d7-comms-flip.

## Open Issues Carried Forward

All standing traps stand (CHAR(36)→Guid CAST; MariaDB not MySQL; verified
WRITE proves nothing about READ; minted-JWT recipe — remember the retired-
write check runs AFTER auth, so E2E probes need the JWT; green build proves
nothing about SQL; git hook misparses "push <word>" — `-F` files + `git push`
standalone; solution at apps/analysis-api/MasterSuite.sln; ⚠ Vercel writes
PROD Supabase; sandbox prod DB grant = SELECT + frandev*\* writes; new
frandev*\* table needs migration + grant same PR; local-run recipe + kill
port 5199; dotnet test unsupported — dotnet run the test csproj; Hangfire
dashboard trigger POSTs 500 — wait for the tick). Plus:

- **Hangfire `localhour()` is CENTRAL** — briefs ~03:00 UTC, journals
  ~04:00 UTC, coaching ~12:00 UTC, contact research Sun ~07:00 UTC.
- frandev_integration_log.CreatedAt is UTC; DB session TZ differs — always
  UTC_TIMESTAMP(), mysql2 needs timezone:"Z".
- Scout chat budget: $25/day, resets midnight UTC.
- s96 "held until off Vercel" — re-review at domain-7 close.
- Ben's notes/chat GRANT (Low); carried code cleanups (Low).
- Routes that parse the body BEFORE requireAuth 500 on body-less probes —
  probe retired writes with a JSON body.

## THE GAMEPLAN TO GET OFF VERCEL (domain scoreboard)

| #   | Domain             | State                                                                 |
| --- | ------------------ | --------------------------------------------------------------------- |
| 1   | Properties/mirrors | ✅ DONE                                                               |
| 2   | EOS                | ✅ DONE                                                               |
| 3   | Workflows          | ✅ RESOLVED — archive, don't port                                     |
| 4   | Calls              | ✅ LIVE — tail: call_coaching DROP (Corey), sig flip (needs keys)     |
| 5   | Contacts+pipeline  | ✅ LIVE — carve-outs now RETIRED (related-people/notes/emails/config) |
| 6   | Scout/RAG → Chiron | ✅ LIVE + VERIFIED — briefs agent's first night: 35/0 errors          |
| 7   | Platform residue   | 🟢 **TAIL BUILT** — everything buildable is live or staged            |

### EVERYTHING STILL OUTSTANDING (the complete list, now short)

1. **call_coaching DROP** — Corey runs the committed migration (2 min).
2. **Comms flip** — merge draft MS PR #759 after its checklist → then
   retire app comms routes + Scout comms actions → then refresh-ghl-token
   (after the sync-ghl-calendar/appointments ruling).
3. **Webhook fates** — Corey/Ben think-through (evidence above). Gates the
   webhook re-point wave and the Zorakle receiver question.
4. **Website form re-point** — needs whoever owns newagainhouses.com
   forms; target + token instructions above.
5. **Read.ai** — first live delivery watch; then provision signing keys;
   then sig flip.
6. **Watch items**: coaching-briefs first tick ~12:00 UTC today; contact
   research first native window Sun ~07:00 UTC.
7. **The kill** (strict order, unchanged): team confirmed fully in
   MasterSuite (Chad) → final push-frandev → retire both bridges →
   archive Supabase (dump) → Vercel off → s96 held items + Ben's GRANT +
   carried cleanups.

## Exact Next Step

Check coaching-briefs' first native tick (~12:00 UTC in
frandev_integration_log, UTC_TIMESTAMP as always). Then hand Corey the
three human steps: run the call_coaching DROP, schedule the comms-flip
window (PR #759 checklist), and start the webhook-fates think-through
with Ben. Nothing else in the gameplan is buildable by an agent until
those land.

## Copy This To Start Next Session In Claude.ai

---

Read this file then tell me: current status, last session summary, open issues, what we build today.
GitHub: https://github.com/c7lavinder/nah-franchise-os-sandbox/blob/main/SESSION_START.md
Then: Session 109 collapsed the domain-7 tail overnight — related-people (#755), journey-docs (#756), comms dark (#757) all merged+deployed; app retirement wave live (related-people/notes/docs/emails/messages/pipeline-config all 410); overnight native ticks verified (briefs 35/0; NOTE: Hangfire runs CENTRAL not ET). My three human steps: (1) run the call_coaching DROP migration in Supabase SQL editor (archive is on my Desktop), (2) merge draft MS PR #759 to flip comms native after its checklist, (3) decide webhook fates with Ben (all 10 hooks: zero events ever). Watch: Read.ai still zero deliveries; coaching-briefs first tick ~12:00 UTC.

---
