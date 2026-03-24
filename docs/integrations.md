# NAH Franchise OS — Integrations & Tech Stack

> This document covers every external service, API, and technology the NAH Franchise OS
> integrates with. It includes setup instructions, endpoint references, authentication
> details, and the complete list of environment variables.

---

## 1. GoHighLevel (GHL) API

GHL is the CRM and source of truth for all lead, pipeline, task, appointment, and messaging data.
The Franchise OS reads from and writes to GHL — it does not duplicate or replace it.

### API Overview

| Property | Value |
|----------|-------|
| **Base URL** | `https://services.leadconnectorhq.com` |
| **API Version** | v2 |
| **Auth Method** | OAuth 2.0 (agency or sub-account level) |
| **Rate Limit** | Varies by endpoint — generally 100 requests/minute per location |
| **Response Format** | JSON |
| **Documentation** | https://highlevel.stoplight.io/docs/integrations |

### OAuth 2.0 Setup

**Step 1 — Register a Marketplace App**
1. Go to the GHL Marketplace Developer portal
2. Create a new app — select "Agency" or "Sub-Account" level depending on your setup
3. Set the redirect URI to: `{BACKEND_URL}/api/auth/ghl/callback`
4. Request the following scopes:
   - `contacts.readonly`
   - `contacts.write`
   - `opportunities.readonly`
   - `opportunities.write`
   - `calendars.readonly`
   - `calendars.write`
   - `calendars/events.readonly`
   - `calendars/events.write`
   - `conversations.readonly`
   - `conversations.write`
   - `conversations/message.readonly`
   - `conversations/message.write`
   - `workflows.readonly`
   - `locations.readonly`
   - `users.readonly`

**Step 2 — OAuth Flow**
1. Redirect the admin to GHL's authorization URL:
   ```
   https://marketplace.gohighlevel.com/oauth/chooselocation
     ?response_type=code
     &redirect_uri={BACKEND_URL}/api/auth/ghl/callback
     &client_id={GHL_CLIENT_ID}
     &scope=contacts.readonly contacts.write opportunities.readonly ...
   ```
2. User authorizes → GHL redirects to your callback with a `code` parameter
3. Exchange the code for access + refresh tokens:
   ```
   POST https://services.leadconnectorhq.com/oauth/token
   Content-Type: application/x-www-form-urlencoded

   client_id={GHL_CLIENT_ID}
   &client_secret={GHL_CLIENT_SECRET}
   &grant_type=authorization_code
   &code={authorization_code}
   &redirect_uri={BACKEND_URL}/api/auth/ghl/callback
   ```
4. Store the access token and refresh token encrypted in the `app_settings` table
5. Access tokens expire after ~24 hours — refresh automatically before expiry

**Step 3 — Token Refresh**
```
POST https://services.leadconnectorhq.com/oauth/token
Content-Type: application/x-www-form-urlencoded

client_id={GHL_CLIENT_ID}
&client_secret={GHL_CLIENT_SECRET}
&grant_type=refresh_token
&refresh_token={stored_refresh_token}
```

### API Endpoints Reference

#### Contacts

| Endpoint | Method | Purpose | Request Body / Params |
|----------|--------|---------|-----------------------|
| `/contacts/{contactId}` | GET | Get a single contact | — |
| `/contacts/search` | POST | Search contacts | `{ "locationId": "...", "query": "search term", "limit": 20 }` |
| `/contacts/` | POST | Create a new contact | `{ "locationId": "...", "firstName": "...", "lastName": "...", "email": "...", "phone": "...", "tags": [...] }` |
| `/contacts/{contactId}` | PUT | Update a contact | `{ "firstName": "...", "tags": [...], "customFields": [...] }` |
| `/contacts/{contactId}/notes` | GET | Get notes for a contact | — |
| `/contacts/{contactId}/notes` | POST | Add a note to a contact | `{ "body": "Note content..." }` |
| `/contacts/{contactId}/tasks` | GET | Get tasks for a contact | — |
| `/contacts/{contactId}/tasks` | POST | Create a task | `{ "title": "...", "body": "...", "dueDate": "2026-03-25T10:00:00Z", "assignedTo": "userId" }` |
| `/contacts/{contactId}/tasks/{taskId}` | PUT | Update a task | `{ "completed": true }` |

#### Pipeline / Opportunities

| Endpoint | Method | Purpose | Request Body / Params |
|----------|--------|---------|-----------------------|
| `/opportunities/pipelines` | GET | List all pipelines | Query: `locationId` |
| `/opportunities/search` | POST | Search opportunities | `{ "locationId": "...", "pipelineId": "...", "stageId": "...", "status": "open" }` |
| `/opportunities/{id}` | GET | Get a single opportunity | — |
| `/opportunities/{id}` | PUT | Update opportunity | `{ "stageId": "newStageId", "status": "open", "monetaryValue": 50000 }` |
| `/opportunities/` | POST | Create opportunity | `{ "locationId": "...", "pipelineId": "...", "stageId": "...", "contactId": "...", "name": "..." }` |

#### Calendar / Appointments

| Endpoint | Method | Purpose | Request Body / Params |
|----------|--------|---------|-----------------------|
| `/calendars/` | GET | List calendars | Query: `locationId` |
| `/calendars/events` | GET | List events | Query: `locationId`, `startTime`, `endTime`, `calendarId` |
| `/calendars/events` | POST | Create an event | `{ "locationId": "...", "calendarId": "...", "contactId": "...", "startTime": "...", "endTime": "...", "title": "..." }` |
| `/calendars/events/{eventId}` | PUT | Update an event | `{ "startTime": "...", "endTime": "...", "status": "confirmed" }` |
| `/calendars/events/{eventId}` | DELETE | Delete an event | — |

#### Conversations / Messaging

| Endpoint | Method | Purpose | Request Body / Params |
|----------|--------|---------|-----------------------|
| `/conversations/search` | GET | Search conversations | Query: `locationId`, `contactId` |
| `/conversations/{conversationId}/messages` | GET | Get messages in a conversation | — |
| `/conversations/messages` | POST | Send a message | `{ "type": "SMS" or "Email", "contactId": "...", "message": "...", "subject": "..." (email only) }` |

#### Workflows / Automations

| Endpoint | Method | Purpose | Request Body / Params |
|----------|--------|---------|-----------------------|
| `/workflows/` | GET | List workflows | Query: `locationId` |
| `/contacts/{contactId}/workflow/{workflowId}` | POST | Add contact to workflow | — |
| `/contacts/{contactId}/workflow/{workflowId}` | DELETE | Remove contact from workflow | — |

#### Users

| Endpoint | Method | Purpose | Request Body / Params |
|----------|--------|---------|-----------------------|
| `/users/` | GET | List users | Query: `locationId` |
| `/users/{userId}` | GET | Get a single user | — |

### GHL Webhook Events (Optional)

For real-time updates instead of polling, configure GHL webhooks to send events to `{BACKEND_URL}/api/webhooks/ghl`:

| Event | Trigger | Use Case |
|-------|---------|----------|
| `ContactCreate` | New contact created in GHL | Trigger speed-to-lead monitoring |
| `ContactUpdate` | Contact record updated | Sync pipeline stage changes |
| `OpportunityStageUpdate` | Opportunity moves stages | Update accountability engine |
| `TaskCompleted` | A task is marked complete | Update Daily HQ task list |
| `InboundMessage` | Lead replies via SMS/email | Alert rep, update engagement score |
| `AppointmentCreate` | Appointment created | Update upcoming events |
| `NoteCreate` | Note added to contact | Verify rep is logging call notes |

---

## 2. Anthropic Claude API

Claude powers Scout's reasoning, conversation, and tool-calling capabilities.

### API Overview

| Property | Value |
|----------|-------|
| **Base URL** | `https://api.anthropic.com` |
| **API Version** | `2023-06-01` (use latest stable) |
| **Recommended Model** | `claude-sonnet-4-6` (balance of speed, cost, and quality) |
| **Fallback Model** | `claude-haiku-4-5-20251001` (faster, cheaper — for simple queries) |
| **Auth Method** | API key in `x-api-key` header |
| **Rate Limit** | Tier-dependent — see Anthropic dashboard |
| **Documentation** | https://docs.anthropic.com |

### Setup

1. Create an account at https://console.anthropic.com
2. Generate an API key
3. Store the key as `ANTHROPIC_API_KEY` in your environment variables
4. Never expose this key in frontend code — all Claude calls go through the backend

### API Call Structure

**Messages API (Primary)**

```
POST https://api.anthropic.com/v1/messages
Headers:
  x-api-key: {ANTHROPIC_API_KEY}
  anthropic-version: 2023-06-01
  content-type: application/json

Body:
{
  "model": "claude-sonnet-4-6",
  "max_tokens": 4096,
  "system": "[assembled Scout system prompt]",
  "tools": [
    {
      "name": "get_contact",
      "description": "Fetch a contact from GHL by ID",
      "input_schema": {
        "type": "object",
        "properties": {
          "contact_id": { "type": "string", "description": "The GHL contact ID" }
        },
        "required": ["contact_id"]
      }
    },
    // ... other tool definitions
  ],
  "messages": [
    { "role": "user", "content": "What should I focus on today?" },
    // ... conversation history
  ]
}
```

**Response with Tool Use:**

When Claude wants to call a tool, the response includes a `tool_use` content block. The backend:
1. Executes the tool (e.g., fetches from GHL API)
2. Sends the result back to Claude as a `tool_result` message
3. Repeats until Claude returns a final text response

### Scout Tool Definitions

| Tool Name | Description | Parameters |
|-----------|-------------|------------|
| `get_contact` | Fetch a single contact from GHL | `contact_id` (string, required) |
| `search_contacts` | Search contacts by name, email, or phone | `query` (string, required), `limit` (number, optional, default 10) |
| `get_pipeline` | Get current pipeline state — all opportunities | `pipeline_id` (string, optional — uses default if not provided) |
| `draft_message` | Draft an SMS or email for the user to review | `contact_id` (string), `channel` ("sms" or "email"), `content` (string), `subject` (string, email only) |
| `draft_task` | Draft a task for the user to review | `contact_id` (string), `title` (string), `due_date` (string, ISO 8601), `description` (string, optional) |
| `draft_stage_move` | Draft a pipeline stage change for the user to review | `contact_id` (string), `new_stage` (string — stage name), `reason` (string, optional) |
| `get_schedule` | Get upcoming appointments | `start_date` (string, ISO 8601), `end_date` (string, ISO 8601) |
| `search_knowledge` | Search the NAH knowledge base | `query` (string) |

### Model Selection Strategy

| Scenario | Model | Why |
|----------|-------|-----|
| Standard Scout conversation | `claude-sonnet-4-6` | Best balance of quality, speed, and cost. Tool-calling reliable. |
| Simple factual lookups | `claude-haiku-4-5-20251001` | Faster and cheaper for straightforward queries. |
| Complex strategy questions | `claude-sonnet-4-6` | Needs deeper reasoning for leadership-level analysis. |
| Conversation summarization | `claude-haiku-4-5-20251001` | Summarizing old messages for the sliding window. |

### Cost Management

- **Token tracking:** Log input and output token counts for every Claude API call in `scout_action_logs`
- **Prompt budget:** Keep system prompt under ~6,000 tokens total (static + dynamic sections)
- **Conversation window:** Sliding window of 20 messages to prevent token count explosion
- **Summarization:** When conversation exceeds 20 messages, summarize older messages using Haiku

---

## 3. OpenAI Whisper API

Whisper provides voice-to-text transcription for Scout's voice input feature.

### API Overview

| Property | Value |
|----------|-------|
| **Base URL** | `https://api.openai.com/v1` |
| **Endpoint** | `/audio/transcriptions` |
| **Auth Method** | Bearer token in Authorization header |
| **Supported Formats** | mp3, mp4, mpeg, mpga, m4a, wav, webm |
| **Max File Size** | 25 MB |
| **Model** | `whisper-1` |
| **Documentation** | https://platform.openai.com/docs/guides/speech-to-text |

### Setup

1. Create an account at https://platform.openai.com
2. Generate an API key
3. Store the key as `OPENAI_API_KEY` in your environment variables

### API Call

```
POST https://api.openai.com/v1/audio/transcriptions
Headers:
  Authorization: Bearer {OPENAI_API_KEY}
Content-Type: multipart/form-data

Body:
  file: [audio file]
  model: whisper-1
  language: en
  response_format: text
```

### Voice Input Flow

1. User taps the mic button in the Scout chat interface
2. Frontend records audio using the Web Audio API (MediaRecorder)
3. Recording continues until user taps "Done" (or 60-second max)
4. Audio blob is sent to the backend: `POST /api/voice/transcribe`
5. Backend forwards the audio to the Whisper API
6. Whisper returns the transcribed text
7. Backend sends the text back to the frontend
8. Text is inserted into the chat input and auto-submitted to Scout

### Voice Constraints

- Maximum recording duration: **60 seconds**
- Audio format: **webm** (natively supported by browsers and Whisper)
- Minimum audio length: **0.5 seconds** (to filter out accidental taps)
- Frontend should show a clear "recording" indicator with elapsed time

---

## 4. OpenClaw API

OpenClaw provides lead enrichment data — additional context about leads that isn't available in GHL.

### API Overview

| Property | Value |
|----------|-------|
| **Purpose** | Lead data enrichment — append business, social, and demographic data to leads |
| **Auth Method** | API key in header |
| **When to Call** | On new lead creation or when a rep requests enrichment via Scout |
| **Data Returned** | Business ownership history, social profiles, location data, estimated net worth range |

### Setup

1. Obtain API credentials from OpenClaw
2. Store the API key as `OPENCLAW_API_KEY` in your environment variables

### Integration Rules

- OpenClaw data is **supplementary** — it enriches the lead profile but does not override GHL data
- Enrichment is triggered manually or on new lead creation (not on every page load)
- Enrichment results are stored as custom fields on the GHL contact record
- Scout can reference enrichment data when discussing a lead's background
- If OpenClaw is unavailable, the app continues to function without enrichment data

---

## 5. Full Tech Stack Recommendations

| Layer | Technology | Version | Purpose | Status |
|-------|-----------|---------|---------|--------|
| **Frontend Framework** | Next.js | 14+ | React framework with SSR, routing, and API routes | Confirmed |
| **Frontend Language** | TypeScript | 5+ | Type safety across frontend and backend | Confirmed |
| **UI Components** | Tailwind CSS | 3+ | Utility-first CSS framework | Confirmed |
| **Component Library** | shadcn/ui | latest | Pre-built accessible components built on Radix UI + Tailwind | Recommended |
| **State Management** | React Context + SWR | — | Context for auth/theme, SWR for server data fetching/caching | Recommended |
| **Backend Runtime** | Node.js | 20+ | JavaScript runtime for backend API | Confirmed |
| **Backend Framework** | Express.js | 4+ | HTTP server and API routing | Confirmed |
| **Backend Language** | TypeScript | 5+ | Type safety across frontend and backend | Confirmed |
| **Database** | PostgreSQL | 15+ | Relational database for app-specific data | Confirmed |
| **Database Host** | Supabase | — | Managed Postgres with auth helpers, realtime, and storage | Confirmed |
| **ORM** | Prisma | 5+ | Type-safe database client and migrations | Recommended |
| **AI Engine** | Anthropic Claude API | Messages v1 | Scout's reasoning, conversation, and tool use | Confirmed |
| **Voice Transcription** | OpenAI Whisper API | v1 | Voice-to-text for Scout voice input | Confirmed |
| **Lead Enrichment** | OpenClaw API | — | Lead data enrichment | Confirmed |
| **CRM** | GoHighLevel API | v2 | Source of truth for leads, pipeline, tasks, messaging | Confirmed |
| **Authentication** | JWT + bcrypt | — | Token-based auth with password hashing | Confirmed |
| **Job Scheduler** | node-cron | 3+ | Background job scheduling for accountability engine | Recommended |
| **HTTP Client** | axios | 1+ | HTTP requests to external APIs (GHL, Claude, Whisper) | Recommended |
| **Validation** | Zod | 3+ | Runtime schema validation for API inputs | Recommended |
| **Frontend Hosting** | Vercel | — | Next.js deployment with CDN and edge functions | Confirmed |
| **Backend Hosting** | Railway | — | Node.js deployment with cron support | Confirmed |
| **Monitoring** | Sentry | — | Error tracking and performance monitoring | Recommended |
| **Logging** | Pino | 8+ | Fast, structured JSON logging | Recommended |
| **Testing** | Vitest + Playwright | — | Unit/integration tests (Vitest), E2E tests (Playwright) | Recommended |
| **Drag and Drop** | @dnd-kit | — | Accessible drag-and-drop for pipeline board (Phase 2) | Recommended |
| **Charts** | Recharts | 2+ | Chart library for dashboard visualizations (Phase 2) | Recommended |

---

## 6. Environment Variables

All environment variables are stored on the deployment platform (Railway for backend, Vercel for frontend).
No secrets are ever committed to version control. `.env` files are listed in `.gitignore`.

### Backend (Railway)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Supabase PostgreSQL connection string (with connection pooling) |
| `DIRECT_DATABASE_URL` | Yes | Direct Supabase PostgreSQL connection string (for migrations) |
| `GHL_CLIENT_ID` | Yes | GoHighLevel OAuth application client ID |
| `GHL_CLIENT_SECRET` | Yes | GoHighLevel OAuth application client secret |
| `GHL_LOCATION_ID` | Yes | GHL location (sub-account) ID for API calls |
| `GHL_API_KEY` | No | GHL API key (alternative to OAuth for simple setups) |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for Claude |
| `OPENAI_API_KEY` | Yes | OpenAI API key for Whisper voice transcription |
| `OPENCLAW_API_KEY` | No | OpenClaw API key for lead enrichment |
| `JWT_SECRET` | Yes | Secret key for signing JWT authentication tokens (min 32 characters) |
| `JWT_REFRESH_SECRET` | Yes | Separate secret for signing refresh tokens (min 32 characters) |
| `ENCRYPTION_KEY` | Yes | AES-256 key for encrypting sensitive values in the database (32 bytes) |
| `FRONTEND_URL` | Yes | Frontend app URL for CORS configuration (e.g., `https://app.newagainhouses.com`) |
| `PORT` | No | Server port (default: 3001, Railway assigns automatically) |
| `NODE_ENV` | Yes | Environment: `development`, `staging`, or `production` |
| `SLACK_WEBHOOK_URL` | No | Slack incoming webhook URL for critical alert notifications |
| `SENTRY_DSN` | No | Sentry DSN for error tracking (backend) |
| `LOG_LEVEL` | No | Logging level: `debug`, `info`, `warn`, `error` (default: `info`) |

### Frontend (Vercel)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | Backend API base URL (e.g., `https://api.newagainhouses.com`) |
| `NEXT_PUBLIC_APP_URL` | Yes | Frontend app URL (e.g., `https://app.newagainhouses.com`) |
| `NEXT_PUBLIC_SENTRY_DSN` | No | Sentry DSN for error tracking (frontend) |

### Local Development (.env.local)

For local development, create a `.env.local` file in the project root (never commit this):

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/nah_franchise_os
DIRECT_DATABASE_URL=postgresql://user:password@localhost:5432/nah_franchise_os

# GHL
GHL_CLIENT_ID=your_ghl_client_id
GHL_CLIENT_SECRET=your_ghl_client_secret
GHL_LOCATION_ID=your_ghl_location_id

# AI
ANTHROPIC_API_KEY=sk-ant-your-key-here
OPENAI_API_KEY=sk-your-key-here

# Auth
JWT_SECRET=your-local-jwt-secret-at-least-32-chars
JWT_REFRESH_SECRET=your-local-refresh-secret-at-least-32-chars
ENCRYPTION_KEY=your-local-encryption-key-32-bytes

# App
FRONTEND_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
PORT=3001
LOG_LEVEL=debug
```

---

## 7. Integration Health Checks

The backend exposes a health check endpoint at `GET /api/health` that verifies connectivity
to all external services:

```json
{
  "status": "healthy",
  "timestamp": "2026-03-23T10:00:00Z",
  "services": {
    "database": { "status": "connected", "latency_ms": 12 },
    "ghl": { "status": "connected", "token_expires_in": "23h 14m" },
    "claude": { "status": "connected", "model": "claude-sonnet-4-6" },
    "whisper": { "status": "connected" },
    "openclaw": { "status": "connected" }
  }
}
```

If any service is unreachable, the health check returns a `503` with details on which
service is failing. This endpoint is used by Railway for deployment health checks and
by the accountability engine to verify services before running jobs.

---

## NAH Custom GHL MCP Server — Added 2026-03-23

### What It Is

Custom Model Context Protocol server giving Scout direct GHL access.
Built in TypeScript. Reference repos used for patterns only — not copied.

Reference repos (patterns only — do not copy code directly):
- https://github.com/hridayshah7/gohighlevel-mcp — tool structure patterns
- https://github.com/basicmachines-co/open-ghl-mcp — OAuth 2.0 patterns

### Why Not Use Open Source Directly

- **basicmachines-co:** AGPL-3.0 license — copying code would force us
  to open source our entire application — unacceptable
- **hridayshah7:** No draft→confirm safety layer — Scout would have
  unrestricted write access to GHL — violates our core safety model
- **Neither** has NAH business rules or role-based contact scoping

### What To Borrow From Reference Repos

**From hridayshah7 (TypeScript):**
- GHL API client base URL and header patterns
- TypeScript type definitions for GHL response objects
- Error handling and rate limiting approaches
- Tool naming conventions

**From basicmachines-co (Python — translate to TypeScript):**
- OAuth 2.0 flow and token refresh logic
- Multi-location support patterns

### New Environment Variables Required

| Variable | Purpose |
|----------|---------|
| `GHL_PRIVATE_API_KEY` | GHL Settings → Integrations → Private Integrations |
| `GHL_LOCATION_ID` | GHL Settings → Company → Locations |
| `GHL_BASE_URL` | `https://services.leadconnectorhq.com` |
| `GHL_MCP_SERVER_URL` | URL of our deployed MCP server |

### MCP Server URL

| Environment | URL |
|-------------|-----|
| Production | `https://[backend-domain]/mcp/ghl` |
| Development | `http://localhost:3001/mcp/ghl` |

### Build Priority

| Phase | Tools | Purpose |
|-------|-------|---------|
| Phase 0 | contact tools (get, search, update, history) + pipeline stages | Scout MVP |
| Phase 1 | pipeline move, tasks, appointments, messaging, conversations | Full Scout page |
| Phase 2 | workflow enrollment and automation controls | Workflow engine |
| Phase 3 | bulk operations, tags, leadership reporting tools | Leadership dashboard |
