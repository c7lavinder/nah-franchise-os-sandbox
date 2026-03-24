# GHL Marketplace App Setup — Step-by-Step Guide

> **STATUS: BLOCKER**
> The NAH Franchise OS cannot connect to GoHighLevel without completing this setup.
> No contacts, pipeline, tasks, or messaging will work until this is done.
> Complete every step in order before attempting to run the OAuth flow.

> Last updated: 2026-03-24

---

## What This Does

GoHighLevel requires you to register a "Marketplace App" before your software can talk to it.
Think of it like getting a badge that lets you into the building.
This guide walks you through creating that badge, telling GHL what your app needs access to,
and connecting everything so Scout can read and write real CRM data.

---

## Step 1 — Create the Marketplace App

1. Go to [marketplace.gohighlevel.com](https://marketplace.gohighlevel.com)
2. Log in with your GHL agency account (not a sub-account)
3. Click **"My Apps"** in the top navigation
4. Click **"Create App"**
5. Fill in the details:

| Field | Value |
|-------|-------|
| **App Name** | NAH Franchise OS |
| **Description** | AI-powered franchise sales platform for New Again Houses |
| **App Type** | **Sub-Account** (not Agency) — our app connects to a single location |
| **Distribution** | **Private** — keep this private while building. Only your accounts can install it. You can change to Public later if needed. |

6. Click **"Create"**

### Grab Your Client ID and Client Secret

After creating the app, you'll land on the app settings page.

- **Client ID** — copy this immediately and save it somewhere safe
- **Client Secret** — click "Show" or "Copy" — **this is only shown once**. If you lose it, you'll have to regenerate a new one.

Save both values. You'll need them for your `.env.local` file.

---

## Step 2 — Declare OAuth Scopes

Still on your app settings page in the Marketplace portal:

1. Find the **"Scopes"** section
2. Add all 15 of these scopes:

| Scope | What It Allows |
|-------|----------------|
| `contacts.readonly` | Read contact records |
| `contacts.write` | Create and update contacts |
| `opportunities.readonly` | Read pipeline opportunities |
| `opportunities.write` | Create and update opportunities (stage moves) |
| `calendars.readonly` | Read calendar details |
| `calendars.write` | Create and update calendars |
| `calendars/events.readonly` | Read appointments and events |
| `calendars/events.write` | Create and update appointments |
| `conversations.readonly` | Read conversation threads |
| `conversations.write` | Create conversations |
| `conversations/message.readonly` | Read individual messages |
| `conversations/message.write` | Send SMS and email messages |
| `workflows.readonly` | Read workflow definitions |
| `locations.readonly` | Read location (sub-account) details |
| `users.readonly` | Read user/team member details |

**Do not skip any scope.** If a scope is missing, Scout will get "permission denied" errors
when trying to use that feature. Add all 15 now — you can always restrict later.

3. Click **"Save"** after adding all scopes

---

## Step 3 — Set the Redirect URI

The redirect URI is where GHL sends the user after they approve the connection.
Your app must have this URL registered or the OAuth flow will fail.

1. Find the **"Redirect URI"** field in your app settings
2. Set it based on your environment:

| Environment | Redirect URI |
|-------------|-------------|
| **Local development** | `http://localhost:3001/api/auth/ghl/callback` |
| **Production** | `https://[your-backend-domain]/api/auth/ghl/callback` |

**Important rules:**
- The URI must match **exactly** — including `http` vs `https`, trailing slashes, and port numbers
- For local development, use port `3001` (the backend port) not `3000` (the frontend port)
- You can add multiple redirect URIs if needed (one for dev, one for production)
- If you're running everything on Next.js (port 3000), use `http://localhost:3000/api/auth/ghl/callback`

For this sandbox project (Next.js API routes on port 3000), use:
```
http://localhost:3000/api/auth/ghl/callback
```

---

## Step 4 — Set the Webhook URL (Optional but Recommended)

Webhooks let GHL push real-time events to your app (new contacts, stage changes, etc.)
instead of your app constantly polling GHL for updates.

1. Find the **"Webhook URL"** field in your app settings
2. Set it:

| Environment | Webhook URL |
|-------------|-------------|
| **Production** | `https://[your-backend-domain]/api/webhooks/ghl` |
| **Local development** | Leave blank for now — or use a tunnel like ngrok |

3. Under **"Webhook Events"**, enable at minimum:
   - `AppInstall` — fires when someone installs your app
   - `AppUninstall` — fires when someone removes your app

Additional webhook events to enable later (Phase 2+):
- `ContactCreate` — triggers speed-to-lead monitoring
- `ContactUpdate` — syncs pipeline stage changes
- `OpportunityStageUpdate` — updates accountability engine
- `InboundMessage` — alerts rep when a lead replies
- `AppointmentCreate` — updates upcoming events in Daily HQ

4. Click **"Save"**

---

## Step 5 — Install the App on Your Test Sub-Account

Your app is created but not installed on any GHL location yet. You need to install it
on the sub-account (location) you want to use for development.

1. In the GHL Marketplace portal, go to your app
2. Click **"Install"** or find the install link/URL
3. You'll be redirected to a consent screen — select the **sub-account (location)** you want to connect
4. Click **"Authorize"**
5. GHL will redirect to your redirect URI with a `code` parameter
   - If your app isn't running yet, this will show an error page — that's fine for now
   - The important thing is the app is now "installed" on your sub-account

### Finding Your Location ID

While you're in GHL, grab the Location ID:

1. Log into the GHL sub-account you want to connect
2. Go to **Settings** → **Business Profile** (or **Company**)
3. Look for **"Location ID"** or **"Company ID"** — it's a long string like `ve9EPM428h8vShlRW1KT`
4. Copy this value

---

## Step 6 — Set Environment Variables

Open your `.env.local` file and fill in the three GHL values:

```env
GHL_CLIENT_ID=your-client-id-from-step-1
GHL_CLIENT_SECRET=your-client-secret-from-step-1
GHL_LOCATION_ID=your-location-id-from-step-5
```

### Checklist Before Starting OAuth

All three must be set. Verify:

- [ ] `GHL_CLIENT_ID` — the Client ID from your Marketplace app
- [ ] `GHL_CLIENT_SECRET` — the Client Secret from your Marketplace app (shown only once)
- [ ] `GHL_LOCATION_ID` — the Location/Sub-Account ID from GHL settings

If any of these are missing or wrong, the OAuth flow will fail silently or with a confusing error.

---

## Step 7 — Verify the OAuth Flow Works

Once the OAuth callback route is built (Phase 1), test the full flow:

1. **Start the flow:** Visit `http://localhost:3000/api/auth/ghl` in your browser
   - This redirects you to GHL's consent screen
2. **Authorize:** Select your sub-account and click "Authorize"
   - GHL redirects back to your callback URL with a `code` parameter
3. **Token exchange:** Your callback route exchanges the code for access + refresh tokens
   - Access token expires in ~24 hours
   - Refresh token is long-lived — store both
4. **Verify storage:** Check that tokens are saved in the `app_settings` table:
   ```sql
   SELECT setting_key, setting_value FROM app_settings
   WHERE setting_key IN ('ghl_access_token', 'ghl_refresh_token');
   ```
5. **Verify health check:** Hit `http://localhost:3000/api/health`
   - Should show `ghl: connected` (or similar)
6. **Test a real call:** Ask Scout "Show me my pipeline" — it should return real GHL data

---

## Step 8 — Common Errors and Fixes

### `redirect_uri_mismatch`

**What it means:** The redirect URI in your OAuth request doesn't match what's registered in your Marketplace app.

**Fix:**
- Go to your Marketplace app settings and check the exact redirect URI
- Compare character-by-character with what your code sends
- Watch for: `http` vs `https`, trailing slash vs no slash, wrong port number
- The URIs must match **exactly**

### `invalid_client`

**What it means:** Wrong Client ID or Client Secret.

**Fix:**
- Double-check `GHL_CLIENT_ID` in your `.env.local` — copy fresh from Marketplace portal
- Double-check `GHL_CLIENT_SECRET` — if you lost it, generate a new one in the Marketplace portal
- Make sure there are no extra spaces or line breaks in the values
- Restart the dev server after changing `.env.local`

### Token not refreshing / 401 errors after 24 hours

**What it means:** The access token expired and the refresh isn't working.

**Fix:**
- Verify you stored BOTH the access token AND the refresh token during the initial OAuth flow
- The refresh token endpoint is:
  ```
  POST https://services.leadconnectorhq.com/oauth/token
  Content-Type: application/x-www-form-urlencoded

  client_id={GHL_CLIENT_ID}
  &client_secret={GHL_CLIENT_SECRET}
  &grant_type=refresh_token
  &refresh_token={stored_refresh_token}
  ```
- The response gives you a NEW access token AND a NEW refresh token — store both
- If the refresh token itself is expired or invalid, you need to re-run the full OAuth flow from Step 7

### `scope_not_allowed` or permission denied on specific endpoints

**What it means:** You didn't declare all the required scopes when creating the app.

**Fix:**
- Go back to Step 2 and verify all 15 scopes are declared
- After adding missing scopes, you may need to re-install the app on your sub-account (Step 5)

### GHL returns empty data or wrong location

**What it means:** The `GHL_LOCATION_ID` doesn't match the sub-account where the app is installed.

**Fix:**
- Verify the Location ID in GHL: Settings → Business Profile → Location ID
- Make sure this matches exactly what's in your `.env.local`
- Make sure the app was installed on THIS specific sub-account, not a different one

---

## Quick Reference — Full OAuth Flow

```
1. User visits: /api/auth/ghl

2. App redirects to:
   https://marketplace.gohighlevel.com/oauth/chooselocation
     ?response_type=code
     &redirect_uri=http://localhost:3000/api/auth/ghl/callback
     &client_id={GHL_CLIENT_ID}
     &scope=contacts.readonly contacts.write opportunities.readonly opportunities.write
            calendars.readonly calendars.write calendars/events.readonly calendars/events.write
            conversations.readonly conversations.write conversations/message.readonly
            conversations/message.write workflows.readonly locations.readonly users.readonly

3. User authorizes → GHL redirects to:
   http://localhost:3000/api/auth/ghl/callback?code=AUTHORIZATION_CODE

4. App exchanges code for tokens:
   POST https://services.leadconnectorhq.com/oauth/token
   Body: client_id, client_secret, grant_type=authorization_code, code, redirect_uri

5. Response contains: access_token, refresh_token, expires_in, locationId

6. App stores both tokens in app_settings table (encrypted)

7. All future GHL API calls use:
   Authorization: Bearer {access_token}
   Version: 2021-07-28
```

---

## What's Next After This

Once the Marketplace app is created and environment variables are set:

1. **Build the OAuth callback route** — `app/api/auth/ghl/callback/route.ts`
2. **Build the OAuth start route** — `app/api/auth/ghl/route.ts`
3. **Add token refresh logic** to the GHL client — auto-refresh before expiry
4. **Test with real data** — contacts, pipeline, tasks from your GHL sub-account
5. **Start building the GHL MCP server** at `/services/ghl-mcp/`
