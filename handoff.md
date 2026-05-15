# Session Handoff — 2026-05-15 — Session 43

## Status

Phase: GHL Integration + Scout Hardening / Health: Yellow / Duration: full session

## What Was Built This Session

- **Post-call agent run counter fix** — `lib/agents/post-call/agent.ts` now writes to `integration_logs`; Settings > Agents panel sees post-call runs. Backfilled 49 calls. (commits `fd4b4c9`, `46fed6d`)
- **`ghl_date_added` column on contacts** — migration `20260513100000_contacts_ghl_date_added.sql`, sync writes it on every upsert, backfilled 2,692 contacts from GHL API. Scout's `run_aggregation` guidance updated. (commit `b607c73`)
- **Franchise Tether workflow import** — 4 sequences as drafts via `scripts/import-franchise-tether-workflows.ts` (Generic Drip 1 Yr, 2026 Q2 Cold, Intro Call Info, Website Form Leads — 23 steps total). (commit `fd4b4c9`)
- **NAH Design System doc** — `docs/design.md` capturing brand tokens, typography, glass-card pattern, badge variants, sibling-app reuse instructions. (commit `a868ee2`)
- **5 bug-report fixes** + `bug_reports.report_type` migration: type toggle (bug vs improvement), call action tooltips, batch push on data suggestions, Next-Step hero on call detail. (commit `135b4df`)
- **Settings > Calendars panel** — `components/settings/CalendarsPanel.tsx` lists all 11 active GHL calendars + Scout match preview + Refresh button + last-fetched timestamp + recent appointment activity log. (commits `e91770d`, `49c4b62`, `cd9c201`)
- **Scout appointment flow instrumentation** — every draft + push writes to `integration_logs` under `integration_name='scout-appointment'`. (commit `cd9c201`)
- **Scout fixes (multiple rounds)**:
  - `get_calendar_availability` Scout tool + `getFreeSlots` GHL client (commit `1b50c50`)
  - `CALENDAR_CONTEXT` prompt block: NAH calendars, business purpose, hosts, sales-funnel vs coaching split (commit `1b50c50`)
  - `deriveHintFromTitle()` fallback when LLM forgets `calendar_hint` (commit `edce219`)
  - Smarter calendar matcher: exact > starts-with > whole-word > substring (commit `352508c`)
  - Rule 1a: never claim action confirmed until tool result confirms it (commit `edce219`)
  - Rule 1b: no separate GHL confirmation step phrasing (commit `fc68ad0`)
  - Rule 1c: speak confidently, no "based on your memory note", no "I think" hedging (commit `fc68ad0`)
  - Rule 16: Eastern Time default, all times display with "ET" suffix (commit `352508c`)
  - Title format rule: "{Meeting Type} w/ {Contact Full Name}" (commit `352508c`)
  - Contact resolution rule: never draft with Unknown — ask first (commit `352508c`)
- **`sendMessage` flat response parsing** — `lib/ghl/client.ts` was returning undefined and silently crashing every email send after GHL queued it; now normalizes flat `{ messageId, conversationId }` into a real GHLMessage. (commit `037fff6`)
- **Open in Scout handoff** — FAB writes conversation to `sessionStorage`; `/scout` page reads + clears it on mount, preserving the same thread. (commit `aea1a6a`)
- **Contact picker UUID → GHL ID fix** — 5 action forms (Appointment, Email, Note, SMS, Task) now use `ghl_contact_id` from `/api/contacts/search` instead of internal Supabase UUID. Server-side `resolveGhlContactId()` in `app/api/scout/action/route.ts` translates any UUID to the matching GHL ID as a defensive safety net. (commit `352508c`)
- **GHL webhook subscription** (Corey-side) — added ContactUpdate + OpportunityCreate to GHL Marketplace App.
- **Workflow activation** — 14 workflows flipped from `draft` to `live` with `trigger_type='manual'` (so none auto-fire). 2 duplicates of "Path to Ownership Nurture" archived.

## What Is Confirmed Working

- **GHL push paths (server-side verified)**: createTask, sendMessage (email), createAppointment — all return real IDs and land in GHL.
- **Calendar matcher tiers**: 9/9 hint cases tested ("intro" → Intro Call, "discovery" → Discovery Call, "fdd" → FDD Review Call, "chad onboarding" → Chad Onboarding, etc.).
- **UUID → GHL ID resolution**: Denzel's internal `cac195c5-...` → resolves to `BWy45fmPABvoBiDWmaxx`.
- **`getFreeSlots`**: fetches actual free slots from GHL; appointment creation only succeeds when targeting a free slot.
- **GHL has Twilio number wired**: `+1 423-556-4611`, SMS+MMS capable, active in location since Feb 2022.
- **Backfill scripts** (post-call logs: 49 rows; ghl_date_added: 2,692 rows).
- **Migration applied to prod**: `bug_reports.report_type` column added via direct psql.

## What Is Broken or Incomplete

- **Bug F (contact_id) end-to-end UI test not yet confirmed** — Corey hit the bug again right before session wrap; fixes were committed but **NOT PUSHED** until the final minutes. All 14 commits just pushed via `git push origin main`. Vercel deploy was in progress when session ended. **Critical** — needs retest after deploy.
- **Bug A (Scout drafts with Unknown Contact)** — same root cause; prompt fix only takes effect once deployed. **High**
- **Bug B (wrong calendar)** — same; new matcher + prompt rules only effective post-deploy. **High**
- **Bug E (Eastern Time display)** — same; depends on deploy. **Medium**
- **Bug D (RAG / learn from edits)** — deferred. Bigger feature, not bug. **Low**
- **Twilio SMS** — A2P 10DLC approval still pending on Twilio's side; nothing to do until they approve. **Medium (external blocker)**.
- **Workflow scheduler firing end-to-end** — wired and live but never actually exercised against a real enrollment. **Medium** — verify by enrolling Chad Test in "Intro Call Info Campaign" and watching Pending Confirmations panel within 15 min.

## Decisions Made

- **Twilio**: stay with Option A (route via GHL) — Corey confirmed.
- **Workflows**: all 14 flipped to `trigger_type='manual'` — Corey's call ("lets keep them all manually enroll for now").
- **Skip OpportunityCreate/StageUpdate webhooks** — Corey confirmed NAH OS doesn't use GHL opportunities.
- **Calendar descriptions** hardcoded in prompt with override-via-`app_settings.scout_calendars` path — pragmatic choice over building dedicated UI.
- **Test appointment cleanup uses cancel via PUT** instead of DELETE (API key lacks DELETE scope on appointments).
- **`DATABASE_URL` added to `.env.local`** for direct psql migration capability going forward.

## Files Created

- `supabase/migrations/20260513100000_contacts_ghl_date_added.sql`
- `supabase/migrations/20260514100000_bug_reports_add_type.sql`
- `scripts/backfill-post-call-integration-logs.ts`
- `scripts/import-franchise-tether-workflows.ts`
- `scripts/backfill-ghl-date-added.ts` (was untracked, now committed)
- `docs/design.md`
- `components/calls/NextStepHero.tsx`
- `components/settings/CalendarsPanel.tsx`
- `app/api/settings/calendar-activity/route.ts`
- `data/franchise-tether-workflows.json` (gitignored)

## Files Modified

- `lib/agents/post-call/agent.ts`
- `app/api/settings/agents/route.ts`
- `lib/ghl/sync.ts`
- `lib/ghl/client.ts` (sendMessage fix + getFreeSlots)
- `lib/ghl/index.ts`
- `lib/scout/tools.ts` (get_calendar_availability tool def)
- `lib/scout/tool-executor.ts` (calendar matcher tiers, ET default, hint derivation, logging)
- `lib/scout/client.ts` (CALENDAR_CONTEXT, rules 1a/1b/1c/16, title format, contact resolution rule)
- `lib/scout/prompt-loader.ts` (scout_calendars key)
- `types/scout.ts`
- `components/scout/action-forms/AppointmentActionForm.tsx`
- `components/scout/action-forms/EmailActionForm.tsx`
- `components/scout/action-forms/NoteActionForm.tsx`
- `components/scout/action-forms/SMSActionForm.tsx`
- `components/scout/action-forms/TaskActionForm.tsx`
- `app/api/scout/action/route.ts` (resolveGhlContactId + appointment instrumentation)
- `app/(auth)/audit/page.tsx` (report_type filter + badges)
- `app/api/bug-reports/route.ts` (accept reportType)
- `app/(auth)/calls/[callId]/page.tsx` (NextStepHero)
- `components/calls/CallActionItem.tsx` (tooltips)
- `components/calls/CallDataField.tsx` (checkbox column)
- `components/calls/CallDataTab.tsx` (batch push bar)
- `components/ui/BugReportButton.tsx` (type toggle, conditional priority)
- `app/(auth)/settings/page.tsx` (Calendars tab wiring)
- `components/layout/ScoutFAB.tsx` (handoff to /scout)
- `app/(auth)/scout/page.tsx` (hydration from sessionStorage)
- `docs/scout-tools.md` (new tool entry)
- `.env.local` (DATABASE_URL added — gitignored)

## Files Deleted

(none — temp diagnostic scripts created/removed within session, no committed deletes)

## Open Issues Carried Forward

- **Bug F retest in UI after deploy** — Critical
- **Test workflow scheduler with real enrollment** — Medium
- **Twilio A2P approval** — Medium (external)
- **Bug D (RAG / learn from user edits)** — Low (future feature)
- **Memory drift** — Scout's stored memory for Corey/Chad had stale "GHL sync issue" entries that were already cleared via direct SQL. No code-level fix; self-curates going forward.
- **Habit fix needed**: every commit must be immediately followed by `git push`. Cost most of the session: 14 commits sat unpushed, Corey was testing stale prod code without knowing.

## Exact Next Step

Wait for the Vercel deploy of commit `352508c` to land (~3 min from push), then in Scout type "schedule an intro call for denzel lavinder for monday morning" and verify: (a) draft title shows "Intro Call w/ Denzel Lavinder", (b) calendar is "Intro Call" (not Chad Onboarding), (c) times display in ET, (d) clicking Confirm pushes successfully (no UUID-not-found error).

## Copy This To Start Next Session In Claude.ai

---

Read this file then tell me: current status, last session summary, open issues, what we build today.
GitHub: https://github.com/c7lavinder/nah-franchise-os-sandbox/blob/main/SESSION_START.md
Then: Wait for the Vercel deploy of commit `352508c` to land (~3 min from push), then in Scout type "schedule an intro call for denzel lavinder for monday morning" and verify: (a) draft title shows "Intro Call w/ Denzel Lavinder", (b) calendar is "Intro Call" (not Chad Onboarding), (c) times display in ET, (d) clicking Confirm pushes successfully (no UUID-not-found error).

---
