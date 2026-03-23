# New Again Houses — Franchise OS

> **"Every rep should feel like they have a world-class franchise sales coach sitting next to them — 24/7."**

---

## What Is This?

The **NAH Franchise OS** is a custom-built operations platform for **New Again Houses**, a house-flipping franchise brand. At its core is **Scout** — an AI-powered franchise sales assistant that helps development reps manage leads, stay accountable, and close franchise deals faster.

This is not a generic CRM. GoHighLevel (GHL) remains the CRM and source of truth for all lead data. The Franchise OS is a **custom intelligence layer** built on top of GHL that adds:

- **Scout AI** — a Claude-powered conversational agent that drafts messages, moves pipeline stages, creates tasks, and coaches reps in real time
- **Daily HQ** — a personalized daily command center showing each rep exactly what they need to do today
- **Pipeline Board** — a visual Kanban view of the 10-stage franchise sales pipeline
- **Leadership Dashboard** — real-time pipeline health, rep performance, and conversion analytics
- **Accountability Engine** — automated monitoring that enforces pipeline rules and flags violations

---

## MVP Goal

The MVP consists of **two pages**:

### Page 1: Scout AI
A chat interface where reps talk to Scout. Scout reads GHL data, drafts actions (messages, tasks, stage moves), and executes them after human confirmation. Includes voice input via Whisper.

### Page 2: Daily HQ
A personalized daily dashboard showing:
- Today's tasks and follow-ups
- Pipeline snapshot with alerts
- Rep scorecard (calls, messages, stage moves)
- Accountability flags requiring attention

Everything else (pipeline board, leadership dashboard, lead profiles, knowledge base manager) is Phase 2+.

---

## Document Map

| Document | What It Covers |
|----------|---------------|
| [CLAUDE.md](CLAUDE.md) | Scout's identity, persona, behavior rules, and core instructions for AI contributors |
| [docs/architecture.md](docs/architecture.md) | Full system architecture — topology, data flow, Scout agent flow, database schema, auth, deployment |
| [docs/pipeline.md](docs/pipeline.md) | All 10 pipeline stages with entry/exit criteria, time targets, Scout actions, lead scoring model |
| [docs/design.md](docs/design.md) | Dark mode design system — colors, typography, spacing, wireframes, component library |
| [docs/features.md](docs/features.md) | Complete feature list organized by phase (MVP → Phase 2 → Phase 3), tagged by role |
| [docs/integrations.md](docs/integrations.md) | GHL API, Claude API, Whisper API, OpenClaw, full tech stack, environment variables |
| [docs/build-plan.md](docs/build-plan.md) | Phased build plan with checklists, team setup, definition of done, and timeline |
| [docs/stack.md](docs/stack.md) | Confirmed tech decisions, pending decisions for dev team, and setup instructions |

---

## Tech Stack Summary

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js (React) | App shell, pages, UI components |
| **Backend** | Node.js + Express | API server, Scout agent controller, background jobs |
| **Database** | PostgreSQL (Supabase) | Users, Scout memory, sessions, action logs, knowledge base |
| **CRM** | GoHighLevel (GHL) | Source of truth for all lead, pipeline, task, and messaging data |
| **AI** | Anthropic Claude API | Scout's brain — reasoning, tool use, conversation |
| **Voice** | OpenAI Whisper API | Voice-to-text transcription for Scout voice input |
| **Lead Data** | OpenClaw API | Lead enrichment and data augmentation |
| **Frontend Hosting** | Vercel | Next.js deployment, CDN, edge functions |
| **Backend Hosting** | Railway | API server, cron jobs, background workers |
| **Auth** | JWT + bcrypt | Session tokens, password hashing, role-based access |

---

## Roles

| Role | What They See |
|------|--------------|
| **Rep** | Scout AI, Daily HQ, their own leads, their own pipeline, their own stats |
| **Marketing** | Campaign analytics, lead source performance, aggregate pipeline data |
| **Leadership** | Everything — all reps, all leads, all analytics, user management, knowledge base |

---

## How Scout Works (Quick Version)

```
Rep asks Scout a question
  → Scout reads GHL data (leads, pipeline, tasks)
  → Scout reasons about the best action
  → Scout drafts a response or action
  → Rep reviews, edits if needed, confirms
  → Scout executes the action in GHL
  → Action is logged for audit
```

Scout **never** acts without human confirmation. Every outbound message, task, stage move, and appointment goes through the **Draft → Review → Confirm** pattern.

---

## Getting Started

See [docs/build-plan.md](docs/build-plan.md) for the full phased build plan and [docs/stack.md](docs/stack.md) for technology decisions and setup instructions.

---

## North Star

> *"Scout doesn't replace reps. Scout makes every rep dramatically more effective. The goal is not automation — it's amplification. Every rep using Scout should feel like they have an unfair advantage."*

— New Again Houses Franchise OS Vision
