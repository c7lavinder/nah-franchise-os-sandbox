# ADR 0008: requireAuth returns Response, not throws

## Status
Accepted

## Context
The original requireAuth threw a Response object on 401. In Next.js App Router route handlers, thrown Responses are not caught by the framework. They become unhandled exceptions and return 500 instead of 401.

## Decision
requireAuth returns either an AuthUser or a Response. Callers must check: if (user instanceof Response) return user;

## Consequences
- Every route handler has a 2-line auth pattern
- Slightly more verbose than a throw, but works correctly in Next.js
- Established in Tier 0b Phase 2b after the 500 bug discovery
- All 209 authenticated routes use this pattern consistently
