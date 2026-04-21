# Call Classification Audit

How every `calls` row gets its `call_type_id`.

## 1. Entry Points

Four paths insert into `calls`. No other code inserts.

- **Read.ai webhook (prospect)** — [lib/calls/processors/prospect-processor.ts:37](../lib/calls/processors/prospect-processor.ts#L37), insert at [L96-118](../lib/calls/processors/prospect-processor.ts#L96-L118). Dispatched from [app/api/webhooks/read-ai/route.ts:179](../app/api/webhooks/read-ai/route.ts#L179).
- **Read.ai webhook (coaching)** — [lib/calls/processors/coaching-processor.ts:11](../lib/calls/processors/coaching-processor.ts#L11), insert at [L38-62](../lib/calls/processors/coaching-processor.ts#L38-L62). Dispatched from [route.ts:182](../app/api/webhooks/read-ai/route.ts#L182).
- **Read.ai webhook (group/internal)** — [lib/calls/processors/group-processor.ts:11](../lib/calls/processors/group-processor.ts#L11), insert at [L38-56](../lib/calls/processors/group-processor.ts#L38-L56). Dispatched from [route.ts:185,189](../app/api/webhooks/read-ai/route.ts#L185).
- **GHL calendar cron** — [app/api/cron/sync-ghl-calendar/route.ts:148](../app/api/cron/sync-ghl-calendar/route.ts#L148) (insert) and [L132](../app/api/cron/sync-ghl-calendar/route.ts#L132) (update).
- **Manual Log-Call UI → REST** — form at [app/(auth)/calls/page.tsx:417](../app/(auth)/calls/page.tsx#L417) posts to [app/api/calls/create/route.ts:41-56](../app/api/calls/create/route.ts#L41-L56).

## 2. Classification Logic (plain English)

- **Prospect processor** — maps the single NAH host email to a slug: `matt*` → `matt_call` (or `matt_final_call` if title contains "final"/"award"), `sam*` → `sam_call`, `mark*`/`altacapital` → `mark_call`, `nora*`/`chad*` → `intro_call`. Unknown host or no host → `intro_call` default. See [prospect-processor.ts:12-35](../lib/calls/processors/prospect-processor.ts#L12-L35).
- **Coaching processor** — always hardcoded slug `coaching_call` ([L31-35](../lib/calls/processors/coaching-processor.ts#L31-L35)).
- **Group processor** — `team_call` if classifier marked it `internal`, else **null** for group calls with external non-prospects ([L18-30](../lib/calls/processors/group-processor.ts#L18-L30)).
- **GHL cron** — regex matches event title against a 5-entry table; falls back to `intro_call` ([L15-28](../app/api/cron/sync-ghl-calendar/route.ts#L15-L28)).
- **Manual UI** — user picks from a dropdown; empty selection stored as null ([create/route.ts:46](../app/api/calls/create/route.ts#L46)).

## 3. Gaps

- **Silent nulls.** Group processor writes `call_type_id = null` for any external-participant group call; manual form allows blank submit. Nulls break [grader.ts:40](../lib/calls/grader.ts#L40) ("Call has no call type assigned") and rubric loader.
- **Title-regex fragility.** GHL cron guesses from free-text titles; any retitled event misroutes (default `intro_call` swallows miscategorization silently).
- **Cron overwrites.** [sync-ghl-calendar/route.ts:132-144](../app/api/cron/sync-ghl-calendar/route.ts#L132-L144) unconditionally re-sets `call_type_id` on every re-sync, can clobber a correct value set later by a Read.ai processor.
- **Host-email heuristic misfires.** Prospect processor reads only one NAH email; co-hosted calls (Matt + Nora) classify by whichever the classifier chose and can flip between `matt_call` and `intro_call`.
- **Four independent rule sets.** No shared `classifyCallType()` — slug drift is silent. `coaching_call`/`team_call`/`intro_call` slugs are string literals copy-pasted across processors.

## 4. Recommended Fix Direction

Consolidate into a single `lib/calls/classify-type.ts` helper that takes `{title, nah_emails[], is_internal, has_external, has_territory_owner}` and returns a slug (never null — reserve an `unclassified` slug for review). Call it from all four entry points, make `call_type_id NOT NULL` once backfilled, and guard the GHL cron from overwriting values set by a higher-signal source (Read.ai) by only updating `call_type_id` when the row's `source = 'ghl_calendar'`.
