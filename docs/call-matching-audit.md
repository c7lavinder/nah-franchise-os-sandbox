# Call Matching Audit

How a call row gets its `contact_id`, `territory_ms_slug`, and `call_participants`.

## 1. Entry Points

- **Read.ai classifier** — [classifier.ts:151](../lib/calls/classifier.ts#L151) + [L234](../lib/calls/classifier.ts#L234). Produces `contact_id` / `territory_ms_slug` for 3 processors.
- **Prospect processor** — [prospect-processor.ts:46-58](../lib/calls/processors/prospect-processor.ts#L46-L58) (auto-creates contact on miss) + [L96-118](../lib/calls/processors/prospect-processor.ts#L96-L118).
- **Coaching processor** — [coaching-processor.ts:38-62](../lib/calls/processors/coaching-processor.ts#L38-L62) (writes `contact_id` + `territory_ms_slug` + `coach_user_id`).
- **Group processor** — [group-processor.ts:38-56](../lib/calls/processors/group-processor.ts#L38-L56) (no `contact_id` — participant rows only).
- **Shared participant insert** — [insert-participants.ts:37,48-54](../lib/calls/processors/insert-participants.ts#L37) (sets `calls.territory_ms_slug` from first franchisee).
- **Per-call reconcile** — [reconcile-call.ts:14,143](../lib/calls/processors/reconcile-call.ts#L14).
- **Global reconcile** — [app/api/calls/reconcile/route.ts:144](../app/api/calls/reconcile/route.ts#L144).
- **GHL cron** — [sync-ghl-calendar/route.ts:78-86,175,179](../app/api/cron/sync-ghl-calendar/route.ts#L78-L86).
- **Manual create** — [calls/create/route.ts:41-56](../app/api/calls/create/route.ts#L41-L56) (user supplies `contact_id`).

## 2. Matching Logic

- **Email only.** Every resolver uses case-insensitive `ilike` on `contacts.email`. No phone, no name match, no alias / plus-address handling.
- **NAH team vs external** split via cached `users.email` set with a hardcoded fallback (classifier.ts:12-50).
- **Territory** derived only through `territory_owners` on `ghl_contact_id` where `end_date IS NULL`. Non-franchisee contacts never tie a call to a territory.
- **Cron uses `ghl_contact_id` only.** Events without `contactId` get no contact link.
- **Ties on `calls.territory_ms_slug`**: last franchisee hit wins (reconcile-call.ts:105-109, global reconcile map overwrite L111). `insert-participants` uses `.find()` = first.

## 3. Confidence Handling

- Classifier returns `confidence` + `classification_reason` (classifier.ts:118-129). **Nothing downstream reads it** — stored as free text only.
- No match → prospect processor silently auto-creates a contact. Classifier's "unknown" branch fires only when zero participants; webhook falls through, no call written.

## 4. Gaps

- **Group processor never writes `contact_id`.** Relies on reconcile-call backfill; silent miss if no email resolves.
- **Silent tie-break on multi-franchisee calls** — last wins for territory (reconcile), first for `insert-participants`.
- **Email duplicates.** `contacts.email` has no unique constraint; `ilike(...).maybeSingle()` returns a non-deterministic row.
- **Auto-create races.** Prospect processor creates a contact when classifier returned null — classifier may have missed on case/whitespace/`+alias`, so duplicates result.
- **Logic duplicated in 4 places** (classifier, reconcile-call, global reconcile, cron). Drift visible: cron uses `ghl_contact_id` only; others normalize email; team-vs-contact precedence differs.
- **Cron overwrites `contact_id` every run** — unlike `call_type_id` (guarded in Phase 4), contact reassignment is unconditional.

## 5. Recommended Fix Direction

One shared `resolveCallEntities({emails, ghlContactId})` helper returning `{contact_id, territory_ms_slug, participants[], confidence}`, with deterministic tie-breaks (earliest `contacts.created_at` on email collision; single franchisee → territory, multi → null + review flag). Call from all 4 sites. Add the Phase-4-style source guard to the cron so `contact_id` / `territory_ms_slug` on non-`ghl_calendar` rows are preserved.
