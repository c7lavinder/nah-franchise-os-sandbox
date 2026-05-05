# Security — NAH Franchise OS

Last verified: 2026-05-05
Source: code (MasterSuite API auth migration)

---

## Authentication

All API routes require authentication via MasterSuite API JWTs (HS512), except intentionally public routes (see below).

**Server-side pattern:**

```ts
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  // user.id, user.role, user.fullName, user.ghlUserId available
}
```

`requireAuth` reads the JWT from an httpOnly cookie (or falls back to `Authorization: Bearer` header), verifies the HS512 signature using `MASTERSUITE_API_JWT_SECRET`, checks the custom `Expiration` claim, then looks up the app user by email in the `users` table. Returns an `AuthUser` on success or a 401 `Response` on failure.

**Critical rule:** `requireAuth` returns a `Response` (not throws). Callers must check `if (user instanceof Response) return user;`.

**Client-side pattern:**

```ts
import { apiFetch } from "@/lib/auth/api-fetch";

const res = await apiFetch("/api/foo");
```

`apiFetch` sends requests with `credentials: "include"` so the browser attaches the httpOnly JWT cookie automatically. On 401 (token expired), it clears auth state and redirects to `/login`.

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
const userId = user.role === "admin" && targetParam ? targetParam : user.id;
```

Admins can pass `?targetUserId=X` to view another user's data. Non-admins always see their own data (param silently ignored).

**Available roles:** `rep`, `marketing`, `leadership`, `admin`, `operator`, `specialist`

---

## Intentionally public routes

| Route                      | Reason                                 |
| -------------------------- | -------------------------------------- |
| `/api/auth/login`          | Login endpoint (calls MasterSuite API) |
| `/api/auth/logout`         | Logout (clears cookie)                 |
| `/api/auth/crm`            | GHL OAuth initiation                   |
| `/api/auth/crm/callback`   | GHL OAuth callback                     |
| `/api/health`              | Health check                           |
| `/api/track/click/[logId]` | Email tracking pixel                   |
| `/api/track/open/[logId]`  | Email tracking pixel                   |

---

## Webhook protection

Three verification schemes are used depending on the provider:

### GHL webhooks (3 routes) — Ed25519 signature

GHL signs every outbound webhook with an Ed25519 key pair. Our handler verifies using GHL's published public key via `lib/auth/ghl-webhook-verify.ts`.

| Header            | Algorithm  | Status                         |
| ----------------- | ---------- | ------------------------------ |
| `X-GHL-Signature` | Ed25519    | Current, preferred             |
| `X-WH-Signature`  | RSA-SHA256 | Legacy, deprecated July 1 2026 |

Routes: `/api/webhooks/ghl`, `/api/webhooks/ghl/contacts`, `/api/webhooks/ghl-calendar`

No shared secret or custom header needed — GHL handles signing automatically. Skipped in development mode.

### Read.ai webhook (1 route) — HMAC-SHA256

Per-user HMAC verification using `createHmac("sha256", signingKey)`. Signing keys stored in env vars as `READ_AI_WEBHOOK_SIGNING_KEY_{EMAIL_PREFIX}` or in the `read_ai_webhook_keys` table.

Route: `/api/webhooks/read-ai`

### Other webhooks (6 routes) — Shared secret

Shared-secret verification via `lib/auth/webhook-verify.ts`. Checks `x-webhook-secret` header or `?secret=` query param against `WEBHOOK_SHARED_SECRET` env var.

Routes: `/api/webhooks/docusign`, `trainual`, `zorakle`, `google-meet`, `form-submission`, `payment`

`WEBHOOK_SHARED_SECRET` is set in Vercel (production, preview, development). Verification activates on next deploy. Each provider must be configured with the matching secret before their webhooks will pass. Skipped in development mode and when the env var is not set.

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

1. **Login:** User authenticates via `/api/auth/login` with email + password. FranDev server calls `POST https://api.mastersuiteapp.com/auth/login` and receives a signed JWT (HS512).
2. **Storage:** JWT stored in an httpOnly cookie (`nah_access_token`, 30-day maxAge). User profile cached in `localStorage` (`nah_user`) for hydration only.
3. **No refresh needed:** MasterSuite JWT has a 30-day expiry. No refresh endpoint or timer.
4. **Force logout:** On 401, `apiFetch` clears auth state and redirects to `/login`.
5. **Session cap:** 30 days from login. After 30 days, user must re-authenticate via MasterSuite API.

---

## Known gaps (parked)

| Gap                                      | Status   | Notes                                                                                                                                                                       |
| ---------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FranDev roles vs MasterSuite permissions | Accepted | MasterSuite JWT carries MasterSuite permissions (AdminPanel, BulkImport, etc.). FranDev roles (rep, admin, etc.) still come from the local `users` table, matched by email. |
| Service role key bypasses RLS            | Accepted | All API routes use the service role key. Authorization is enforced at the application layer (requireAuth + role checks), not via Supabase RLS.                              |
| Per-rep row-level filtering              | Deferred | Currently all authenticated users can read all data. Future: restrict reps to their assigned contacts/territories only. Separate ADR needed.                                |
| WEBHOOK_SHARED_SECRET activation         | Partial  | Set in Vercel. GHL routes use Ed25519 instead (Tier 1 #7). Non-GHL providers still need provider-side config.                                                               |
| OAuth token storage                      | Deferred | GHL OAuth tokens stored as JSON-stringified values in `app_settings` table. Cleanup pass planned.                                                                           |

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
