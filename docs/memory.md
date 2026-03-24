# memory.md — NAH Franchise OS Living Memory

> This file is updated by Claude Code after EVERY session, major update, fix, or important decision.
> This is the first file Claude Code reads at the start of every new session.
> It bridges the gap between GitHub commits and Claude Code's context window.
> If it happened and it matters — it lives here.

---

## Project Identity
- **Name:** NAH Franchise OS
- **Product:** AI-first franchise sales platform for New Again Houses
- **AI Brain:** Scout (powered by Anthropic Claude)
- **CRM Backend:** GoHighLevel (GHL) — source of truth for all contacts
- **Core rule:** Scout drafts → human confirms → executes in GHL

---

## Current Status
- **Phase:** Phase 0 + 1a + 1b + 1c complete. Ready for env setup + live testing.
- **Last updated:** 2026-03-23
- **Last session:** Pipeline fully redesigned to v2 — 11 stages, compliance gate, Trainual mapped to stages
- **Next action:** Build Daily HQ wireframe then start Phase 0 code

---

## Tech Stack (Locked)
- Frontend: Next.js 14, TypeScript strict, App Router
- Styling: Tailwind CSS 3 with NAH design system
- Backend: Next.js API routes (not separate Express — simpler for MVP)
- Database: Supabase (Postgres) — untyped client until schema deployed
- AI: Anthropic Claude API (claude-sonnet-4-5-20250514)
- Voice: OpenAI Whisper API via MediaRecorder
- Auth: Supabase Auth with JWT in localStorage
- Icons: Lucide React

---

## Folder Structure
```
app/                     — Next.js App Router pages + API routes
  (auth)/                — Protected route group (redirects to /login if not authed)
  api/                   — 9 API routes (auth, scout, daily-hq, voice, accountability, health)
  login/                 — Public login page
components/
  layout/                — AppShell, Sidebar, TopBar
  scout/                 — ScoutBubble, UserBubble, ThinkingIndicator, DraftedActionCard, VoiceRecorder
lib/
  auth/                  — AuthContext (React), session.ts (server JWT verification)
  ghl/                   — GHL API client (16 functions)
  scout/                 — Scout client (tool-call loop), tools.ts, tool-executor.ts
  supabase/              — Browser + server Supabase clients
  accountability/        — 5 monitoring check functions
types/                   — database.ts, ghl.ts, scout.ts
supabase/migrations/     — 001_initial_schema.sql, 002_seed_data.sql
docs/                    — Architecture, design, pipeline, features, integrations, build-plan, stack, PROGRESS.md
```

---

## Environment Variables Needed
| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (server only) |
| `ANTHROPIC_API_KEY` | Claude API key for Scout |
| `GHL_API_KEY` | GoHighLevel API key |
| `GHL_LOCATION_ID` | GHL location/sub-account ID |
| `OPENAI_API_KEY` | Whisper voice transcription (optional) |
| `NEXT_PUBLIC_APP_URL` | App URL (http://localhost:3000 for dev) |

---

## Decisions Made
> Every time Claude Code makes an architectural or design decision, it logs it here.

- **2026-03-23** — Used Next.js API routes instead of separate Express backend — simpler for MVP, fewer moving parts
- **2026-03-23** — Used Supabase Auth instead of JWT + bcrypt — as specified by owner, less custom auth code
- **2026-03-23** — Used untyped Supabase client — schema not deployed yet, will generate types with `supabase gen types typescript` after migration
- **2026-03-23** — Used `claude-sonnet-4-5-20250514` model ID — latest available Sonnet model at build time
- **2026-03-23** — Auth tokens stored in localStorage (not HTTP-only cookies) — simpler for MVP, can upgrade to cookies later
- **2026-03-23** — Tailwind v3 (not v4) — v4 incompatible with Next.js 14 config approach
- **2026-03-23** — Pipeline upgraded from 9 stages to 11 active stages + 4 exit stages
- **2026-03-23** — Added Stage 6.5 compliance gate — hard block enforced by Scout
- **2026-03-23** — Stage 7 Application flagged as pending attorney review
- **2026-03-23** — Three pipelines confirmed: Active, Long-term, Closed
- **2026-03-23** — Pipeline philosophy: mutual vetting process, not traditional sales funnel
- **2026-03-23** — Chad owns full journey, orchestrates team member involvement at each stage

---

## What Has Been Built

### Phase 0 — Foundation
- [x] Next.js project initialized
- [x] Tailwind + design system configured
- [x] App shell (sidebar, top bar, responsive layout) built
- [x] Supabase client (browser + server) set up
- [x] GHL API client built (16 typed functions)
- [x] Scout API client built (tool-call loop + 8 tools)
- [x] Auth system (AuthContext, login API, session verification)
- [x] Login page wired to Supabase Auth
- [x] Protected route group with redirect
- [x] Database migrations (7 tables, indexes, RLS, triggers)
- [x] Seed data (admin user, 10 settings, 4 knowledge docs)
- [x] .env.local template created
- [x] Health check API endpoint

### Phase 1a — Scout AI Page
- [x] POST /api/scout/chat — full Claude tool-call loop
- [x] POST /api/scout/action — execute confirmed GHL actions
- [x] Chat UI (Scout bubbles, user bubbles, thinking indicator)
- [x] DraftedActionCard (Edit/Confirm/Cancel with inline editing)
- [x] Voice input (MediaRecorder + Whisper transcription)
- [x] Session persistence to Supabase
- [x] Action logging to scout_action_logs
- [x] Suggestion buttons, new session, auto-scroll

### Phase 1b — Daily HQ
- [x] GET /api/daily-hq — alerts, pipeline snapshot, upcoming events
- [x] Wired dashboard (scorecard, alerts, tasks, pipeline chart, upcoming)
- [x] Auto-refresh every 5 minutes
- [ ] Real activity counting from GHL (currently returns 0s)
- [ ] Real task pulling from GHL

### Phase 1c — Accountability Engine
- [x] 5 monitoring checks defined (speed-to-lead, stale, validation, closing, FDD)
- [x] POST /api/accountability/run — manual trigger
- [ ] Cron scheduling (Railway Cron or node-cron)

### Phase 2a — Pipeline Board
- [x] Placeholder page with Kanban column layout
- [ ] Not started — Phase 2

### Phase 2b — Leadership Dashboard
- [ ] Not started — Phase 2

---

## Known Issues & Bugs

- **[low]** — ESLint v8 is deprecated but required for Next.js 14 compatibility — upgrade when moving to Next.js 15
- **[low]** — Supabase client is untyped — generate types after schema deployment with `supabase gen types typescript`
- **[med]** — Daily HQ scorecard returns 0s — needs real GHL activity counting implementation
- **[med]** — No GHL OAuth token refresh — currently uses static API key, OAuth flow needed for production
- **[low]** — Auth uses localStorage — consider HTTP-only cookies for production security
- **[high]** — Stage 7 BLOCKED — pending franchise attorney review on application fee, deposit, background check, financial verification requirements

---

## Audit Log

- **2026-03-23** — Full project audit — `npx tsc --noEmit` returns 0 errors, `npx next build` succeeds with 19 pages and 9 API routes, no warnings

---

## Files Changed This Session

All files were created this session (initial build). See `git log` for the full list of 66 files.

---

## What Claude Code Must Do Every Session

### On START of every session:
1. Read memory.md FIRST
2. Read CLAUDE.md second
3. Check "Current Status" to know exactly where we are
4. Check "Known Issues" before writing new code
5. Check "What Has Been Built" before assuming anything exists

### On END of every session (or after any major change):
1. Update "Current Status" with new phase + last action
2. Update "What Has Been Built" checkboxes
3. Log any new decisions in "Decisions Made"
4. Log any bugs found in "Known Issues"
5. Log audit results in "Audit Log"
6. Update "Files Changed This Session"
7. Write a one-line "Last session" summary at the top

---

## Self-Audit Protocol
> Claude Code follows this 4-step process for every function, component, and API call.

### Step 1 — Write
Write the initial version of the code.

### Step 2 — Question
Ask these questions about every piece of code:
- Is this the simplest way to do this?
- Are there any edge cases not handled?
- Could this break under load or with bad data?
- Is the TypeScript typing correct and strict?
- Does this follow the patterns already established in the codebase?
- Is the error handling sufficient?
- Does this expose any security risk?
- Is this readable by another developer in 6 months?

### Step 3 — Improve
Apply improvements based on Step 2 findings.
Log what was changed and why.

### Step 4 — Validate
- Does it still do what it was supposed to do?
- Does it match the spec in the relevant doc?
- Does it follow the rules in CLAUDE.md?
- If it touches GHL — does it go through /lib/ghl only?
- If it touches Scout — is there a confirmation step before action?

Only after Step 4 passes does the code get written to the file.

---

## Claude Code Session Starter Prompt
> Copy this exact prompt at the start of every new Claude Code session.

```
Read memory.md first. Then read CLAUDE.md.
Tell me:
1. Current project phase
2. What was last built
3. Any known issues to be aware of
4. What we are building this session

Then proceed with: [describe what you want to build this session]

Remember: follow the 4-step self-audit protocol on every piece of
code before finalizing it. Update memory.md when the session ends.
```
