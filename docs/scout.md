---
Last verified: 2026-05-29
Source: code (lib/scout/)
---

# Scout — AI Sales Coach

Scout is the AI brain of the NAH Franchise OS. It uses an Opus orchestrator on the first LLM iteration and a Haiku executor on follow-up iterations.

---

## Identity

- **Name:** Scout
- **Tone:** Confident, direct, knowledgeable — like a top franchise sales coach
- **Behavior:** Reactive only — responds when asked, never acts autonomously
- **Core pattern:** Draft-Review-Confirm (DRC) — every outbound action is drafted, reviewed by human, confirmed before execution

---

## Tool-call loop

Scout uses Anthropic's tool-use API. The non-streaming loop lives in `lib/scout/client.ts`; the SSE loop lives in `lib/scout/stream.ts`.

1. User sends a message via `/api/scout/chat`
2. System prompt + user memory + knowledge base context injected
3. Claude processes and may call tools (see `docs/scout-tools.md`)
4. Tool results fed back to Claude for next iteration
5. Loop continues until Claude produces a text response (no more tool calls)
6. If a drafted action was produced, it's returned alongside the text response

**Max iterations:** 15 tool-call iterations.

---

## System prompt

Prompt assembly happens in `buildSystemPrompt()` in `lib/scout/client.ts`.

Prompt sections are mixed from code, runtime context, and DB-backed overrides:
- `scout_identity`, `scout_profile_context`, and `scout_calendars` can be overridden through `app_settings`.
- `scout_rules` is intentionally code-only so stale DB content cannot override DRC, source attribution, prompt-injection, or compliance rules.
- LLM calls log compact `prompt_version` and `prompt_blocks` metadata in `llm_call_logs` for auditability.

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
- Top-25 by priority score
- Injected as system context, not as tool results

Scout also pre-fetches relevant retrieval chunks for some questions through the RAG classifier/retriever path and logs retrieval quality separately.

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

See `docs/scout-tools.md` for the current 37-tool catalog and the 3-file recipe for adding new tools.
