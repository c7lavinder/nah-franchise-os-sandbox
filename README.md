# New Again Houses — Franchise OS

Internal AI-first platform for **New Again Houses** franchise sales and coaching.
Powered by **Scout** — an AI sales coach that helps reps manage leads, stay accountable, and close franchise deals faster.

---

## Stack

| Layer     | Tech                                                               |
| --------- | ------------------------------------------------------------------ |
| Framework | Next.js 14 (App Router, TypeScript strict)                         |
| Database  | Supabase (PostgreSQL + Auth)                                       |
| AI        | Anthropic Claude Haiku 4.5 (Scout), OpenAI Whisper (transcription) |
| CRM       | GoHighLevel (GHL) via OAuth + PIT key                              |
| Hosting   | Vercel (auto-deploy from main)                                     |

---

## How to run locally

```bash
git clone https://github.com/c7lavinder/nah-franchise-os-sandbox.git
cd nah-franchise-os-sandbox
npm install
cp .env.local.example .env.local   # Fill in real values (get from 1Password)
npm run env:check                   # Verify required env names without printing secrets
npm run dev                         # http://localhost:3000
```

For production-like validation, pull Vercel env and run the explicit production-env build:

```bash
vercel pull --yes --environment=production
npm run type-check
npm run build:prod-env
```

See `docs/build-deploy-runbook.md` for the deploy/smoke-test path.

---

## Auth model

All 216 API routes are protected. See `docs/security.md` for full details.

- **API routes:** `requireAuth` reads JWT from `Authorization: Bearer` header
- **Frontend:** `apiFetch` from `lib/auth/api-fetch.ts` auto-attaches JWT from localStorage
- **Admin routes:** Additional `user.role === "admin"` check
- **Cron routes:** `CRON_SECRET` Bearer token
- **Webhooks:** Shared secret or HMAC verification

---

## What's built

- 14 authenticated pages (Daily HQ, Scout, Pipeline, Calls, Contacts, Territories, Workflows, Settings, etc.)
- 216 API routes, 209 authenticated, 7 intentionally public
- 24 Scout AI tools with Draft-Review-Confirm pattern
- 4 pipelines (Sales, Follow-up, Onboarding, Runway)
- Intelligence engine (100-point candidate scoring)
- Workflow engine (A/B testing, approvals, health scoring)
- EOS integration (goals, rocks, habits, scorecard per territory + contact)
- 27 critical-path smoke tests

---

## Reading order

1. This README (you're here)
2. `CLAUDE.md` — rules for AI tools working in this repo
3. `docs/master-plan.md` — roadmap, status, decisions
4. `docs/system-shape.md` — architecture overview
5. `docs/security.md` — auth model, data handling
6. `docs/scout.md` + `docs/scout-tools.md` — Scout AI behavior
7. `docs/build-deploy-runbook.md` — build/deploy/smoke-test workflow
8. `docs/repo-db-cleanup-plan.md` — cleanup priorities for faster future builds
9. `docs/runbook.md` — when things break

---

## Key directories

```
app/(auth)/       14 authenticated pages
app/api/          216 API routes
lib/scout/        Scout AI (tools, executor, memory)
lib/ghl/          GHL client + OAuth
lib/auth/         Auth utilities (requireAuth, apiFetch)
lib/workflows/    Workflow engine
lib/intelligence/ Intelligence/scoring engine
supabase/migrations/  Schema source of truth
tests/critical-paths/ 27 smoke tests
docs/             All documentation
.claude/          Claude Code skills, hooks, and slash commands
```
