# NAH Franchise OS — Build Progress & Next Steps

> Last updated: March 23, 2026
> Status: **Phase 0 + Phase 1a complete. Ready for dev team handoff.**

---

## What's Been Built

### Phase 0 — Foundation (COMPLETE)

- [x] Next.js 14 project with TypeScript strict mode + Tailwind CSS + App Router
- [x] Full folder structure: `/app`, `/components`, `/lib`, `/types`, `/public`
- [x] Tailwind config with complete NAH design system (colors, fonts, spacing, component classes)
- [x] TypeScript types for all 7 database tables, GHL entities, and Scout types
- [x] Supabase client (browser + server)
- [x] GHL API client with 16 typed functions (contacts, pipeline, tasks, appointments, messaging, workflows, notes)
- [x] Scout AI client with Claude tool-call loop, 8 tool definitions, and tool executor
- [x] App shell: sidebar (collapsible, role-based), top bar (logo, title, user menu with logout), responsive layout
- [x] Login page wired to Supabase Auth
- [x] Auth context provider (login, logout, session persistence in localStorage)
- [x] Auth-protected route group — redirects to `/login` if not authenticated
- [x] `.env.local.example` with all required variables
- [x] `.gitignore` configured

### Phase 1a — Scout AI Page (COMPLETE)

- [x] `POST /api/scout/chat` — receives messages, runs full Claude tool-call loop, persists sessions
- [x] `POST /api/scout/action` — executes confirmed actions in GHL (send message, create task, move stage)
- [x] Tool-call loop: Claude calls a tool → executor runs it against GHL/DB → result sent back → repeat until final response
- [x] 8 Scout tools: `get_contact`, `search_contacts`, `get_pipeline`, `get_schedule`, `draft_message`, `draft_task`, `draft_stage_move`, `search_knowledge`
- [x] Draft tools return `DraftedAction` objects for user review (not auto-executed)
- [x] Chat UI: Scout bubbles (purple tint + avatar), user bubbles (dark), thinking indicator (animated dots)
- [x] `DraftedActionCard` component: Edit / Confirm / Cancel buttons, inline editing, loading states
- [x] Voice input: `VoiceRecorder` component (MediaRecorder API) + `POST /api/voice/transcribe` (Whisper API)
- [x] Suggestion buttons on empty state
- [x] New Session button
- [x] Auto-scroll on new messages
- [x] Session persistence to Supabase `sessions` table
- [x] Action logging to `scout_action_logs` table

### Phase 1b — Daily HQ Page (COMPLETE)

- [x] `GET /api/daily-hq` — fetches alerts, pipeline snapshot, upcoming appointments from GHL + Supabase
- [x] Rep scorecard (calls, texts, emails, stage moves, new contacted)
- [x] Alerts panel with severity indicators, click-through to Scout
- [x] Tasks panel (placeholder — will pull from GHL when connected)
- [x] Pipeline snapshot with horizontal bar chart
- [x] Upcoming events (next 48 hours)
- [x] Auto-refresh every 5 minutes
- [x] Refresh button

### Phase 1c — Accountability Engine (COMPLETE — Definitions)

- [x] `lib/accountability/engine.ts` with 5 monitoring functions:
  - Speed-to-Lead (new leads not contacted within 5 min)
  - Stale Lead (in New Lead for 1+ hour)
  - Validation Staleness (in Validation for 10+ days)
  - Closing Stall (no activity in Closing for 3+ days)
  - FDD Window Tracker (14-day countdown + midpoint check)
- [x] `POST /api/accountability/run` — triggers all checks manually or via cron
- [x] Alert creation in `inactivity_alerts` table

### Other

- [x] `GET /api/health` — checks database, Claude, GHL, Whisper connectivity
- [x] `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- [x] Database migration SQL: all 7 tables, indexes, RLS policies, auto-updated_at triggers
- [x] Seed data: admin user, 10 app settings, 4 knowledge base documents
- [x] Pipeline page (Phase 2 placeholder with Kanban layout preview)
- [x] Leads page (Phase 2 placeholder with table layout preview)
- [x] Settings page (shows user profile, integration status)

---

## Tech Stack (as implemented)

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | Next.js 14 + TypeScript + Tailwind CSS | App Router, strict mode |
| Backend | Next.js API Routes | Simpler than separate Express backend for MVP |
| Database | Supabase (PostgreSQL) | Untyped client for now — generate types with `supabase gen types` after schema deploy |
| Auth | Supabase Auth | JWT tokens stored in localStorage |
| AI | Anthropic Claude API (`claude-sonnet-4-5-20250514`) | Full tool-use with multi-turn loop |
| Voice | OpenAI Whisper API | MediaRecorder → webm → Whisper → text |
| Icons | Lucide React | Lightweight, consistent icon set |

---

## File Map

```
nah-franchise-os/
├── app/
│   ├── globals.css                         # Tailwind base + NAH component classes
│   ├── layout.tsx                          # Root layout with AuthProvider
│   ├── page.tsx                            # Redirect → /scout
│   ├── login/page.tsx                      # Login page (Supabase Auth)
│   ├── (auth)/                             # Protected route group
│   │   ├── layout.tsx                      # Auth check + AppShell wrapper
│   │   ├── scout/page.tsx                  # Scout AI chat (fully wired)
│   │   ├── daily-hq/page.tsx               # Daily HQ dashboard (fully wired)
│   │   ├── pipeline/page.tsx               # Pipeline board (Phase 2 placeholder)
│   │   ├── leads/page.tsx                  # Leads list (Phase 2 placeholder)
│   │   └── settings/page.tsx               # Settings page
│   └── api/
│       ├── auth/login/route.ts             # POST — login
│       ├── auth/logout/route.ts            # POST — logout
│       ├── auth/me/route.ts                # GET — current user
│       ├── scout/chat/route.ts             # POST — Scout conversation turn
│       ├── scout/action/route.ts           # POST — execute confirmed action
│       ├── daily-hq/route.ts               # GET — dashboard data
│       ├── voice/transcribe/route.ts       # POST — audio → Whisper → text
│       ├── accountability/run/route.ts     # POST — run all checks
│       └── health/route.ts                 # GET — service health check
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx                    # Sidebar + TopBar + content wrapper
│   │   ├── Sidebar.tsx                     # Role-based nav, collapsible
│   │   ├── TopBar.tsx                      # Logo, title, user menu + logout
│   │   └── index.ts
│   └── scout/
│       ├── ScoutBubble.tsx                 # Scout message (purple, left-aligned)
│       ├── UserBubble.tsx                  # User message (dark, right-aligned)
│       ├── ThinkingIndicator.tsx           # Animated "Scout is thinking" dots
│       ├── DraftedActionCard.tsx           # Edit/Confirm/Cancel action card
│       ├── VoiceRecorder.tsx               # Mic button → MediaRecorder → transcribe
│       └── index.ts
├── lib/
│   ├── auth/
│   │   ├── AuthContext.tsx                 # React context: login, logout, user state
│   │   ├── session.ts                     # Server-side JWT verification
│   │   └── index.ts
│   ├── ghl/
│   │   ├── client.ts                      # 16 GHL API functions (contacts, pipeline, etc.)
│   │   └── index.ts
│   ├── scout/
│   │   ├── client.ts                      # runConversationTurn() — full tool-call loop
│   │   ├── tools.ts                       # 8 Scout tool definitions for Claude
│   │   ├── tool-executor.ts               # Executes tools against GHL/DB
│   │   └── index.ts
│   ├── supabase/
│   │   ├── client.ts                      # Browser client (anon key)
│   │   └── server.ts                      # Server client (service key)
│   └── accountability/
│       └── engine.ts                      # 5 monitoring checks + runAllChecks()
├── types/
│   ├── database.ts                        # All 7 table types + Database type
│   ├── ghl.ts                             # GHL entity types
│   ├── scout.ts                           # Chat, drafted actions, tool types
│   └── index.ts                           # Central re-exports
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql         # All tables, indexes, RLS, triggers
│       └── 002_seed_data.sql              # Admin user, settings, knowledge docs
├── docs/                                  # Architecture, design, pipeline, etc.
├── tailwind.config.ts                     # NAH design system
├── tsconfig.json                          # Strict TypeScript
├── package.json                           # Next.js 14, Tailwind 3, Anthropic SDK, Supabase, Lucide
└── .env.local.example                     # All required environment variables
```

---

## What the Dev Team Needs to Do First

### Before writing ANY code:

1. **Read the docs** — `CLAUDE.md`, then everything in `/docs/`
2. **Set up Supabase** — create project, run the two SQL migration files
3. **Create a Supabase Auth user** — then link it to the `users` table (see seed data SQL)
4. **Get API keys** — Anthropic, GHL, OpenAI (optional for voice)
5. **Create `.env.local`** — copy from `.env.local.example`, fill in all values
6. **Run `npm install && npm run dev`** — verify login works, Scout responds

### Environment Variables Required

| Variable | Where to get it |
|----------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → `anon` `public` key |
| `SUPABASE_SERVICE_KEY` | Supabase → Settings → API → `service_role` `secret` key |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `GHL_API_KEY` | GHL → Settings → API Keys |
| `GHL_LOCATION_ID` | GHL → Settings → Business Info → Location ID |
| `OPENAI_API_KEY` | platform.openai.com → API Keys (optional — for voice) |

---

## Next Steps — What to Build

### Immediate (Day 1-2)

1. **Deploy Supabase schema** and verify login/auth works end-to-end
2. **Test Scout with live Anthropic key** — verify Claude responds, tool calls work
3. **Connect GHL** — verify contacts, pipeline, tasks come back from the API
4. **Generate typed Supabase client** — run `supabase gen types typescript` to replace the untyped client

### Short Term (Week 1)

5. ~~**Daily HQ scorecard**~~ — DONE: wired to real GHL activity counts + scout_action_logs
6. ~~**Daily HQ tasks**~~ — DONE: pulls open tasks from GHL contacts assigned to user
7. **Accountability cron** — see Railway Cron Setup below
8. ~~**Scout conversation history**~~ — DONE: loads most recent active session on page load
9. **Scout knowledge base injection** — inject active knowledge docs into the system prompt dynamically
10. ~~**Error handling polish**~~ — DONE: 429 retry + exponential backoff added to GHL client

### Railway Cron Setup — Accountability Engine

The accountability engine runs via `POST /api/accountability/run`. In production, set up
Railway Cron jobs to call this endpoint on a schedule.

**Option A — Railway Cron Service (recommended):**

1. In Railway, create a new **Cron Service** in your project
2. Set the schedule and command:

| Job | Cron Expression | Command |
|-----|----------------|---------|
| Speed-to-lead + Stale check | `*/15 * * * *` (every 15 min) | `curl -X POST https://[your-domain]/api/accountability/run` |
| Full accountability sweep | `0 */2 * * *` (every 2 hours) | `curl -X POST https://[your-domain]/api/accountability/run` |
| Daily Scout workflow analysis | `0 6 * * *` (6 AM daily) | `curl -X POST https://[your-domain]/api/accountability/run?type=daily` |

**Option B — node-cron inside the app (simpler for dev):**

Add to a startup file or API route:
```typescript
import cron from "node-cron";
// Every 15 minutes
cron.schedule("*/15 * * * *", async () => {
  await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/accountability/run`, { method: "POST" });
});
```

**For local development:** Just call the endpoint manually:
```bash
curl -X POST http://localhost:3000/api/accountability/run
```

### Medium Term (Week 2-3)

11. **Pipeline Board (Phase 2a)** — Kanban with drag-and-drop via `@dnd-kit`, stage move validation
12. **Lead Profile page (Phase 2b)** — contact detail, score breakdown, activity timeline
13. **Leadership Dashboard (Phase 2b)** — KPIs, funnel chart, rep leaderboard via `recharts`

### Architecture Decisions for the Team

| Decision | Current State | Recommendation |
|----------|-------------|----------------|
| State management | React Context + local state | Add SWR or TanStack Query for server data caching |
| Component library | Raw Tailwind | Consider adding shadcn/ui for modals, dropdowns, tooltips |
| Form validation | None | Add Zod for API input validation |
| Testing | None | Add Vitest for service layer, Playwright for login + chat E2E |
| Cron scheduling | Manual API trigger | Set up Railway Cron or node-cron in a separate worker |

---

## Design System Reference

All colors, fonts, spacing, and component classes are in `tailwind.config.ts` and `app/globals.css`.

| Token | Value | Usage |
|-------|-------|-------|
| NAH Orange | `#E8431A` | Primary CTA, active nav |
| Scout Purple | `#7C3AED` | AI accent, chat bubbles |
| bg-primary | `#0F0F0F` | Root background |
| bg-secondary | `#1A1A1A` | Cards, sidebar |
| Font | Inter | All text |

Component classes: `btn-primary`, `btn-secondary`, `btn-scout`, `btn-ghost`, `card`, `input`, `badge-success/warning/danger/info`

---

## Commands

```bash
npm run dev        # Start dev server (localhost:3000)
npm run build      # Production build
npm run type-check # TypeScript check (must be 0 errors before any push)
npm run lint       # ESLint check
```
