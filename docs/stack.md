# NAH Franchise OS — Tech Stack Decisions

> This document tracks all technology decisions for the NAH Franchise OS.
> Some decisions are confirmed by the product owner. Others are recommendations
> that the dev team should evaluate and finalize during Phase 0.

---

## 1. Confirmed Decisions

These have been decided and are non-negotiable. Do not change these without product owner approval.

| Decision | Choice | Reason |
|----------|--------|--------|
| **Frontend Framework** | Next.js (React) | Industry-standard React framework with SSR, routing, and easy Vercel deployment. Large ecosystem. |
| **Frontend Language** | TypeScript | Type safety prevents bugs, improves developer experience, and makes the codebase self-documenting. |
| **CSS Framework** | Tailwind CSS | Utility-first approach is fast to build with, easy to maintain, and works perfectly with dark mode design systems. |
| **Backend Runtime** | Node.js | Same language (TypeScript) for frontend and backend. Huge ecosystem. Easy to hire for. |
| **Backend Framework** | Express.js | Battle-tested, minimal, flexible. Not over-engineered for our needs. |
| **Backend Language** | TypeScript | Same as frontend — type safety and consistency across the entire codebase. |
| **Database** | PostgreSQL | Relational data (users, roles, logs, settings) maps naturally to SQL. Best support for JSONB (conversation history, action logs). |
| **Database Host** | Supabase | Managed Postgres with connection pooling, RLS, realtime subscriptions, and a generous free tier. No infra management. |
| **CRM Integration** | GoHighLevel (GHL) API v2 | GHL is the existing CRM. The Franchise OS integrates with it — it does not replace it. GHL is the source of truth for all lead data. |
| **AI Engine** | Anthropic Claude API | Claude powers Scout. Selected for reasoning quality, tool-use reliability, and long-context capability. |
| **Voice Transcription** | OpenAI Whisper API | Best-in-class speech-to-text accuracy. Simple API. Well-documented. |
| **Lead Enrichment** | OpenClaw API | Provides supplementary lead data. Integrates alongside GHL, not instead of it. |
| **Authentication** | JWT + bcrypt | Standard token-based auth. JWTs for sessions, bcrypt for password hashing. No third-party auth provider needed for MVP. |
| **Frontend Hosting** | Vercel | Zero-config Next.js deployment. Global CDN. Automatic HTTPS. Git push = deploy. |
| **Backend Hosting** | Railway | Simple container-based deployment. Environment variable management. Cron job support. Auto-deploy from git. |
| **Design System** | Dark mode only | Reps live in this app all day. Dark mode reduces eye strain. No light mode planned. |
| **Primary Color** | NAH Orange `#E8431A` | Brand color. Used for CTAs, primary buttons, active states. |
| **Accent Color** | Scout Purple `#7C3AED` | Scout-specific UI. Chat bubbles, AI status indicators, action cards. |
| **Font** | Inter | Clean, modern, highly readable at all sizes. Excellent for data-dense interfaces. Free via Google Fonts. |

---

## 2. Pending Dev Team Decisions

These are recommendations that the dev team should evaluate during Phase 0 setup.
The product owner is flexible on these — the team should choose what works best for their workflow.

| Decision | Recommendation | Alternatives | Notes for Team |
|----------|---------------|-------------|----------------|
| **Component Library** | shadcn/ui | Radix UI (raw), Headless UI, build from scratch | shadcn/ui gives you accessible, unstyled components built on Radix UI that you style with Tailwind. Not a dependency — it copies components into your project. This means full control. If the team prefers raw Radix, that works too. |
| **State Management** | React Context + SWR | Zustand, Jotai, TanStack Query | Context for global state (auth, theme). SWR or TanStack Query for server data (leads, pipeline) with built-in caching and revalidation. Zustand is a good alternative if you want a dedicated store. Avoid Redux — too much boilerplate for this project. |
| **ORM / Query Builder** | Prisma | Drizzle ORM, Knex.js, raw SQL via pg | Prisma gives type-safe database access, auto-generated types, and migration management. Drizzle is lighter and closer to SQL if the team prefers that. Knex is fine too. Avoid raw SQL for anything beyond simple queries — type safety matters. |
| **HTTP Client** | axios | node-fetch, got, undici | axios is familiar, well-documented, and has good interceptor support for token refresh. Any HTTP client works — just pick one and use it everywhere. |
| **Validation** | Zod | Joi, Yup, class-validator | Zod is TypeScript-native and integrates well with Prisma and React Hook Form. Use it to validate all API inputs at the controller layer. |
| **Job Scheduler** | node-cron | Agenda, BullMQ, Railway Cron | node-cron is simple and in-process — good for MVP. If jobs need queuing, retries, or persistence, upgrade to BullMQ + Redis. Railway also offers native cron scheduling. |
| **Logging** | Pino | Winston, Bunyan, console.log | Pino is fast and outputs structured JSON. Good for Railway logs. Winston is fine too. Do NOT use console.log in production. |
| **Error Tracking** | Sentry | LogRocket, Datadog, none | Sentry is free for small teams. Add it early — finding bugs in production without error tracking is miserable. |
| **Testing Framework** | Vitest + Playwright | Jest + Cypress, Jest + Playwright | Vitest is fast and ESM-native — better fit with modern TypeScript than Jest. Playwright for E2E tests. Start with unit tests on the service layer, then add E2E tests for critical flows (login, Scout chat, action confirm). |
| **Package Manager** | pnpm | npm, yarn | pnpm is faster and more disk-efficient. npm is fine if the team prefers it. Avoid yarn unless the team already uses it. |
| **Monorepo vs. Separate Repos** | Monorepo (Turborepo) | Separate frontend + backend repos | Monorepo keeps shared types, configs, and dependencies in one place. Turborepo is recommended for build orchestration. Separate repos work but require more coordination for shared TypeScript types. |
| **Drag and Drop (Phase 2)** | @dnd-kit | react-beautiful-dnd (deprecated), react-dnd | @dnd-kit is the modern standard — accessible, performant, and actively maintained. react-beautiful-dnd is from Atlassian but is no longer maintained. |
| **Charts (Phase 2)** | Recharts | Nivo, Victory, Chart.js via react-chartjs-2 | Recharts is React-native and composable. Good for the dashboard visualizations. Nivo is more opinionated but produces beautiful charts out of the box. |
| **Form Library** | React Hook Form | Formik, native forms | React Hook Form is performant and integrates well with Zod for validation. Use it for login, settings, knowledge base editor, and any complex forms. |

---

## 3. Instructions for the Dev Team

### Getting Started

1. **Read all the docs.** Before writing any code, every team member should read:
   - [CLAUDE.md](../CLAUDE.md) — Scout's identity and behavior rules
   - [docs/architecture.md](architecture.md) — System architecture, data flow, database schema
   - [docs/pipeline.md](pipeline.md) — Franchise sales pipeline (business logic)
   - [docs/design.md](design.md) — Design system, colors, typography, components, wireframes
   - [docs/features.md](features.md) — Complete feature list by phase
   - [docs/integrations.md](integrations.md) — API details, endpoints, environment variables
   - [docs/build-plan.md](build-plan.md) — Phased build plan with checklists

2. **Make your "Pending Decisions" early.** During Phase 0, evaluate the recommendations in Section 2 above. Decide as a team and document your choices. Don't defer these — uncertainty about tooling creates friction throughout the project.

3. **Set up the development environment.** Follow the Phase 0 checklist in build-plan.md. Everyone should be able to:
   - Run the frontend locally (`npm run dev` or `pnpm dev`)
   - Run the backend locally (`npm run dev` or `pnpm dev`)
   - Connect to the Supabase database
   - Make a successful API call to GHL (sandbox or production)
   - Make a successful API call to Claude

### Architecture Rules

4. **GHL is the source of truth.** Never store a local copy of GHL data. Never write to GHL without user confirmation. The app database only stores app-specific data (users, memory, logs, settings, alerts, knowledge).

5. **All GHL calls go through the GHL service.** No controller or route should call the GHL API directly. The GHL service handles auth, rate limiting, error handling, and logging.

6. **All Claude calls go through the Scout agent controller.** No other part of the app should call the Claude API directly. The Scout agent controller handles prompt assembly, tool calls, and response processing.

7. **Separation of concerns:**
   - **Controllers** — handle HTTP requests, validate inputs, call services, return responses
   - **Services** — contain business logic, call external APIs, interact with the database
   - **Models / Prisma** — define database schema, handle queries
   - **Utils** — pure helper functions with no side effects

### TypeScript Rules

8. **Strict mode is on.** `"strict": true` in tsconfig.json. No exceptions.

9. **No `any` types.** If you absolutely must use `any` (e.g., a third-party library with bad types), add a comment explaining why. Use `unknown` when you genuinely don't know the type and narrow it with type guards.

10. **Shared types.** If using a monorepo, create a shared `types` package for types used by both frontend and backend (e.g., API request/response shapes, user roles, pipeline stages).

11. **Run `npx tsc --noEmit` before every push.** This is a hard requirement. Zero errors. No exceptions.

### Security Rules

12. **No hardcoded secrets.** Every API key, token, password, and credential comes from `process.env`. If you see a hardcoded secret — anywhere, ever — it's a critical bug.

13. **Encrypt sensitive database values.** GHL OAuth tokens and any other secrets stored in the database must be encrypted at rest using AES-256 with the `ENCRYPTION_KEY`.

14. **Sanitize all inputs.** Use Zod (or your chosen validator) on every API endpoint. Sanitize GHL data before injecting it into Scout's prompt. Parameterize all database queries.

15. **CORS lockdown.** The backend should only accept requests from the frontend domain. No wildcard CORS.

### Git Workflow

16. **Branch strategy:**
    - `main` — production deployments (auto-deploys to Vercel and Railway)
    - `dev` — integration branch for completed features
    - Feature branches — `feature/scout-chat`, `feature/daily-hq`, etc.
    - Bug fix branches — `fix/ghl-token-refresh`, etc.

17. **PR reviews are mandatory.** At least one approval required before merging to `dev`. Two approvals before merging to `main`.

18. **Commit messages:** Use conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`). Keep messages concise and descriptive.

### What Not to Do

19. **Don't build a light mode.** The app is dark mode only. Do not add a theme toggle. Do not create light mode variants.

20. **Don't build a custom CRM.** GHL is the CRM. Do not create screens for managing contacts, pipelines, or tasks outside of what's defined in the feature list. The app reads from and writes to GHL.

21. **Don't skip the confirmation flow.** Every action Scout takes in GHL goes through Draft → Review → Confirm. No shortcuts. No auto-send. No "trust Scout" mode. This is a product requirement.

22. **Don't over-engineer Phase 1.** The MVP is two pages: Scout AI and Daily HQ. Build them well. Ship them fast. Phase 2 features can wait — don't pre-build infrastructure for features that aren't in scope yet.

23. **Don't add features that aren't in the feature list.** If you think something is missing from [docs/features.md](features.md), raise it with the product owner. Don't build it speculatively.
