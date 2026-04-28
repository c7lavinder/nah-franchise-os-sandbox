---
Last verified: 2026-04-28
Source: session (Tier 1 #7 form webhook)
---

# Master Plan — NAH Franchise OS

This is the source of truth for project state, roadmap, and decisions.
Replaces `docs/NAH_OS_BLUEPRINT.md` (retired to `docs/archive/blueprint-v1.md`).

---

## What this is

Internal AI-first platform for **New Again Houses** (house-flipping franchise).
Backbone for franchise sales + ongoing coaching at scale.
Goal: support hundreds of franchisees who each buy 10+ houses/year.

---

## Where we are now

### What's shipped

- Next.js 14 App Router, 14 authenticated pages, 216 API routes (all protected)
- Scout AI tool-call loop with 24 tools, Claude Haiku 4.5
- GHL client with OAuth + PIT fallback, retry logic, ~30 wrappers
- Intelligence engine (6 tables, 100-pt scoring, 1,987 profiles bootstrapped)
- Workflow engine (7 tables, A/B testing, approvals, health scoring)
- Accountability engine (5 monitoring checks, node-cron scheduler)
- Call log system (14 call types, transcript analyzer, grading)
- Journey/pipeline system (4 pipelines: sales, follow-up, onboarding, runway)
- EOS integration (goals, rocks, habits, todos, scorecard per territory + contact)
- TypeScript strict, 0 tsc errors
- 27 critical-path smoke tests (auth, webhook, cron, admin role)
- Full auth retrofit: requireAuth on 209 routes, CRON_SECRET on 16 cron routes, webhook secret on 9 webhooks
- Git guardrails hook blocking destructive commands
- Customer data scrubbed from git history

### What's parked

- MasterSuite integration (not in scope until v1 complete)
- Vonage (dropped — GHL handles SMS)
- Per-rep RLS row filtering (separate ADR)
- JWT localStorage to httpOnly cookies migration

---

## Execution roadmap

### Tier 0 — Existential fixes (COMPLETE)

| Phase                           | Status | Date       |
| ------------------------------- | ------ | ---------- |
| 0a — Git guardrails             | Done   | 2026-04-27 |
| 0b — Auth retrofit (2a-2f)      | Done   | 2026-04-27 |
| 0c — Data privacy audit + scrub | Done   | 2026-04-27 |

### Session A — Doc reorg (COMPLETE 2026-04-27)

- Deleted 28 dead files (~8,300 lines of stale content)
- Consolidated 2 schema SQL files into numbered migrations
- Created 8 new docs (master-plan, system-shape, runbook, scout, scout-tools, integrations, team, data-model)
- Rewrote README.md and CLAUDE.md, created CONTRIBUTING.md
- Created 10 ADRs in docs/adr/
- Reconciled .env.local.example (added 6 missing vars)
- Archived blueprint to docs/archive/blueprint-v1.md

### Session B — Foundation tooling (COMPLETE 2026-04-27)

- Generated Supabase schema types (4,330 lines — reference only, full client typing needs Supabase login)
- Husky pre-commit hooks: lint-staged (Prettier) + tsc --noEmit + npm test
- GitHub Actions CI: tsc + lint + test on push/PR to main
- PR template with pre-merge checklist
- .claude/settings.json verified and documented

### Session C — Custom skills + hooks + agents (COMPLETE 2026-04-28)

- 8 skills (7 new + git-guardrails): migration-safety-check, nah-context-load, verify-claims, new-adr, ghl-boundary-check, scout-tool-add, deploy-readiness
- 2 review agents as slash commands: /review-code (NAH rubric), /review-migration (SQL review)
- 3 hook scripts: block-dangerous-git (Bash), migration-safety-reminder (Edit), ghl-boundary-check (Edit)
- 7 slash commands: wrap-session, load-context, verify-claims, audit-docs, draft-adr, review-code, review-migration

### Tier 1 — Feature gaps

| #   | Gap                           | Effort    | Depends on                 |
| --- | ----------------------------- | --------- | -------------------------- |
| 7   | Form webhook config           | 1-2 days  | Done (2026-04-28)          |
| 3   | Real users in GHL             | 3-5 days  | Auth retrofit (done)       |
| 2   | Daily HQ per-user wiring      | 1 week    | #3                         |
| 1   | LLM depth (Scout prompt, RAG) | 1-2 weeks | #3                         |
| 4   | Multi-contact calls           | 2 weeks   | Independent                |
| 5   | Per-call-type grading         | 1-2 weeks | #4                         |
| 6   | MasterSuite                   | 3-4 weeks | Scoping conversation first |

---

## Decisions log

See `docs/adr/` for individual decision records. Key decisions:

- GHL is contacts + messaging only — app owns all pipeline logic (ADR-0001)
- Supabase is app state source of truth (ADR-0002)
- Draft-Review-Confirm pattern is sacred (ADR-0003)
- requireAuth returns Response, not throws (ADR-0008)
- Schema lives in supabase/migrations/ only (ADR-0009)
- WEBHOOK_SHARED_SECRET activated for GHL (Tier 1 #7); other providers pending config

---

## Open questions

- JWT in localStorage vs httpOnly cookies — deferred
- Per-rep RLS row filtering — separate ADR when prioritized
- OAuth token storage cleanup (JSON in app_settings) — cleanup pass later
- MasterSuite data direction (push vs pull) — needs scoping conversation
- GitHub API cache: old commit SHAs accessible up to 90 days post-scrub (private repo)
