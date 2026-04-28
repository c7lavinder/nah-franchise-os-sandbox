# ADR 0005: Keep GHL webhooks, drop no-webhooks rule

## Status
Accepted (supersedes original "no webhooks" decision)

## Context
Originally, the project avoided GHL webhooks due to setup complexity. As the system grew, polling-only became unsustainable. At 100 reps, polling would require ~500 GHL API calls/minute.

## Decision
Keep the existing GHL webhook handler. Drop the "no GHL webhooks" rule. The handler exists, works, and just needs error-fix + GHL config verification. Webhook routes protected by WEBHOOK_SHARED_SECRET (deferred activation until providers are configured).

## Consequences
- 9 webhook routes with shared-secret verification code in place
- WEBHOOK_SHARED_SECRET env var must be set AND each provider configured before activation
- Read.ai webhook already has per-user HMAC (working independently)
- Polling still used for some data where webhooks aren't configured
