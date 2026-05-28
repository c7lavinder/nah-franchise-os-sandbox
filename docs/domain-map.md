# FranDev Domain Map

This map is the first stop before editing FranDev. It shows where each major responsibility lives and which boundaries to respect.

## Auth and base path

**Owns:** login/session restore, MasterSuite JWT cookie, route protection, `/frandev` base path.

- `middleware.ts`, `src/middleware.ts` — route protection / redirects.
- `lib/auth/session.ts` — server-side auth/session helpers.
- `lib/auth/cookies.ts` — cookie names/options.
- `lib/auth/api-fetch.ts` — client API wrapper for app routes.
- `lib/auth/AuthContext.tsx` — browser auth state and MasterSuite SSO restore.
- `app/api/auth/*` — login, CRM callback, current user.
- `lib/base-path.ts` — base path helpers.

Rules:
- Use `apiFetch` from client UI unless a route needs explicit `/frandev`/credentials handling.
- Keep `jwt` cookie compatibility with MasterSuite.
- Do not mix Vercel URL and `mastersuiteapp.com/frandev` assumptions in feature code.

## Scout

**Owns:** AI chat, prompt/context loading, tools, draft-review-confirm actions.

- `components/layout/ScoutFAB.tsx` — global Scout overlay.
- `app/(auth)/scout/page.tsx` — full Scout page.
- `app/api/scout/chat/route.ts`, `app/api/scout/chat-stream/route.ts` — chat APIs.
- `lib/scout/client.ts` — conversation loop and system prompt assembly.
- `lib/scout/tools.ts` — tool schemas.
- `lib/scout/tool-executor.ts` — tool execution.
- `lib/contacts/search-planner.ts` — canonical contact/prospect search query planning shared by search surfaces.
- `lib/scout/data-tools.ts` — structured data helpers.
- `lib/scout/prompt-loader.ts` — DB/code prompt loading.

Rules:
- Page-safe Scout changes should not mutate page state.
- Search and read tools should return links/context, not force navigation.
- Durable knowledge belongs in `knowledge_documents` via migrations/KB updater, not hardcoded prompt patches unless it is a permanent rule.

## Calls and call intelligence

**Owns:** recordings/transcripts, call detail pages, participant resolution, call AI generation, review packages, data-point extraction.

- `app/(auth)/calls/page.tsx` — calls list/upload UI.
- `app/(auth)/calls/[callId]/page.tsx` — call detail UI.
- `app/api/calls/create/route.ts` — create call shell.
- `app/api/calls/[callId]/upload/route.ts` — upload transcript/recording and participant resolution.
- `app/api/calls/[callId]/generate/route.ts` — AI generation/reanalysis.
- `lib/calls/resolve-participants.ts` — canonical participant/contact/journey matching.
- `lib/calls/classify.ts` — call type classification.
- `lib/calls/coach.ts` — call coaching/analysis logic.

Rules:
- Selected prospect/journey context wins over ambiguous transcript speaker extraction.
- Participant dedupe should key by user/contact ID before display name.
- Call upload should resolve prospect → journey → pipeline state before generation whenever possible.

## Pipeline and journeys

**Owns:** prospect/franchisee lifecycle state, pipeline stages, journey membership.

- `app/(auth)/pipeline/page.tsx` — pipeline UI.
- `app/(auth)/journeys/[journeyId]/page.tsx` — journey detail.
- `journeys`, `journey_contacts`, `journey_pipeline_states`, `pipeline_stages` — core DB tables.
- `app/api/contacts/search/route.ts` — lightweight authenticated person/prospect search.

Rules:
- Journeys are the primary context for a prospect/franchisee in FranDev.
- Contacts can appear in multiple contexts; user-facing language should prefer prospect/candidate/franchisee/person over generic “contact” when possible.

## MasterSuite sync

**Owns:** sync from MasterSuite MySQL into FranDev/Supabase mirrors.

- `lib/mastersuite/client.ts` — MySQL client.
- `lib/mastersuite/cron-helpers.ts` — cron auth/helpers.
- `lib/mastersuite/health.ts` — non-heavy env/connection health checks.
- `lib/mastersuite/sync-health.ts` — canonical MasterSuite/GHL sync health summarization for Mission Control/admin status.
- `lib/mastersuite/sync-*.ts` — sync jobs.
- `scripts/run-ms-sync.ts`, `scripts/sync-mastersuite.ts` — manual runners.
- `app/api/cron/sync-ms-*` — Vercel cron endpoints.
- `vercel.json` — 30-minute/staggered schedules.

Rules:
- Vercel cron is the source of scheduled sync; local machine is not required.
- Do not store MasterSuite DB secrets in docs/memory.
- Heavy sync endpoints should be tested intentionally, not as part of default smoke checks.

## GHL and workflows

**Owns:** GHL OAuth/PIT client, tasks, notes, calendars, workflow actions.

- `lib/ghl/*` — GHL client and custom field helpers.
- `app/api/auth/crm/*` — CRM OAuth connection.
- `app/api/webhooks/ghl/route.ts` — GHL inbound webhook.
- `lib/workflows/*`, `app/(auth)/workflows/*`, `app/api/workflows/*` — workflow engine.

Rules:
- Keep draft-review-confirm for external actions.
- Do not auto-send SMS/email or change external systems without explicit approval path.

## Knowledge/retrieval

**Owns:** durable operating knowledge used by Scout and call intelligence.

- `knowledge_documents` — durable KB source.
- `lib/rag/embedder.ts` — embedding/indexing.
- `app/api/knowledge/route.ts` — KB CRUD.
- `lib/scout/client.ts` — loads active KB docs into Scout context.

Rules:
- Permanent business corrections should be KB docs/migrations.
- Re-embed docs when content changes if retrieval quality depends on vector search.
