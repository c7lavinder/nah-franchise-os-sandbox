---
Last verified: 2026-04-27
Source: code + session experience
---

# Runbook — NAH Franchise OS

What to do when things break.

---

## Scout returns 500

**Symptoms:** Scout chat shows error, `/api/scout/chat` returns 500.

**Diagnosis:**
1. Check Vercel function logs for the error message
2. Most common: Anthropic API key expired or rate limited
3. Less common: Supabase connection issue during session persistence

**Fix:**
- Anthropic key: verify `ANTHROPIC_API_KEY` in Vercel env vars, check Anthropic dashboard for billing/limits
- Supabase: check Supabase dashboard for downtime, verify `SUPABASE_SERVICE_KEY` is valid
- If Scout's system prompt is causing the issue: it's hardcoded in `lib/scout/client.ts` — Tier 1 gap #1 will externalize it

---

## GHL OAuth refresh fails

**Symptoms:** GHL API calls return 401, contacts/pipeline data stops loading.

**Diagnosis:**
1. GHL OAuth tokens expire in 24h, refresh tokens are single-use
2. Check if `cron/refresh-ghl-token` is firing (Vercel cron logs)
3. Check `app_settings` table for `ghl_access_token` / `ghl_refresh_token`

**Fix:**
- If refresh token is stale: re-authorize via `/api/auth/crm` (triggers GHL OAuth flow)
- If cron isn't firing: verify `CRON_SECRET` is set in Vercel, check vercel.json cron config
- Manual: GHL Dashboard → Settings → API → generate new PIT key if OAuth is fully broken

---

## Cron stops firing

**Symptoms:** Stale lead alerts not created, workflows not advancing.

**Diagnosis:**
1. Check Vercel dashboard → Cron Jobs tab
2. Verify `CRON_SECRET` env var is set (all 16 cron routes check it)
3. Check Vercel function logs for 401s on cron endpoints

**Fix:**
- Missing CRON_SECRET: `vercel env add CRON_SECRET production` with a strong random value
- Cron config: verify `vercel.json` has cron entries for each endpoint
- In development: cron checks skip when `NODE_ENV === "development"`

---

## Webhook returns 401

**Symptoms:** Incoming webhooks from GHL/Read.ai/etc. are rejected.

**Diagnosis:**
1. Read.ai: check per-user signing key in env (`READ_AI_WEBHOOK_SIGNING_KEY_{EMAIL_PREFIX}`)
2. Other webhooks: `WEBHOOK_SHARED_SECRET` must match between Vercel and provider config
3. Note: WEBHOOK_SHARED_SECRET is currently DEFERRED (not set) — webhook secret verification is skipped when the env var is absent

**Fix:**
- Read.ai: verify signing key matches what Read.ai dashboard shows
- Other providers: when ready to activate, set `WEBHOOK_SHARED_SECRET` in Vercel AND configure the same value in each provider's webhook settings

---

## Vercel deploy fails

**Symptoms:** Push to main doesn't update the live site.

**Diagnosis:**
1. Check Vercel dashboard → Deployments for build errors
2. Most common: TypeScript errors (run `npx tsc --noEmit` locally first)
3. Less common: missing env var that build depends on

**Fix:**
- TypeScript error: fix locally, push again
- Missing env var: add via `vercel env add <NAME> production`
- Rollback: Vercel dashboard → Deployments → click the last working deploy → "Promote to Production"

---

## Supabase quota / connection issue

**Symptoms:** API routes return 500 with database errors.

**Diagnosis:**
1. Supabase dashboard → Database → check connection pool usage
2. Free tier: 500 MB storage, limited connections
3. Check if a cron job is hammering the DB (stale-leads checks all contacts)

**Fix:**
- Connection pool exhausted: restart Supabase instance from dashboard
- Storage full: delete old llm_call_logs, integration_logs, call_transcripts
- Rate limit: add delays between batch operations in cron jobs

---

## JWT auto-refresh loop

**Symptoms:** User gets redirected to login repeatedly, can't stay logged in.

**Diagnosis:**
1. `apiFetch` retries once on 401 by refreshing the token
2. If refresh also fails, it clears auth and redirects to `/login`
3. This creates a loop if the Supabase Auth service is down

**Fix:**
- Check Supabase Auth status on their dashboard
- Have user clear localStorage (`nah_auth_token`, `nah_refresh_token`, `nah_user`) and login fresh
- If Supabase Auth is down: wait for recovery, no app-side fix

---

## How to roll back a deploy

1. Go to Vercel dashboard → nah-franchise-os-sandbox → Deployments
2. Find the last known-good deployment (green checkmark)
3. Click the "..." menu → "Promote to Production"
4. The old deployment goes live immediately (no rebuild needed)
5. Fix the issue locally, then push a fix to main
