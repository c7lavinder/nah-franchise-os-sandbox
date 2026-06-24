# Vonage Integration Plan

> Living tracker. Replaces SignalHouse for SMS (Phase 1), then adds in-browser
> calling (Phase 2). Read this at session start before touching Vonage code.

**Decision context (from owner + Vonage account rep, 2026-06-24):**

- CRM is custom-built (NAH Franchise OS) → **Voice API + webhooks route** (no
  Salesforce connector / Zapier path).
- SMS: **replace SignalHouse** with Vonage (keep SignalHouse code in place as an
  instant fallback via `SMS_PROVIDER`).
- Calling: **in-browser softphone** (WebRTC via Vonage Client SDK) — Phase 2.
- One Vonage **Application** holds both Messages + Voice capabilities; auth is
  Application ID + private key (RS256 JWT).

---

## Phase 0 — Vonage-side provisioning (owner / not code) ⛳ BLOCKER for go-live

- [ ] Create a Vonage Application at developer.vonage.com with **Messages**
      capability (add **Voice** for Phase 2). Generate key pair, download the
      private key.
- [ ] Link the virtual / business number to the Application.
- [ ] **10DLC brand + campaign registration** (required for US A2P SMS; days→weeks).
      Live texting will not flow until approved. Start ASAP.
- [ ] Confirm with rep: will linking the business line to the API app stop it
      ringing on VBC desk phones? If so, use a dedicated number for the app.
- [ ] Provide 6 secrets for env: `VONAGE_API_KEY`, `VONAGE_API_SECRET`,
      `VONAGE_APPLICATION_ID`, `VONAGE_PRIVATE_KEY`, `VONAGE_API_SIGNATURE_SECRET`,
      `VONAGE_FROM_NUMBER`.

## Phase 1 — SMS via Vonage (replace SignalHouse) ✅ CODE COMPLETE (2026-06-24)

Reuses the existing `sms_messages` table (already has a `provider` column), the
inbox, read-tracking, and per-user number assignment. Cutover = `SMS_PROVIDER=vonage`.

- [x] `lib/env.ts` — register `VONAGE_*` env keys + add to the SMS provider group.
- [x] `lib/vonage/client.ts` — boundary: `sendVonageSms()` (Messages API, RS256
      JWT auth), `verifyVonageWebhook()` (HS256 signature secret), `vonageEnabled()`,
      `generateVonageJwt()` (reused by Phase 2).
- [x] `lib/sms/contact-sms.ts` — add `sendContactSmsViaVonage()` (reuses contact
      lookup + logging; writes rows with `provider='vonage'`).
- [x] `lib/sms/number-assignment.ts` — provider-aware helpers:
      `getActiveSmsProvider()`, `getAssignedSmsNumber()`, `getConfiguredSmsNumbers()`,
      `getInboxProviders()`, plus Vonage equivalents reading `assigned_vonage_number`
      / `VONAGE_FROM_NUMBER*`.
- [x] Migration `20260624120000_vonage_sms.sql` — add `users.assigned_vonage_number`.
- [x] `app/api/webhooks/vonage/inbound/route.ts` — inbound SMS → verify → match
      contact by phone → insert `sms_messages` (direction inbound). Always 200.
- [x] `app/api/webhooks/vonage/status/route.ts` — delivery receipts → update status.
- [x] `app/api/inbox/route.ts` — show messages from active providers, use
      provider-aware number helpers.
- [x] `app/api/inbox/send/route.ts` — route SMS through Vonage when active.
- [x] `lib/ghl/actions/executor.ts` — Scout C1/C3 + A5 reminder send via Vonage.
- [x] **Unified send helper** `sendContactSmsViaActiveProvider()` (Vonage→SignalHouse→GHL)
      in `lib/sms/contact-sms.ts`. ALL outbound SMS paths now route through it:
      workflow scheduler (C1/C3/A5), inbox reply, Scout action (`app/api/scout/action`),
      contact quick-send (`app/api/contacts/[id]/send`). No path left hardcoded to a
      single provider. Flip `SMS_PROVIDER=vonage` → Vonage used everywhere.
- [x] `npx tsc --noEmit` clean + `npx next lint` clean + `npx next build` clean.

**Remaining before go-live (needs Phase 0 done):**

1. Run the migration in Supabase.
2. Set the 6 `VONAGE_*` env vars (+ `SMS_PROVIDER=vonage`) in Vercel.
3. Set Inbound/Status webhook URLs on the Vonage Application.
4. Assign each rep an `assigned_vonage_number` (via admin/SQL).
5. Smoke test: send to a test phone, reply, confirm inbox shows both + DLR status.

**Not changed (out of scope, flag for later):** `/settings/webhooks` UI page still
lists GHL/SignalHouse only — add Vonage URLs there if you want them visible in-app.

**Webhook URLs to set on the Vonage Application (Messages capability):**

- Inbound: `https://<app>/frandev/api/webhooks/vonage/inbound`
- Status: `https://<app>/frandev/api/webhooks/vonage/status`

## Phase 2 — Calling 🔭 DEPRIORITIZED (owner, 2026-06-24: "calls much less important now")

Revised direction from VBC research: keep Chad on the VBC phone app (number
unchanged) and sync his call activity into the CRM via the **Vonage Integration
Platform (VIP)** — call events webhook + Call Recording API + VIP "Place calls"
for click-to-call. This preserves the phone app the team already uses and is
likely simpler than a Communications-API browser softphone. Decide VIP vs
Client-SDK softphone when calling is revisited. Original softphone outline below.

### (original) In-browser softphone (WebRTC) — only if VIP route is rejected

- [ ] Add **Voice** capability to the Vonage Application (answer_url, event_url).
- [ ] `app/api/vonage/jwt/route.ts` — mint per-user RS256 Client SDK JWT (with ACL).
- [ ] `app/api/vonage/voice/answer/route.ts` — return NCCO: outbound `connect` to
      `phone` (from = Vonage number); inbound `connect` to `app` user.
- [ ] `app/api/vonage/voice/events/route.ts` — call lifecycle events → log.
- [ ] Migration — new `phone_calls` table (separate from the sales-coaching `calls`
      table; do not conflate).
- [ ] Frontend dialer/softphone component using `@vonage/client-sdk`.

---

## Key facts (verified against Vonage docs, 2026-06)

- **SMS:** Messages API, `POST https://api.nexmo.com/v1/messages`, body
  `{ message_type:"text", channel:"sms", to, from, text }`, auth `Bearer <RS256 JWT>`
  signed with the Application private key (claims: `application_id`, `jti`, `iat`, `exp`).
- **Webhook signing:** JWT in `Authorization: Bearer` header, **HS256** signed with
  the **signature secret** (distinct from the API secret and the private key).
  Primary check = `jwt.verify`. (`payload_hash` match is brittle — JSON ordering.)
- **Phone format:** E.164 without `+` (e.g. `14155550199`) — same as
  `toSignalHousePhone()` output, so that helper is reused.
- **Credentials:** private key signs auth/client JWTs (RS256); signature secret
  verifies inbound webhooks (HS256) — easy to confuse, keep separate.
  </content>
  </invoke>
