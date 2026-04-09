# Tonight's Build — NAH Franchise OS LLM Layer
**Date:** 2026-04-09
**How to use this:** Copy the session start prompt below into Claude Code in VS Code. Work through sprints in order. Do not skip.

---

## Step 1 — Move Planning Docs to Repo

Before starting any sprint, move all planning docs into the repo:

```bash
# In your repo root, create the planning docs directory
mkdir -p docs/llm-planning

# Copy all planning files from wherever you saved them:
# - LLM_SESSION_CONTEXT.md
# - NAH_Profile_Tab_v2_Expanded.md
# - NAH_KB_Taxonomy.md
# - NAH_GHL_Execution_List.md
# - NAH_Scout_Intelligence_Design.md
# - NAH_Scout_Business_Intelligence.md
# - LLM_SPRINT_1_FOUNDATION.md
# - LLM_SPRINT_2_CALL_DETAILS.md
# - LLM_SPRINT_3_GHL_EXECUTION.md
# - LLM_SPRINT_4_SCOUT_INTELLIGENCE.md
# - LLM_SPRINT_5_KB_LEARNING.md

# Commit planning docs
git add docs/llm-planning/
git commit -m "docs: add LLM layer planning docs from 2026-04-09 session"
```

---

## Step 2 — Session Start Prompt (paste this into Claude Code)

```
Read these files before doing anything:
1. docs/memory.md
2. docs/llm-planning/LLM_SESSION_CONTEXT.md

Then confirm:
- What sprints exist in docs/llm-planning/
- Current state of: lib/scout/, lib/calls/grader.ts, lib/calls/coach.ts, lib/calls/brief-generator.ts
- Current Supabase tables (query to list all tables and their column counts)
- Whether pgvector extension is enabled in Supabase
- Current cron jobs registered in the system

Report your findings. Do not write any code yet. Wait for my approval to start Sprint LLM-1.
```

---

## Step 3 — Sprint Sequence

Run sprints in this exact order. Each sprint builds on the previous.

| Sprint | File | Do first | Why |
|---|---|---|---|
| LLM-1 | `LLM_SPRINT_1_FOUNDATION.md` | ✅ Tonight | Schema + RAG + journals — everything depends on this |
| LLM-2 | `LLM_SPRINT_2_CALL_DETAILS.md` | ✅ Tonight if time | Highest daily value — call processing + action cards |
| LLM-3 | `LLM_SPRINT_3_GHL_EXECUTION.md` | Next session | GHL finalization — can run parallel to LLM-4 |
| LLM-4 | `LLM_SPRINT_4_SCOUT_INTELLIGENCE.md` | Next session | Scout rebuild — depends on LLM-1 + LLM-2 |
| LLM-5 | `LLM_SPRINT_5_KB_LEARNING.md` | Last | KB + learning — builds on all previous sprints |

**Tonight: Sprint LLM-1 is the priority. Get it fully done. LLM-2 if there's time and energy.**

---

## Step 4 — Sprint Prompt Template

For each sprint, paste this:

```
Read docs/llm-planning/LLM_SPRINT_[X]_[NAME].md carefully.
Also read docs/llm-planning/LLM_SESSION_CONTEXT.md if you need context.

Before writing any code:
1. Confirm you understand all tasks
2. List any questions or blockers
3. Identify files you'll need to create or modify
4. Confirm no existing functionality will break

Wait for my approval before starting.
```

---

## Step 5 — End of Session Wrap

At the end of every Claude Code session, run:

```
/wrap-session
```

This updates docs/memory.md, writes docs/handoff.md, and logs all decisions and bugs.
If /wrap-session doesn't work, manually ask Claude Code to:
1. Update docs/memory.md with what was built tonight
2. Write docs/handoff.md with: what's done, what's next, any bugs found
3. Commit everything with message: "feat: LLM Sprint [X] complete"

---

## Key Reminders for Claude Code

- **Never auto-push to main** — all work on feature branches
- **Dry-run all migrations** before executing
- **Preserve all 46 existing profile fields** — do not rename or remove
- **Draft → Review → Confirm** on every Scout action — no exceptions
- **GHL workflows are NOT used** — all workflow logic in NAH OS
- **pgvector for embeddings, Supabase direct for structured data** — never reverse this
- **Self-audit before finalizing**: Write → Question (18 checks) → Improve → Validate

---

## What This Builds When Complete

| Capability | Sprint |
|---|---|
| 199 profile fields with source badges | LLM-1 + LLM-4 |
| pgvector RAG with hybrid retrieval | LLM-1 |
| 3-type journal system at 11pm | LLM-1 |
| Call details auto-processing | LLM-2 |
| Edit/Skip/Push action cards | LLM-2 |
| Learning feedback logging | LLM-2 |
| All 30 GHL actions finalized | LLM-3 |
| 7 calendars wired to sub-tasks | LLM-3 |
| Permissions per role enforced | LLM-3 |
| Pre-call brief (8 sections) | LLM-4 |
| Business intelligence queries | LLM-4 |
| Scout context awareness | LLM-4 |
| KB seeded from existing sources | LLM-5 |
| Weekly performance report | LLM-5 |
| Monthly rubric review prompt | LLM-5 |
