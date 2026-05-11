# ADR-0012: Scout LLM Gap Analysis

## Status

Accepted — 2026-05-11

## Context

Matt and Corey tested Scout extensively on 2026-05-11. Five critical gaps surfaced from real conversations that prevent Scout from being the daily-driver coaching and intelligence tool it needs to be.

The gaps were identified from actual user sessions — not hypothetical. Each one caused a visible failure or frustration during real use.

## The Five Gaps

### Gap 1: No proactive coaching loop for Chad

**What happened:** Matt asked "How do you give Chad this feedback consistently?" Scout admitted it can't — it only responds when asked.

**What's needed:** A structured, automated coaching rhythm that Chad sees without asking. Daily top-3 leads needing action, overdue follow-ups, call quality trends, objection pattern alerts.

**Scope:**

- Daily coaching brief pushed to Chad (cron or notification)
- Weekly scorecard: leads contacted within 5 min, avg days per stage, calls completed, conversion by stage
- Rolling call grade trend across rubric dimensions — which skill is weakest this month
- Objection pattern alerts — "Capital objections are 39% and only X% resolve"

**Dependencies:** Call grading pipeline must be working. Pipeline data must be flowing (blocked until MasterSuite DB comes back online).

---

### Gap 2: Scout can't reliably find call history for a contact

**What happened:** Boettcher had a call on May 8. Scout said "no call history." Root cause: querying legacy `call_logs` table instead of `calls` via `call_participants`.

**What was fixed today:** Table join corrected. But the deeper issue remains — Scout has no dedicated "get calls for this contact" tool. Call data is spread across `calls`, `call_participants`, `call_data_extractions`, `call_action_items`, and `call_coaching`. Scout's `get_entity` does a basic lookup but doesn't surface summaries, grades, or action items.

**What's needed:** A `get_contact_calls` tool that returns:

- All calls for a contact (via call_participants)
- Each call's: title, date, duration, type, grade, AI summary, key action items
- Ordered most recent first, limited to last 10

---

### Gap 3: Conversations don't persist across page refreshes

**What happened:** Matt's conversations lost earlier exchanges when the page refreshed. The browser `historyRef` resets to empty, starting a new session. Previous context gone.

**What's needed:** When the Scout panel opens, load the user's most recent active session from Supabase and resume the conversation. The data is already saved — it's just not being loaded back.

**Scope:**

- On panel mount: fetch latest active session for this user
- Populate historyRef + sessionIdRef from the saved conversation_history
- Show previous exchanges in the chat UI (currently only shows latest response)
- Add "New conversation" button to explicitly start fresh

---

### Gap 4: Scout doesn't know data freshness

**What happened:** Scout saw zeros across all territories and wrote paragraphs speculating about "data integrity problems." The real issue: MasterSuite DB stopped writing on May 5 and sync crons were crashing.

**What was fixed today:** Rules updated to say "I don't have that data" instead of dramatizing. But Scout still has no way to know _why_ data is empty.

**What's needed:** Before answering data-heavy questions, Scout should check a lightweight freshness indicator:

- Last successful cron run for each sync job (from cron_job_log)
- If last sync > 24h ago, prepend: "Note: data was last synced [X ago]. Numbers may be stale."
- One sentence, no drama

**Implementation:** Add a `check_data_freshness` tool or inject freshness context into the system prompt at conversation start (cheaper — no tool call needed).

---

### Gap 5: FranDev vs Acquisitions separation at the tool level

**What happened:** Matt flagged that FranDev metrics and acquisition metrics must stay completely separate. "Leads", "conversion rate", and "lead flow" mean different things in each world.

**What was fixed today:** System prompt now has explicit two-world separation with ambiguous term examples.

**What's still needed:** The tools themselves don't enforce the boundary. `get_pipeline` returns the same structure for both worlds. `aggregate` can query across both without labeling.

**What's needed:**

- Tool responses should tag which world the data belongs to (FranDev or Acquisitions)
- `aggregate` results should include a `world: "frandev" | "acquisitions"` label
- Consider separate tool variants: `frandev_pipeline` vs `territory_performance` (already mostly true, but not enforced)

---

## Decision

Address these gaps in priority order:

| Priority | Gap                                     | Effort | Impact                             |
| -------- | --------------------------------------- | ------ | ---------------------------------- |
| 1        | Gap 2: Contact call history tool        | Small  | High — unblocks basic Q&A          |
| 2        | Gap 3: Session persistence              | Small  | High — conversation continuity     |
| 3        | Gap 4: Data freshness awareness         | Small  | Medium — stops confusion           |
| 4        | Gap 5: FranDev/Acquisitions tool labels | Medium | Medium — prevents metric mixing    |
| 5        | Gap 1: Proactive Chad coaching          | Large  | High — but depends on data flowing |

Gaps 1-4 can be built independently. Gap 5 is enforcement polish. Gap 1 is the biggest build and should wait until MasterSuite data is flowing again — coaching without data is useless.

## Consequences

- Gap 2 fix will surface call history that Scout currently misses — may reveal other data quality issues in call records
- Gap 3 will increase Supabase reads (loading session on every panel open) — negligible cost but should use a lightweight query
- Gap 4 freshness check adds a small latency to first response if implemented as a tool call — system prompt injection is zero-cost alternative
- Gap 5 tool labeling is a breaking change for any code that parses tool output — but only Scout consumes these tools, so impact is contained
- Gap 1 is a new cron + notification system — needs design review before building (daily brief cron exists but is generic, not Chad-specific)
