# NAH Franchise OS — Session Start

> Paste this file's GitHub URL at the start of every new Claude.ai chat session.
> URL: https://github.com/c7lavinder/nah-franchise-os-sandbox/blob/main/SESSION_START.md

---

## Who You Are Working With
- **Owner:** Corey — New Again Houses (NAH), house flipping franchise
- **Repo:** https://github.com/c7lavinder/nah-franchise-os-sandbox
- **Live app:** https://nah-franchise-os-sandbox.vercel.app
- **Login:** corey@newagainhouses.com / Gunner147

---

## What This Project Is
NAH Franchise OS — an AI-first franchise sales platform built on top of GoHighLevel (GHL).
- **Scout** = the AI brain (Claude-powered). Everything is built around Scout.
- **GHL** = source of truth for all lead/contact/pipeline data. Never bypass it.
- **Semi-assisted model** = Scout drafts → human reviews → human confirms → Scout executes.
- Scout NEVER acts without human confirmation. Always Draft → Review → Confirm.

---

## Current Phase Status
| Phase | Status |
|-------|--------|
| Phase 0 — Foundation | ✅ Complete |
| Phase 1a — Scout AI (15 tools) | ✅ Complete |
| Phase 1b — Daily HQ | ✅ Complete |
| Phase 1c — Accountability Engine | ✅ Complete |
| Phase 2a — Pipeline Board | ✅ Complete |
| Phase 2b — Leadership Dashboard + Lead Profile | ✅ Complete |
| Workflow Intelligence Engine | ✅ Complete |
| Phase 3a — Bug Fixes + DB Schema | ✅ Complete |
| Phase 3b — Candidate Intelligence Layer | ✅ Complete |
| Phase 3c — Explainable Score | ✅ Complete |
| Phase 4 — Onboarding + Coaching Pipeline | ✅ Complete |
| Phase 5 — Franchisee Performance Integration | ⏸️ Backburner (waiting on backfill data) |
| Phase 6 — Prediction Engine | 🔲 Future (needs 30+ closed franchisees) |

---

## The Intelligence Plan (MUST READ)
**`docs/NAH-FO-INTELLIGENCE-PLAN.md`** drives everything from Phase 3 forward.
Read it before building any Phase 3+ features. It defines:
- The 3-layer intelligence architecture (Collection → Store → Prediction)
- 5 new database tables (candidate_intelligence, call_logs, score_history, objections, performance)
- Call log system (4 call types with structured fields)
- Explainable scoring (4 buckets × 25 points)
- Matt's asks and open questions for Phase 4+

---

## Tech Stack (Locked — Do Not Deviate)
- **Frontend:** Next.js 14, TypeScript strict, App Router, Tailwind CSS
- **Backend:** Next.js API routes
- **Database:** Supabase (Postgres + Auth)
- **AI:** Anthropic Claude API (claude-haiku-4-5-20251001 for Scout)
- **CRM:** GoHighLevel (GHL) — all lead data lives here, poll via PIT/OAuth (no webhooks)
- **Voice:** Web Speech API (MVP), Whisper upgrade later
- **Deploy:** Vercel (frontend)

---

## Design System (Non-Negotiable)
- Light mode, desktop first (Design System v1.0)
- NAH Blue: `#00A1E1` — primary actions, nav
- Accent Yellow: `#F5A800` — warnings, gates
- Glass morphism cards, Signika + Roboto fonts
- Hover sidebar (80px → 280px), Scout FAB bottom-right
- Components: Tailwind only — no external UI libs unless already in package.json

---

## Folder Rules
```
/app              → Next.js pages (App Router)
/components       → UI components
/lib/ghl          → ALL GHL API calls live here — nowhere else
/lib/scout        → Scout AI logic
/lib/workflows    → Workflow intelligence engine
/lib/supabase     → DB client
/types            → TypeScript types
/docs             → Spec docs — read before building features
/scripts          → Setup and seed scripts
```

---

## Non-Negotiable Code Rules
- TypeScript strict — `npx tsc --noEmit` must return 0 errors before any push
- No `any` types — ever (document with comment if truly unavoidable)
- No hardcoded secrets — everything via `process.env`
- ALL GHL calls go through `/lib/ghl/client.ts` — never call GHL directly
- No GHL webhooks — all data via PIT/OAuth polling (see feedback_no_webhooks.md)
- Scout NEVER sends/acts without human confirmation
- One feature end-to-end before starting the next

---

## Pipeline Stages (GHL Source of Truth)
| # | Stage Name | Owner | GHL Name |
|---|-----------|-------|----------|
| 1 | New Lead | Chad + AI | New Lead |
| 2 | Contacted | Chad | Contacted |
| 3 | Qualified | Chad | Guided Path to Ownership |
| 4 | Matt Call (Discovery) | Matt | Discovery Call |
| 5 | Sam Call (Validation) | Sam | Validation Call |
| 6 | Compliance Gate | System | Compliance Gate |
| 7 | FDD Issued | Legal | FDD Issued |
| 8 | Mark Call (Lending) | Mark | Lending Call |
| 9 | Decision Call | Matt | Award + Agreement |
| 10 | Matt Final / Documents | Matt | Award + Agreement |
| 11 | Funds Received | System | Closed Won |
| — | Nurture | Auto | Nurture |
| — | Lost | Manual | Lost |

---

## Key Docs to Read Before Building Features
| Building... | Read first |
|------------|-----------|
| Phase 3+ features | `docs/NAH-FO-INTELLIGENCE-PLAN.md` |
| Anything Scout-related | `CLAUDE.md` |
| Any GHL integration | `docs/integrations.md` + `../ghl-masterclass/` |
| Any pipeline logic | `docs/pipeline.md` |
| Any UI component | `docs/design.md` |
| Workflow features | `docs/workflows.md` |

---

## Session Handoff
See `handoff.md` for:
- What was built last session
- Open bugs and blockers
- Exact next step
- Decisions made

---

## How To Start This Session
After reading this file, read `handoff.md` then tell Corey:
1. Current phase and health status
2. What was built last session
3. Open issues or blockers
4. What we are building today

Then proceed with whatever Corey says to build next.
Run `/wrap-session` when done.
