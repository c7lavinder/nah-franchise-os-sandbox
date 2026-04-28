# Security — NAH Franchise OS

Last verified: 2026-04-27
Source: code (Tier 0b auth retrofit)

---

## Authentication

All API routes require authentication via Supabase Auth JWTs, except intentionally public routes (see below).

**Server-side pattern:**
```ts
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  // user.id, user.role, user.fullName, user.ghlUserId available
}
```

`requireAuth` reads the `Authorization: Bearer <token>` header, verifies the JWT via `supabase.auth.getUser()`, then looks up the app user by email. Returns an `AuthUser` on success or a 401 `Response` on failure.

**Critical rule:** `requireAuth` returns a `Response` (not throws). Callers must check `if (user instanceof Response) return user;`.

**Client-side pattern:**
```ts
import { apiFetch } from "@/lib/auth/api-fetch";

const res = await apiFetch("/api/foo");
```

`apiFetch` reads the JWT from `localStorage` (`nah_auth_token`) and attaches it as a Bearer header. On 401, it automatically refreshes the token via `/api/auth/refresh` and retries once. If refresh also fails, it clears auth state and redirects to `/login`.

---

## Authorization

**Admin role check:**
```ts
const user = await requireAuth(request);
if (user instanceof Response) return user;
if (user.role !== "admin") {
  return NextResponse.json({ error: "Admin access required" }, { status: 403 });
}
```

All `/api/settings/*` admin routes use this pattern.

**Admin "view as" pattern** (used in `/api/daily-hq`):
```ts
const targetParam = request.nextUrl.searchParams.get("targetUserId");
const userId = (user.role === "admin" && targetParam) ? targetParam : user.id;
```

Admins can pass `?targetUserId=X` to view another user's data. Non-admins always see their own data (param silently ignored).

**Available roles:** `rep`, `marketing`, `leadership`, `admin`, `operator`, `specialist`

---

## Intentionally public routes

| Route | Reason |
|---|---|
| `/api/auth/login` | Login endpoint |
| `/api/auth/logout` | Logout |
| `/api/auth/refresh` | Token refresh (called before auth is established) |
| `/api/auth/crm` | GHL OAuth initiation |
| `/api/auth/crm/callback` | GHL OAuth callback |
| `/api/health` | Health check |
| `/api/track/click/[logId]` | Email tracking pixel |
| `/api/track/open/[logId]` | Email tracking pixel |

---

## Webhook protection

**Read.ai:** Per-user HMAC verification using `createHmac("sha256", signingKey)`. Signing keys stored in env vars as `READ_AI_WEBHOOK_SIGNING_KEY_{EMAIL_PREFIX}`.

**All other webhooks (9 routes):** Shared-secret verification via `lib/auth/webhook-verify.ts`. Checks `x-webhook-secret` header or `?secret=` query param against `WEBHOOK_SHARED_SECRET` env var.

**DEFERRED:** `WEBHOOK_SHARED_SECRET` is not yet set in Vercel. Setting it without configuring the matching secret in each webhook provider would break all incoming webhooks. Providers that need configuration before activation:
- GHL (webhooks/ghl, ghl-calendar, ghl/contacts)
- DocuSign (webhooks/docusign)
- Trainual (webhooks/trainual)
- Zorakle (webhooks/zorakle)
- Google Meet (webhooks/google-meet)
- Form submission (webhooks/form-submission)
- Payment (webhooks/payment)

Verification is skipped in development mode and when the env var is not set.

---

## Cron protection

All 16 cron routes verify `CRON_SECRET` Bearer token:
```ts
const authHeader = request.headers.get("authorization");
const cronSecret = process.env.CRON_SECRET;
if (cronSecret && authHeader !== `Bearer ${cronSecret}` && process.env.NODE_ENV !== "development") {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

Vercel Cron automatically passes `Authorization: Bearer ${CRON_SECRET}` when the env var is set. `CRON_SECRET` is set in Vercel production + development environments.

---

## JWT lifecycle

1. **Login:** User authenticates via `/api/auth/login` with email + password. Supabase returns access token (1-hour expiry) + refresh token.
2. **Storage:** Tokens stored in `localStorage` (`nah_auth_token`, `nah_refresh_token`).
3. **Auto-refresh:** `AuthContext` refreshes the access token every 45 minutes via `/api/auth/refresh`.
4. **On-demand refresh:** `apiFetch` auto-refreshes on 401 and retries.
5. **Force logout:** If refresh fails (refresh token expired), `apiFetch` clears all auth state and redirects to `/login`.
6. **Session cap:** 30-day max session from last explicit login. After 30 days, user must re-authenticate.

---

## Known gaps (parked)

| Gap | Status | Notes |
|---|---|---|
| JWT in localStorage | Deferred | Should migrate to httpOnly cookies. Current approach is standard for SPAs but vulnerable to XSS. |
| Service role key bypasses RLS | Accepted | All API routes use the service role key. Authorization is enforced at the application layer (requireAuth + role checks), not via Supabase RLS. |
| Per-rep row-level filtering | Deferred | Currently all authenticated users can read all data. Future: restrict reps to their assigned contacts/territories only. Separate ADR needed. |
| WEBHOOK_SHARED_SECRET activation | Deferred | Env var exists in code but not set in Vercel. Must configure each webhook provider first. |
| OAuth token storage | Deferred | GHL OAuth tokens stored as JSON-stringified values in `app_settings` table. Cleanup pass planned. |

---

## Adding a new API route

1. Create the route file in `app/api/your-route/route.ts`
2. Add `requireAuth` at the top of each handler:
   ```ts
   import { requireAuth } from "@/lib/auth";

   export async function GET(request: NextRequest) {
     const user = await requireAuth(request);
     if (user instanceof Response) return user;
     // ... route logic using user.id, user.role
   }
   ```
3. If admin-only, add the role check after `requireAuth`
4. Frontend: use `apiFetch` instead of `fetch` for the corresponding client call
5. Add the route to `docs/AUTH_AUDIT.md` with its classification

---

## Data handling policy

### Never commit

- **Customer data** (contacts, leads, transcripts, assessment scores) — lives in Supabase only
- **Credentials, API keys, tokens** — env vars only (`.env.local` locally, Vercel env vars in production)
- **Personal info** about team members beyond name and work email
- **CRM exports** (CSV, XLSX, XLS) — `.gitignore` now blocks all CSV/XLSX at repo level

### .gitignore is non-negotiable

The repo `.gitignore` blocks:
- `*.csv`, `*.xlsx`, `*.xls` — all tabular data files
- `data/`, `exports/` — data directories
- `.env`, `.env.local`, `.env.*.local`, `.env.production` — all env files
- `*.pem`, `*.key`, `secrets/` — credential files

When in doubt, gitignore first. It's easier to un-ignore a file than to scrub it from history.

### Onboarding a new team member

1. Verify `.env.local.example` is current
2. Provide `.env.local` values out-of-band (1Password, secure share — never email or Slack)
3. Do not add personal data to the repo
4. Have them verify `git check-ignore .env.local` returns a match

### Discovered a leak?

1. **Stop committing immediately**
2. Do NOT just delete the file — git history retains it permanently
3. Tag Corey and coordinate a `git-filter-repo` history scrub
4. Rotate any leaked credentials (API keys, tokens, passwords)
5. See `docs/PRIVACY_AUDIT.md` Phase 2.5 for the scrub procedure

### History scrub completed (2026-04-27)

Six data files (2,786 customer records) were scrubbed from all git history using `git-filter-repo`. Backup preserved at `../nah-franchise-os-sandbox-PRESCRUB-BACKUP-20260427`. GitHub API cache may retain old commit SHAs for up to 90 days (private repo, limited exposure).
