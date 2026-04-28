---
Last verified: 2026-04-27
Source: code (lib/scout/)
---

# Scout — AI Sales Coach

Scout is the AI brain of the NAH Franchise OS. Powered by Claude Haiku 4.5.

---

## Identity

- **Name:** Scout
- **Tone:** Confident, direct, knowledgeable — like a top franchise sales coach
- **Behavior:** Reactive only — responds when asked, never acts autonomously
- **Core pattern:** Draft-Review-Confirm (DRC) — every outbound action is drafted, reviewed by human, confirmed before execution

---

## Tool-call loop

Scout uses Anthropic's tool-use API. The loop lives in `lib/scout/client.ts`:

1. User sends a message via `/api/scout/chat`
2. System prompt + user memory + knowledge base context injected
3. Claude processes and may call tools (see `docs/scout-tools.md`)
4. Tool results fed back to Claude for next iteration
5. Loop continues until Claude produces a text response (no more tool calls)
6. If a drafted action was produced, it's returned alongside the text response

**Max iterations:** Controlled by `maxToolCalls` in the conversation turn config.

---

## System prompt

Currently hardcoded in `lib/scout/client.ts` (line ~39).

**Tier 1 gap #1:** Externalize the system prompt to a database-backed config so changes don't require a deploy.

The prompt includes:
- Scout identity and behavior rules
- DRC pattern enforcement
- Role-based context (rep vs marketing vs leadership)
- Current date/time for temporal awareness
- User-specific memory (loaded per-user from `scout_user_memory` table)

---

## Knowledge base injection

Before each conversation turn, Scout loads relevant KB documents from the `knowledge_documents` table:
- Filtered by category relevance to the current page context
- Top-10 by priority score
- Injected as system context, not as tool results

**Tier 1 gap #1:** Expand KB capacity, add embedding-based retrieval (pgvector table exists but not wired).

---

## Intelligence context

When discussing a specific contact, Scout receives:
- Contact profile from `candidate_intelligence`
- Recent call logs
- Current pipeline stage and sub-task
- Objection history
- Score breakdown (financial, operational, engagement, momentum)

This context is assembled by the `get_entity` tool at runtime.

---

## Memory

Per-user persistent memory stored in `scout_user_memory` table.

After each conversation turn, Scout's response is analyzed for durable facts worth remembering. These are merged into the user's memory record asynchronously (fire-and-forget, never blocks the response).

Memory is loaded into the system prompt on each turn, giving Scout continuity across sessions.

---

## Adding a new tool

See `docs/scout-tools.md` for the tool catalog and the 3-file recipe for adding new tools.
