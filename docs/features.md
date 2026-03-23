# NAH Franchise OS — Feature List

> This document is the complete feature inventory for the New Again Houses Franchise OS.
> Features are organized by build phase and tagged by the role(s) that use them.
> Phase 1 is the MVP. Phase 2 extends the platform. Phase 3 is the future vision.

---

## Role Key

| Tag | Role |
|-----|------|
| `[Rep]` | Franchise development rep |
| `[Mktg]` | Marketing team member |
| `[Lead]` | Leadership / management |
| `[All]` | All roles |
| `[System]` | Backend / automated — no direct user interaction |

---

## Phase 1 — MVP

> **Goal:** Ship two pages — Scout AI and Daily HQ — that make reps measurably faster at working their pipeline. Everything in Phase 1 must work end-to-end with live GHL data.

### 1.1 Authentication & Authorization

- [ ] Email + password login `[All]`
- [ ] JWT-based session management with HTTP-only secure cookies `[System]`
- [ ] Role-based access control — rep, marketing, leadership `[System]`
- [ ] Password hashing with bcrypt (12+ salt rounds) `[System]`
- [ ] Login rate limiting — lockout after 5 failed attempts (30-minute cooldown) `[System]`
- [ ] Session expiry — 1-hour JWT, 7-day refresh token `[System]`
- [ ] Redirect unauthenticated users to login page `[System]`
- [ ] Role-based route protection — users cannot access pages outside their role permissions `[System]`
- [ ] User profile page with name, email, and password change `[All]`

### 1.2 App Shell & Navigation

- [ ] Dark mode app shell — sidebar + top bar + main content area `[All]`
- [ ] Sidebar navigation with role-based menu items `[All]`
- [ ] Sidebar collapse to icon-only mode (desktop) `[All]`
- [ ] Sidebar slide-out drawer (mobile) `[All]`
- [ ] Top bar with logo, page title, and user avatar dropdown `[All]`
- [ ] User dropdown menu — profile, settings, logout `[All]`
- [ ] Responsive layout — desktop (1024px+), tablet (768–1024px), mobile (<768px) `[All]`
- [ ] Page transition animations (fade in) `[All]`

### 1.3 Scout AI Page

- [ ] Full-page chat interface with scrollable message history `[Rep]` `[Lead]`
- [ ] Text input with send button — fixed to bottom of chat area `[Rep]` `[Lead]`
- [ ] Voice input via Whisper API — mic button, waveform animation, transcription `[Rep]` `[Lead]`
- [ ] Scout chat bubbles (left-aligned, purple tint, Scout avatar) `[Rep]` `[Lead]`
- [ ] User chat bubbles (right-aligned, dark background) `[Rep]` `[Lead]`
- [ ] Scout "thinking" indicator (animated purple dots) `[Rep]` `[Lead]`
- [ ] Session management — new session, session history, session dividers `[Rep]` `[Lead]`
- [ ] Scout responds with contextual, role-appropriate answers `[Rep]` `[Lead]`
- [ ] Scout reads live GHL data — contacts, pipeline, tasks, appointments `[System]`
- [ ] Scout tool calls — get_contact, search_contacts, get_pipeline, get_schedule `[System]`
- [ ] Scout drafts messages (SMS/email) for user review `[Rep]` `[Lead]`
- [ ] Scout drafts tasks for user review `[Rep]` `[Lead]`
- [ ] Scout drafts pipeline stage moves for user review `[Rep]` `[Lead]`
- [ ] Drafted action cards with Edit / Confirm / Cancel buttons `[Rep]` `[Lead]`
- [ ] Edit mode on drafted actions — user can modify content before confirming `[Rep]` `[Lead]`
- [ ] Execute confirmed actions in GHL via API `[System]`
- [ ] Log all Scout actions (drafted, confirmed, cancelled, executed) to scout_action_logs `[System]`
- [ ] Scout system prompt assembly — identity, knowledge, user context, current data, tools, rules `[System]`
- [ ] Scout memory per user — stores preferences, patterns, context between sessions `[System]`
- [ ] Scout knowledge base injection — franchise knowledge loaded into system prompt `[System]`
- [ ] Token budget management — dynamic prompt sections truncated if exceeding limits `[System]`
- [ ] Conversation history sliding window — keep recent 20 messages + summary of older `[System]`
- [ ] Role-based Scout behavior — adapts tone, available actions, and data scope by role `[System]`
- [ ] Prompt injection defense — sanitize GHL data, ignore instructions in contact notes `[System]`
- [ ] Lead scoring display — Scout references and explains lead scores in responses `[Rep]` `[Lead]`

### 1.4 Daily HQ Page

- [ ] Personalized daily dashboard — shows data for the logged-in rep `[Rep]`
- [ ] Leadership mode — dropdown to view all reps or a specific rep `[Lead]`
- [ ] Rep scorecard — today's calls, texts, emails, stage moves, new leads contacted `[Rep]` `[Lead]`
- [ ] Alerts panel — active accountability alerts sorted by severity `[Rep]` `[Lead]`
- [ ] Alert cards with severity indicator (critical, warning, info) and description `[Rep]` `[Lead]`
- [ ] Today's tasks list — pulled from GHL, with checkbox completion `[Rep]`
- [ ] Task completion updates GHL via API `[System]`
- [ ] Pipeline snapshot — horizontal bar chart showing lead count per stage `[Rep]` `[Lead]`
- [ ] Upcoming section — scheduled calls and follow-ups for the next 48 hours `[Rep]` `[Lead]`
- [ ] Click-through from alerts and tasks to Scout AI for action `[Rep]`
- [ ] Daily data auto-refresh on page load and every 5 minutes `[System]`

### 1.5 Accountability Engine (Background)

- [ ] Speed-to-lead monitor — alert if new lead not contacted within 5 minutes `[System]`
- [ ] Stale lead check — alert if lead in New Lead stage for 1+ hour `[System]`
- [ ] Attempted contact sequence check — flag leads approaching 7-day window with fewer than 6 attempts `[System]`
- [ ] Discovery call follow-up — flag Connected/Qualified leads with no discovery call scheduled after 48 hours `[System]`
- [ ] No-show tracker — detect missed discovery calls `[System]`
- [ ] Validation staleness check — flag leads in Validation for 10+ days with no rep activity `[System]`
- [ ] FDD window tracker — countdown timer, engagement monitoring, window completion notification `[System]`
- [ ] Closing stall detector — flag no activity in In Closing for 3+ consecutive days `[System]`
- [ ] Nurture archive — auto-archive after 90 days with zero engagement `[System]`
- [ ] Daily rep scorecard generation (6:00 PM) `[System]`
- [ ] Weekly pipeline report generation (Monday 8:00 AM) `[System]`
- [ ] Alert storage in inactivity_alerts table `[System]`
- [ ] Alert severity levels — low, medium, high, critical `[System]`
- [ ] Stage move blocking — prevent premature moves that violate pipeline rules `[System]`
- [ ] Lost reason enforcement — block move to Lost/Nurture without a documented reason `[System]`

### 1.6 GHL Integration Layer

- [ ] Centralized GHL service with rate limiting, error handling, and token refresh `[System]`
- [ ] OAuth 2.0 token management — automatic refresh, encrypted storage `[System]`
- [ ] Contact CRUD operations via GHL API `[System]`
- [ ] Pipeline read and opportunity update via GHL API `[System]`
- [ ] Task CRUD operations via GHL API `[System]`
- [ ] Appointment read and create via GHL API `[System]`
- [ ] Messaging (SMS/email) via GHL API `[System]`
- [ ] Note read and create via GHL API `[System]`
- [ ] Workflow trigger via GHL API `[System]`
- [ ] Error handling — 401 refresh, 404 graceful, 429 backoff, 500 fallback `[System]`
- [ ] Request/response logging for debugging and audit `[System]`

### 1.7 Database Setup

- [ ] Supabase PostgreSQL provisioning `[System]`
- [ ] users table — accounts, roles, GHL user mapping `[System]`
- [ ] user_memory table — Scout's learned context per user `[System]`
- [ ] sessions table — conversation history and session tracking `[System]`
- [ ] scout_action_logs table — immutable audit log of all Scout actions `[System]`
- [ ] knowledge_documents table — franchise knowledge base content `[System]`
- [ ] app_settings table — configuration, feature flags, encrypted tokens `[System]`
- [ ] inactivity_alerts table — accountability engine alerts `[System]`
- [ ] All indexes per architecture.md spec `[System]`
- [ ] Row Level Security (RLS) policies on all tables `[System]`
- [ ] Seed data — initial admin user, default settings, starter knowledge base content `[System]`

---

## Phase 2 — Platform Expansion

> **Goal:** Add visual pipeline management, individual lead profiles, leadership analytics, and knowledge base management. Turn the OS into a full-featured operations platform.

### 2.1 Pipeline Board

- [ ] Kanban-style board with one column per pipeline stage `[Rep]` `[Lead]`
- [ ] Lead cards showing name, score, alert status, and days in stage `[Rep]` `[Lead]`
- [ ] Drag-and-drop to move leads between stages `[Rep]` `[Lead]`
- [ ] Drag-and-drop triggers Draft → Review → Confirm flow via Scout `[Rep]` `[Lead]`
- [ ] Stage validation — enforce entry/exit criteria before allowing moves `[System]`
- [ ] Filter by rep (leadership only) `[Lead]`
- [ ] Filter by score tier (Hot, Warm, Cool, Cold) `[Rep]` `[Lead]`
- [ ] Filter by alert status (critical, warning, clear) `[Rep]` `[Lead]`
- [ ] Filter by lead source `[Rep]` `[Lead]`
- [ ] Search bar — find a lead by name, email, or phone `[Rep]` `[Lead]`
- [ ] Lead count per stage in column header `[Rep]` `[Lead]`
- [ ] Color-coded alert indicators on lead cards (red, yellow, green) `[Rep]` `[Lead]`
- [ ] Click card to open lead profile `[Rep]` `[Lead]`
- [ ] Horizontal scroll for stages that don't fit on screen `[Rep]` `[Lead]`
- [ ] Real-time updates — board refreshes when GHL data changes `[System]`

### 2.2 Lead Profile Page

- [ ] Full lead profile with contact info, stage, score, source, and assigned rep `[Rep]` `[Lead]`
- [ ] Qualification summary — interest level, capital, territory, timeline, experience `[Rep]` `[Lead]`
- [ ] Lead score breakdown — visual bar for each scoring factor `[Rep]` `[Lead]`
- [ ] Activity timeline — chronological log of all calls, texts, emails, notes, and stage moves `[Rep]` `[Lead]`
- [ ] Scout action history — all actions Scout drafted, confirmed, or cancelled for this lead `[Rep]` `[Lead]`
- [ ] Quick action buttons — Call, Text, Email (triggers Scout draft flow) `[Rep]` `[Lead]`
- [ ] Notes section — view and add notes (synced to GHL) `[Rep]` `[Lead]`
- [ ] Task list — view and manage tasks for this lead (synced to GHL) `[Rep]` `[Lead]`
- [ ] Upcoming appointments for this lead `[Rep]` `[Lead]`
- [ ] Alert history for this lead `[Rep]` `[Lead]`
- [ ] Stage history — visual timeline of how the lead has moved through the pipeline `[Rep]` `[Lead]`
- [ ] "Ask Scout about this lead" button — opens Scout AI with lead context pre-loaded `[Rep]` `[Lead]`

### 2.3 Leadership Dashboard

- [ ] KPI cards — active leads, won this month, avg days to close, conversion rate `[Lead]`
- [ ] Trend indicators on KPIs (up/down arrow + delta vs. last period) `[Lead]`
- [ ] Pipeline funnel visualization — bar chart showing lead count and drop-off per stage `[Lead]`
- [ ] Rep leaderboard — table showing each rep's leads, calls, moves, wins, and performance score `[Lead]`
- [ ] Lead source ROI table — leads, cost per lead, conversion rate, and revenue per source `[Lead]` `[Mktg]`
- [ ] Active alerts summary — count by severity with link to full alerts view `[Lead]`
- [ ] Stage velocity report — average days spent in each stage `[Lead]`
- [ ] Conversion rate by stage — percentage of leads that advance vs. drop off at each stage `[Lead]`
- [ ] Time period selector — this week, this month, this quarter, custom range `[Lead]`
- [ ] Rep selector — view data for all reps or drill into a specific rep `[Lead]`
- [ ] Won deals detail — list of recently signed franchisees with deal data `[Lead]`
- [ ] Lost lead analysis — lost reasons breakdown by stage and source `[Lead]`
- [ ] Export reports to CSV `[Lead]`

### 2.4 Knowledge Base Manager

- [ ] View all knowledge documents organized by category `[Lead]`
- [ ] Create new knowledge documents `[Lead]`
- [ ] Edit existing knowledge documents `[Lead]`
- [ ] Delete knowledge documents `[Lead]`
- [ ] Document categories: brand, pipeline, objections, competitors, industry, fdd `[Lead]`
- [ ] Priority ordering — higher priority documents are included in Scout's prompt first `[Lead]`
- [ ] Token count display — shows estimated token usage per document `[Lead]`
- [ ] Active/inactive toggle — control which documents are included in Scout's prompt `[Lead]`
- [ ] Preview mode — see how the document will appear in Scout's context `[Lead]`
- [ ] Bulk import — upload multiple documents at once `[Lead]`

### 2.5 Campaign Analytics (Marketing)

- [ ] Lead source performance dashboard `[Mktg]` `[Lead]`
- [ ] Leads by source over time (line chart) `[Mktg]` `[Lead]`
- [ ] Conversion rate by source `[Mktg]` `[Lead]`
- [ ] Cost per lead by source (requires manual cost input) `[Mktg]`
- [ ] Lead quality distribution by source (score tier breakdown) `[Mktg]` `[Lead]`
- [ ] Campaign tagging — tag leads with campaign identifiers in GHL `[Mktg]`
- [ ] Campaign comparison view — side-by-side performance of two campaigns `[Mktg]`

### 2.6 User Management

- [ ] View all users with role, status, and last login `[Lead]`
- [ ] Create new user accounts `[Lead]`
- [ ] Edit user accounts — name, email, role, active/inactive status `[Lead]`
- [ ] Deactivate user accounts (soft delete — never hard delete) `[Lead]`
- [ ] Reset user passwords `[Lead]`
- [ ] Link users to GHL user IDs for lead assignment mapping `[Lead]`
- [ ] Activity log per user — logins, Scout usage, actions taken `[Lead]`

### 2.7 Notification System

- [ ] In-app notification bell with unread count `[All]`
- [ ] Notification drawer — list of recent notifications `[All]`
- [ ] Notification types: alerts, task reminders, stage moves, system messages `[All]`
- [ ] Click notification to navigate to relevant context `[All]`
- [ ] Mark as read / mark all as read `[All]`
- [ ] Slack webhook integration for critical alerts `[System]`
- [ ] Email notification for high/critical alerts (optional, configurable) `[System]`

### 2.8 Migration Tool

- [ ] Import existing GHL contacts into the pipeline tracking system `[Lead]`
- [ ] Map GHL pipeline stages to NAH pipeline stages `[Lead]`
- [ ] Validate imported data — flag contacts missing required fields `[System]`
- [ ] Generate migration report — imported, skipped, errored contacts `[Lead]`
- [ ] Dry-run mode — preview migration results without executing `[Lead]`

---

## Phase 3 — Future Vision

> **Goal:** Advanced capabilities that extend Scout's intelligence, add voice interactions,
> enable multi-franchise scaling, and introduce predictive analytics.

### 3.1 Scout Voice Mode

- [ ] Full voice conversation with Scout — speak and listen `[Rep]`
- [ ] Real-time voice-to-text (Whisper) and text-to-voice (TTS) pipeline `[System]`
- [ ] Hands-free mode for reps on the go `[Rep]`
- [ ] Voice command recognition — "Scout, text James Miller" `[Rep]`
- [ ] Call recording integration — upload call recordings for Scout to analyze `[Rep]`
- [ ] Post-call auto-summary from call recordings `[Rep]` `[Lead]`

### 3.2 Predictive Analytics

- [ ] Win probability score per lead — ML model based on historical pipeline data `[System]`
- [ ] Predicted close date per lead `[Rep]` `[Lead]`
- [ ] Pipeline revenue forecast — projected franchise fees based on win probabilities `[Lead]`
- [ ] Monthly/quarterly forecast dashboard `[Lead]`
- [ ] Lead source ROI prediction — which sources will perform best next month `[Mktg]` `[Lead]`
- [ ] At-risk deal detection — flag deals likely to stall before they stall `[System]`
- [ ] Optimal follow-up timing — suggest the best time to contact each lead `[Rep]`

### 3.3 Advanced Scout Intelligence

- [ ] Scout learns from won deals — identifies patterns in successful conversions `[System]`
- [ ] Scout suggests personalized objection responses based on lead profile `[Rep]`
- [ ] Scout auto-generates weekly strategy memos for leadership `[Lead]`
- [ ] Scout provides real-time coaching during calls (with call integration) `[Rep]`
- [ ] Multi-turn complex workflows — Scout guides reps through multi-step processes `[Rep]`
- [ ] Scout suggests A/B test variations for outreach messages `[Rep]` `[Mktg]`

### 3.4 Multi-Franchise Scaling

- [ ] Multi-brand support — one platform, multiple franchise brands `[Lead]`
- [ ] Brand-specific Scout knowledge bases `[Lead]`
- [ ] Brand-specific pipeline configurations `[Lead]`
- [ ] Cross-brand reporting for parent company view `[Lead]`
- [ ] White-label mode — customize branding per franchise brand `[Lead]`

### 3.5 Advanced Integrations

- [ ] Calendly / Acuity integration for discovery call scheduling `[System]`
- [ ] DocuSign integration for franchise agreement signing `[System]`
- [ ] QuickBooks / Stripe integration for fee tracking `[System]`
- [ ] Slack deep integration — two-way communication with Scout via Slack `[All]`
- [ ] SMS/email reply tracking — see lead responses in the app `[Rep]` `[Lead]`
- [ ] Territory map visualization — interactive map showing available territories `[Rep]` `[Lead]`

### 3.6 Mobile App

- [ ] Native mobile app (React Native or PWA) `[All]`
- [ ] Push notifications for alerts and reminders `[All]`
- [ ] Scout chat optimized for mobile `[Rep]`
- [ ] Quick actions from lock screen / notifications `[Rep]`
- [ ] Offline mode — queue actions when offline, sync when reconnected `[System]`

---

## Feature Count Summary

| Phase | Features | Priority |
|-------|----------|----------|
| **Phase 1 — MVP** | ~80 features across 7 modules | Must have — ship first |
| **Phase 2 — Expansion** | ~60 features across 8 modules | Should have — ship second |
| **Phase 3 — Future** | ~35 features across 6 modules | Nice to have — long-term roadmap |
| **Total** | ~175 features | — |
