# Session Handoff — 2026-08-10 — Session 109

## Status

Phase: **CUTOVER TRACK — THE DOMAIN-7 TAIL COLLAPSED, THEN THE SECOND WAVE
LANDED SAME-DAY. Overnight: #755 related-people, #756 journey-doc upload,
#757 comms dark + the app's retirement wave (13 surfaces 410, E2E-verified).
Daytime, on Corey's live rulings: call_coaching DROPPED (Corey authorized;
verified gone), COMMS FLIPPED ON (#759 merged, flag verified in prod,
bridge drained), Read.ai PROVEN end-to-end native (Corey's test: webhook →
classified → call created → post-call agent processed), the website-form
question CLOSED (the form writes MS's own FormSubmissions table and native
intake sweeps it every 10 min — no re-point needed), and the webhook wave
SHIPPED (#761 eight receivers + #762 Settings→Webhooks page, all 8 GET
probes verified live). All four native agents have verified first runs
(briefs 35/0, journals, coaching-brief 12:09 UTC; contact research next
Sun).** / Health: Green / Duration: overnight + daytime, one session

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

SECOND-WAVE RESOLUTIONS (same day, Corey live in the loop): call_coaching
DROP **DONE** (Corey authorized; applied via the committed migration,
verified gone; 296-row archive on Desktop). Comms flip **DONE** (#759
merged+deployed, `Frandev_Comms_Native=on` verified, migration 258
tracked). Webhook fates **RULED: BUILD** → shipped as #761+#762 (below).
Read.ai **ANSWERED**: Corey's test hit the NATIVE receiver → classified →
call b833f42d created → post-call agent ran it at 08:26 UTC. Website form
**CLOSED**: it writes MS's own FormSubmissions/PathToOwnershipEntries and
native intake sweeps every 10 min (the "scanned 16, created 3" runs).

Still open:

- **Comms-native smoke BACKBURNERED (Corey)** — the GHL sub-account has
  no Twilio grant yet, so the SMS test waits on that. Flag stays ON:
  tasks/email go native now; an SMS attempt before Twilio lands returns a
  visible error (deliberately no silent fallback). Historical SMS volume
  is ~nil, so risk accepted. If it bites: `Frandev_Comms_Native` off is
  the one-row rollback. Smoke + wave-3 retirement resume after the
  Twilio grant. — **waiting on Twilio**
- **App comms-route retirement** — now that the flip is ON and proven by
  a first send: retire app GHL task/send/schedule routes + Scout comms
  actions (deny-list wave 3), then refresh-ghl-token once
  sync-ghl-calendar/appointments is ruled. — **next session**
- **Webhook tokens unset** — all 8 new receivers accept unauthenticated
  deliveries until their token is set on Settings → Webhooks (by design:
  arming is a config flip). Set each token when pointing the provider at
  its URL. — **Corey, as providers connect**
- **Read.ai signing key** — deliveries arrive `sig=invalid` (no key
  stored). Copy the signing key from Read.ai's webhook settings → store in
  `frandev_read_ai_webhook_key` → then flip
  `Frandev_ReadAi_RequireSignature` on. — **Corey, small**
- **Auto-advance on webhook completions** — trainual/docusign/PFS
  completions log sub-tasks natively but skip stage auto-advance (the app
  logic drags in half the pipeline engine); every completion logs
  `auto_advance_skipped`. Build natively if wanted. — **Medium**
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

| #   | Domain             | State                                                                     |
| --- | ------------------ | ------------------------------------------------------------------------- |
| 1   | Properties/mirrors | ✅ DONE                                                                   |
| 2   | EOS                | ✅ DONE                                                                   |
| 3   | Workflows          | ✅ RESOLVED — archive, don't port                                         |
| 4   | Calls              | ✅ LIVE + Read.ai PROVEN e2e native; call_coaching DROPPED                |
| 5   | Contacts+pipeline  | ✅ LIVE — carve-outs RETIRED; forms flow via native FormSubmissions sweep |
| 6   | Scout/RAG → Chiron | ✅ LIVE + VERIFIED — all 4 agent first-runs green                         |
| 7   | Platform residue   | ✅ **COMMS NATIVE ON; 8 webhook receivers + Settings page LIVE**          |

### EVERYTHING STILL OUTSTANDING (the complete list, now very short)

1. **Comms first-send smoke** — Corey sends one SMS/task from MS: expect
   "Sent via GHL" + a comms-native log row. Then next session retires the
   app's GHL task/send/schedule routes + Scout comms actions (deny-list
   wave 3) and starts the refresh-ghl-token/sync-ghl-calendar retirement.
2. **Point the providers at their new URLs** — Settings → Webhooks has
   every URL + token control (Zorakle, Trainual, DocuSign, payment, PFS
   form, Google Meet, BatchLeads, FBR). Set the token as each provider is
   connected. Read.ai already points at MS and works.
3. **Read.ai signing key** — copy from Read.ai dashboard → key store →
   flip Frandev_ReadAi_RequireSignature.
4. **Auto-advance on webhook completions** — native v1 logs
   `auto_advance_skipped`; build if wanted (Medium).
5. **Watch**: contact research first native window Sun ~07:00 UTC.
6. **The kill** (strict order, unchanged): team confirmed fully in
   MasterSuite (Chad) → final push-frandev → retire both bridges →
   archive Supabase (dump) → Vercel off → s96 held items + Ben's GRANT +
   carried cleanups.

## Exact Next Step

Confirm Corey's first comms-native send landed ("Sent via GHL" + log
row), then ship deny-list wave 3 (app GHL task/send/schedule routes +
Scout comms actions retire). Then the ONLY remaining builds are
auto-advance-on-completion (optional) and the kill-sequence steps, which
are behavioral/human.

## Copy This To Start Next Session In Claude.ai

---

Read this file then tell me: current status, last session summary, open issues, what we build today.
GitHub: https://github.com/c7lavinder/nah-franchise-os-sandbox/blob/main/SESSION_START.md
Then: Session 109 (overnight + daytime) finished the domain-7 tail AND the second wave: related-people/journey-docs/comms native all merged+deployed; app retirement wave live (13 surfaces 410); call_coaching DROPPED; COMMS NATIVE ON (flag verified, first send untested — check comms-native log rows); Read.ai PROVEN native e2e; website form confirmed flowing via native FormSubmissions sweep; 8 webhook receivers + Settings→Webhooks page LIVE (probes verified). First: confirm a comms-native send row exists, then retire app comms routes (deny-list wave 3). Traps: Hangfire runs CENTRAL not ET; coaching job logs as 'coaching-brief' singular.

---
