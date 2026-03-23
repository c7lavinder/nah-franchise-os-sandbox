# NAH Franchise OS — Build Plan

> This document is the phased build plan for the New Again Houses Franchise OS.
> It covers team setup, every build phase with checklists, definition of done criteria,
> timeline estimates, and guidelines for working with Claude Code during development.

---

## 1. Team Setup Checklist

Before any code is written, the following must be in place:

### Accounts & Access

- [ ] GitHub repository created (private) with `main` and `dev` branches
- [ ] Supabase project provisioned — database URL and keys secured
- [ ] Vercel account connected to the GitHub repo for frontend deployment
- [ ] Railway account connected to the GitHub repo for backend deployment
- [ ] Anthropic account created — Claude API key generated
- [ ] OpenAI account created — Whisper API key generated
- [ ] GHL Marketplace app registered — OAuth client ID and secret obtained
- [ ] GHL sub-account (location) identified — location ID noted
- [ ] OpenClaw account created (if available) — API key obtained
- [ ] Sentry project created (optional) — DSN noted
- [ ] Slack incoming webhook created (optional) — URL noted

### Local Development

- [ ] Node.js 20+ installed on all developer machines
- [ ] pnpm or npm chosen as the package manager (pnpm recommended)
- [ ] `.env.local` template created and shared securely (not via git)
- [ ] Database schema migration scripts written and tested locally
- [ ] Seed data script created (admin user, default settings, starter knowledge base)
- [ ] ESLint + Prettier configured with project rules
- [ ] TypeScript strict mode enabled (`"strict": true` in tsconfig.json)
- [ ] Git hooks configured — pre-commit runs lint, pre-push runs type check
- [ ] Project README read by all team members

### Team Alignment

- [ ] All team members have read CLAUDE.md (Scout's behavior rules)
- [ ] All team members have read docs/architecture.md (system design)
- [ ] All team members have read docs/pipeline.md (franchise sales pipeline)
- [ ] All team members have read docs/design.md (design system)
- [ ] All team members have read this build plan
- [ ] Communication channel established (Slack, Discord, or similar)
- [ ] Code review process agreed upon (PR reviews, approval count)
- [ ] Sprint cadence agreed upon (1-week or 2-week sprints)

---

## 2. Phase 0 — Foundation

> **Goal:** Set up the project skeleton, database, authentication, and deployment pipeline.
> Nothing is user-facing yet. This phase is pure infrastructure.

### Tasks

- [ ] Initialize Next.js project with TypeScript and Tailwind CSS
- [ ] Initialize Express.js backend with TypeScript
- [ ] Set up monorepo structure (or separate repos — team decision)
- [ ] Configure Tailwind with the NAH dark mode design system colors and tokens
- [ ] Install and configure shadcn/ui component library
- [ ] Set up Prisma ORM with Supabase PostgreSQL connection
- [ ] Write database migration for all 7 tables (users, user_memory, sessions, scout_action_logs, knowledge_documents, app_settings, inactivity_alerts)
- [ ] Write all indexes per architecture.md specification
- [ ] Enable Row Level Security (RLS) on all Supabase tables
- [ ] Write seed script — admin user, default app_settings, starter knowledge documents
- [ ] Implement JWT authentication — login endpoint, token issuance, refresh flow
- [ ] Implement password hashing with bcrypt (12+ rounds)
- [ ] Implement role-based middleware — route protection by role
- [ ] Implement session tracking in the sessions table
- [ ] Build the app shell — sidebar, top bar, main content area, responsive layout
- [ ] Implement sidebar navigation with role-based menu items
- [ ] Implement user avatar dropdown with profile/logout
- [ ] Set up Vercel deployment for the frontend (auto-deploy on push to `main`)
- [ ] Set up Railway deployment for the backend (auto-deploy on push to `main`)
- [ ] Configure environment variables on Vercel and Railway
- [ ] Verify end-to-end: login → authenticated request → database query → response
- [ ] Set up health check endpoint (`GET /api/health`)
- [ ] Configure CORS on backend (allow only frontend domain)
- [ ] Set up structured logging (Pino recommended)
- [ ] Set up error tracking (Sentry recommended)

### Definition of Done — Phase 0

- [ ] A user can visit the app URL, see a login page, log in with email/password, and see the app shell with sidebar navigation
- [ ] The sidebar shows different menu items based on the user's role
- [ ] The database has all 7 tables with proper indexes and RLS
- [ ] Frontend auto-deploys to Vercel on push to main
- [ ] Backend auto-deploys to Railway on push to main
- [ ] Health check endpoint returns 200 with all services connected
- [ ] `npx tsc --noEmit` returns 0 errors on both frontend and backend
- [ ] All environment variables are configured on deployment platforms (no hardcoded secrets)

---

## 3. Phase 1a — Scout AI Page

> **Goal:** Build the Scout AI chat interface. Users can talk to Scout, Scout reads GHL data,
> drafts actions, and executes confirmed actions. This is the core product.

### Tasks

- [ ] Build the Scout AI page layout — full-page chat with input bar at bottom
- [ ] Implement chat message components — Scout bubbles (purple) and user bubbles (dark)
- [ ] Implement session management — create new session, load session history
- [ ] Build the chat input bar — text input, send button, voice button
- [ ] Implement the voice recording flow — MediaRecorder, waveform animation, send audio
- [ ] Build the backend voice transcription endpoint — receive audio, forward to Whisper, return text
- [ ] Build the GHL service layer — centralized client with rate limiting, error handling, token refresh
- [ ] Implement GHL API endpoints: get_contact, search_contacts, get_pipeline, get_schedule
- [ ] Implement GHL API endpoints: create_task, update_task, send_message, update_opportunity, add_note
- [ ] Build the Scout agent controller — assembles system prompt, calls Claude API, handles tool calls
- [ ] Write the Scout system prompt — identity, knowledge, user context, current data, tools, rules
- [ ] Implement dynamic prompt assembly — load knowledge docs, user memory, GHL data per request
- [ ] Implement token budget management — truncate dynamic sections if exceeding limits
- [ ] Implement the tool-call loop — Claude responds with tool_use → execute tool → send result → repeat
- [ ] Build the drafted action card component — type, content, Edit/Confirm/Cancel buttons
- [ ] Implement the Draft → Review → Confirm flow for messages
- [ ] Implement the Draft → Review → Confirm flow for tasks
- [ ] Implement the Draft → Review → Confirm flow for stage moves
- [ ] Implement the edit mode on drafted actions — user modifies content before confirming
- [ ] Implement action execution — confirmed actions are sent to GHL via the appropriate API
- [ ] Implement the scout_action_logs recording — log every action with full context
- [ ] Implement user_memory service — store and retrieve Scout's learned context per user
- [ ] Implement the Scout "thinking" indicator — animated dots while waiting for response
- [ ] Implement conversation history sliding window — keep 20 messages + summarize older
- [ ] Implement role-based Scout behavior — different tools, tone, and data scope per role
- [ ] Implement prompt injection defense — sanitize GHL data before injection into prompt
- [ ] Implement lead score display in Scout responses
- [ ] Implement auto-scroll on new messages
- [ ] Implement session dividers (date/time separators)
- [ ] Implement error handling — show user-friendly errors if GHL or Claude is unavailable

### Definition of Done — Phase 1a

- [ ] A rep can open the Scout AI page, type a question, and receive a contextual response from Scout
- [ ] Scout can fetch real GHL data (contacts, pipeline, tasks, appointments) and reference it in responses
- [ ] A rep can ask Scout to text a lead → Scout drafts the message → rep reviews → rep confirms → message is sent via GHL
- [ ] A rep can ask Scout to create a task → Scout drafts → rep confirms → task is created in GHL
- [ ] A rep can ask Scout to move a lead to a new stage → Scout drafts → rep confirms → opportunity is updated in GHL
- [ ] Voice input works — rep taps mic, speaks, audio is transcribed, and the text is sent to Scout
- [ ] Every Scout action (draft, confirm, cancel, execute) is logged in scout_action_logs
- [ ] Scout adapts its behavior based on the user's role (rep vs. leadership)
- [ ] Scout remembers user context within a session (conversation history works)
- [ ] Error states are handled gracefully — GHL outage, Claude outage, network errors

---

## 4. Phase 1b — Daily HQ Page

> **Goal:** Build the personalized daily dashboard. Reps see exactly what they need to do today.
> Leadership can view any rep or aggregate data.

### Tasks

- [ ] Build the Daily HQ page layout — grid layout with scorecard, alerts, tasks, pipeline, upcoming
- [ ] Build the rep scorecard component — today's calls, texts, emails, stage moves, new leads contacted
- [ ] Build the backend endpoint for rep scorecard data — aggregate from GHL activity for the current day
- [ ] Build the alerts panel component — list of active alerts sorted by severity
- [ ] Build the alert card component — severity indicator (color + icon), message, timestamp, link
- [ ] Build the backend endpoint for active alerts — query inactivity_alerts where is_resolved = false
- [ ] Build the tasks list component — today's tasks from GHL with checkbox completion
- [ ] Implement task completion — checking a task updates it in GHL as completed
- [ ] Build the pipeline snapshot component — horizontal bar chart showing lead count per stage
- [ ] Build the backend endpoint for pipeline snapshot — aggregate opportunities by stage from GHL
- [ ] Build the upcoming section component — scheduled calls and follow-ups for next 48 hours
- [ ] Build the backend endpoint for upcoming items — query GHL appointments + tasks due in 48 hours
- [ ] Implement the leadership dropdown — select "All Reps" or a specific rep to view their dashboard
- [ ] Implement leadership aggregate view — combined scorecard and pipeline across all reps
- [ ] Implement click-through navigation — click an alert or task to open Scout AI with context
- [ ] Implement auto-refresh — refresh data on page load and every 5 minutes
- [ ] Implement responsive layout — 2-column grid on desktop, single column on mobile

### Definition of Done — Phase 1b

- [ ] A rep sees their personalized Daily HQ with real data from GHL
- [ ] Scorecard shows accurate counts of today's activity (calls, texts, emails, moves)
- [ ] Alerts panel shows all unresolved accountability alerts for the rep
- [ ] Task list shows today's tasks from GHL — checking a task marks it complete in GHL
- [ ] Pipeline snapshot shows the correct lead count per stage
- [ ] Upcoming section shows scheduled events for the next 48 hours
- [ ] Leadership can switch between "All Reps" view and individual rep views
- [ ] Page refreshes data automatically every 5 minutes
- [ ] Clicking an alert or task navigates to Scout AI with relevant context

---

## 5. Phase 1c — Accountability Engine

> **Goal:** Deploy the background job system that monitors the GHL pipeline and enforces
> accountability rules. This runs independently of user sessions.

### Tasks

- [ ] Set up the cron job system (node-cron or Railway cron)
- [ ] Implement Speed-to-Lead Monitor — runs every 1 minute
- [ ] Implement Stale Lead Check — runs every 15 minutes
- [ ] Implement Attempted Contact Sequence Check — runs every 1 hour
- [ ] Implement Discovery Call Follow-Up Check — runs every 1 hour
- [ ] Implement No-Show Tracker — runs every 30 minutes
- [ ] Implement Validation Staleness Check — runs every 4 hours
- [ ] Implement FDD Window Tracker — runs every 1 hour
- [ ] Implement Closing Stall Detector — runs every 2 hours
- [ ] Implement Nurture Archive — runs daily at 6:00 AM
- [ ] Implement Daily Rep Scorecard — runs daily at 6:00 PM
- [ ] Implement Weekly Pipeline Report — runs weekly on Monday at 8:00 AM
- [ ] Implement alert severity levels — low, medium, high, critical
- [ ] Implement alert generation — write to inactivity_alerts table
- [ ] Implement Slack webhook notifications for critical alerts (optional)
- [ ] Implement stage move blocking — API rejects moves that violate pipeline rules
- [ ] Implement lost reason enforcement — API rejects Lost/Nurture moves without a reason
- [ ] Add job execution logging — log when each job runs, how many alerts it generates, errors

### Definition of Done — Phase 1c

- [ ] All 11 accountability jobs are running on their defined schedules
- [ ] A new lead that isn't contacted within 5 minutes generates a speed-to-lead alert
- [ ] Alerts appear in the Daily HQ alerts panel
- [ ] Stage move violations are blocked with a clear error message
- [ ] Moving to Lost/Nurture requires a lost reason — API rejects without one
- [ ] Daily rep scorecard is generated at 6:00 PM and available in Daily HQ
- [ ] Weekly pipeline report is generated on Monday at 8:00 AM
- [ ] Job execution is logged (for debugging and monitoring)

---

## 6. Phase 2a — Pipeline Board

> **Goal:** Build the visual Kanban-style pipeline board for managing leads across stages.

### Tasks

- [ ] Build the pipeline board page layout — horizontal scrolling columns
- [ ] Build the stage column component — header with stage name and lead count
- [ ] Build the lead card component — name, score badge, alert indicator, days in stage
- [ ] Implement drag-and-drop between columns using @dnd-kit
- [ ] Implement stage move validation on drag — enforce entry/exit criteria
- [ ] Implement Draft → Review → Confirm flow triggered by drag-and-drop
- [ ] Build filter controls — by rep, score tier, alert status, lead source
- [ ] Build search bar — find leads by name, email, or phone
- [ ] Implement click-through — click a lead card to open lead profile
- [ ] Implement real-time updates — board reflects GHL changes
- [ ] Implement responsive layout — horizontal scroll on tablet, stacked on mobile

### Definition of Done — Phase 2a

- [ ] Pipeline board displays all active leads in correct stage columns
- [ ] Lead cards show name, score, alert status, and time in stage
- [ ] Drag-and-drop moves a lead to a new stage (with confirmation flow)
- [ ] Stage move validation prevents invalid moves
- [ ] Filters work correctly (by rep, score, alert, source)
- [ ] Clicking a card opens the lead profile page

---

## 7. Phase 2b — Leadership Dashboard & Lead Profile

> **Goal:** Build the leadership analytics dashboard and the detailed lead profile page.

### Tasks

- [ ] Build the leadership dashboard page layout — KPI cards, funnel, leaderboard, tables
- [ ] Build KPI card components — active leads, won, avg days, conversion rate, with trend arrows
- [ ] Build pipeline funnel visualization using Recharts
- [ ] Build rep leaderboard table — sortable columns
- [ ] Build lead source ROI table
- [ ] Build stage velocity report
- [ ] Build conversion rate by stage chart
- [ ] Implement time period selector — week, month, quarter, custom
- [ ] Implement rep selector — all reps or specific rep
- [ ] Implement CSV export for reports
- [ ] Build the lead profile page — contact info, qualification summary, score breakdown
- [ ] Build the activity timeline component — chronological log of all lead activity
- [ ] Build the Scout action history component — past Scout actions for this lead
- [ ] Build quick action buttons — Call, Text, Email (triggers Scout draft flow)
- [ ] Build notes section — view and add notes synced to GHL
- [ ] Build task list — view and manage tasks for this lead
- [ ] Build "Ask Scout about this lead" button
- [ ] Implement lead stage history visualization

### Definition of Done — Phase 2b

- [ ] Leadership sees KPI cards with accurate real-time data and trend indicators
- [ ] Pipeline funnel chart renders correctly with proper stage-to-stage drop-off
- [ ] Rep leaderboard shows all reps with sortable performance metrics
- [ ] Lead profile shows full contact details, qualification data, and score breakdown
- [ ] Activity timeline shows all historical activity for a lead
- [ ] Quick action buttons launch the Scout draft flow
- [ ] Reports can be exported to CSV

---

## 8. Phase 3 — Future

> **Goal:** Advanced capabilities, voice mode, predictive analytics, mobile, and multi-franchise.
> These are planned but not yet scheduled for development.

### Modules

- [ ] **Scout Voice Mode** — full voice conversation, call recording analysis, TTS
- [ ] **Predictive Analytics** — win probability, revenue forecast, at-risk detection
- [ ] **Advanced Scout Intelligence** — pattern learning, coaching, strategy memos
- [ ] **Multi-Franchise Scaling** — multi-brand support, white-labeling
- [ ] **Advanced Integrations** — DocuSign, Calendly, QuickBooks, Slack deep
- [ ] **Mobile App** — React Native or PWA with push notifications

---

## 9. Working with Claude Code

The NAH Franchise OS is designed to be built with AI-assisted development using Claude Code.
Here are the guidelines for working effectively:

### Before Starting Any Work

1. **Read the docs first.** Before building any feature, read the relevant documentation:
   - CLAUDE.md for Scout behavior rules
   - architecture.md for system design decisions
   - pipeline.md for business logic
   - design.md for visual implementation details
   - This build plan for scope and priority

2. **Read the code.** Before modifying any file, read it first. Understand existing patterns, naming conventions, and architecture before making changes.

3. **Follow existing patterns.** If the codebase already has a pattern for something (API routes, components, services), follow that pattern. Don't introduce a new way to do something that already has a convention.

### During Development

4. **One feature at a time.** Complete one feature end-to-end before starting the next. Don't leave half-built features in the codebase.

5. **Type safety is non-negotiable.** TypeScript strict mode is on. `npx tsc --noEmit` must return 0 errors before any push. No `any` types unless absolutely unavoidable (and documented with a comment explaining why).

6. **No hardcoded secrets.** Every API key, token, and credential must come from `process.env`. If you see a hardcoded secret, it's a bug — fix it immediately.

7. **GHL is the source of truth.** Never cache GHL data locally. Never write to GHL without the Draft → Review → Confirm pattern. If you need GHL data, call the GHL service — don't store a local copy.

8. **Test the happy path and the error path.** Every API integration should handle success, auth failure, not found, rate limiting, and server errors. Every user interaction should handle loading, success, and error states.

### Code Quality

9. **Keep it simple.** Don't over-engineer. If a simple function works, don't wrap it in a class. If three lines of code are clear, don't abstract them into a utility.

10. **Name things clearly.** `getContactById` is better than `fetchData`. `ScoutChatBubble` is better than `Bubble`. Code should read like documentation.

11. **Comments explain why, not what.** Don't comment `// increment counter` above `counter++`. Do comment `// GHL requires the timezone in the appointment payload even though their docs say it's optional`.

### Review & Deploy

12. **PR reviews are mandatory.** No direct pushes to main. Every change goes through a pull request with at least one reviewer.

13. **Type check before pushing.** Run `npx tsc --noEmit` before every push. This is a hard requirement.

14. **Test in staging first.** If a staging environment is available, deploy there before production. At minimum, test locally with real API keys against the GHL sandbox.

---

## 10. Launch Definition of Done

The NAH Franchise OS is ready for launch when ALL of the following are true:

### Functional Requirements

- [ ] A rep can log in and see the Scout AI page and Daily HQ page
- [ ] Scout can read live GHL data and respond contextually
- [ ] Scout can draft messages, tasks, and stage moves — and execute them after confirmation
- [ ] Voice input works end-to-end (record → transcribe → submit to Scout)
- [ ] Daily HQ shows accurate, real-time data (scorecard, alerts, tasks, pipeline, upcoming)
- [ ] The accountability engine is running and generating alerts
- [ ] Stage move blocking works (prevents invalid moves)
- [ ] All three roles (rep, marketing, leadership) see appropriate content and permissions

### Technical Requirements

- [ ] `npx tsc --noEmit` returns 0 errors
- [ ] No hardcoded secrets in the codebase
- [ ] All environment variables configured on Vercel and Railway
- [ ] Health check endpoint returns 200 with all services connected
- [ ] Frontend loads in under 3 seconds on a standard connection
- [ ] Authentication works — login, session, logout, refresh, route protection
- [ ] CORS is configured correctly — only the frontend domain is allowed
- [ ] Rate limiting is configured on all API endpoints
- [ ] Error tracking is configured (Sentry or equivalent)
- [ ] Structured logging is in place on the backend

### Security Requirements

- [ ] Passwords hashed with bcrypt (12+ rounds)
- [ ] JWTs have proper expiry (1 hour access, 7 day refresh)
- [ ] GHL tokens are encrypted at rest
- [ ] RLS is enabled on all database tables
- [ ] Prompt injection defenses are in place (sanitization + Scout instructions)
- [ ] No PII is logged in plain text
- [ ] Failed login lockout works (5 attempts → 30-minute cooldown)

### Data Requirements

- [ ] At least one admin user exists in the database
- [ ] Default app_settings are configured
- [ ] Starter knowledge base documents are loaded (NAH brand, pipeline, objections)
- [ ] GHL OAuth tokens are stored and auto-refreshing

---

## 11. Timeline Estimate

| Phase | Scope | Estimated Duration |
|-------|-------|--------------------|
| **Phase 0 — Foundation** | Project setup, database, auth, app shell, deployment | 1–2 weeks |
| **Phase 1a — Scout AI** | Chat interface, GHL integration, Claude integration, voice, action flow | 3–4 weeks |
| **Phase 1b — Daily HQ** | Dashboard, scorecard, alerts, tasks, pipeline snapshot | 1–2 weeks |
| **Phase 1c — Accountability Engine** | Background jobs, alert generation, stage blocking | 1–2 weeks |
| **MVP Launch** | Phase 0 + 1a + 1b + 1c complete | **6–10 weeks total** |
| **Phase 2a — Pipeline Board** | Kanban board, drag-and-drop, filters | 2–3 weeks |
| **Phase 2b — Leadership Dashboard + Lead Profile** | Analytics, visualizations, lead detail page | 3–4 weeks |
| **Phase 2 Complete** | All Phase 2 features shipped | **5–7 weeks after MVP** |
| **Phase 3 — Future** | Voice mode, predictions, mobile, multi-brand | TBD — ongoing |

**Important:** These estimates assume a small team (1–3 developers) working full-time.
Timelines will vary based on team size, experience, and scope changes. The estimates are
optimistic — add buffer for unknowns, API issues, and design iteration.
