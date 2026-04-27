# NAH OS — Reorganization & Buildout Blueprint

**Version:** 1.0
**Created:** 2026-04-27
**Status:** Active — execution starts with Tier 0a
**Repo:** https://github.com/c7lavinder/nah-franchise-os-sandbox
**Live:** https://nah-franchise-os-sandbox.vercel.app

---

## How to use this doc

- **You (Corey):** Reflect on the plan, push back on anything that feels wrong, track progress
- **Claude Code:** Read end-to-end before any session. This is the canonical spec until `docs/master-plan.md` exists (created in Session A, then this doc retires)
- **Future contributors:** Start here, then read `README.md` once Session A lands
- **Update cadence:** This doc gets a status update at the end of each Tier/Session. After Session A, it gets superseded by `docs/master-plan.md` and moved to `docs/archive/blueprint-v1.md` (the only exception to the "no archive" rule, since this doc is the historical record of how we got there)

---

## 1. Project Context

### What NAH OS is

- Internal AI-first platform for **New Again Houses** (house-flipping franchise)
- Backbone for **franchise sales + ongoing coaching** at scale
- Goal: support hundreds of franchisees who each buy 10+ houses/year
- Eventually a wing of MasterSuite (parked — not designing for that today)

### The team

| Role | People | Access pattern |
|---|---|---|
| Owner / planner | Corey | Everything |
| Admin | Matt, Ryland | Everything |
| Operator | Chad | All actions on his contacts |
| Specialists | Sam, Mark, John | Their assigned calls + read all |

### The non-negotiable principle

**Draft → Review → Confirm.** Scout never acts without human approval. This pattern is sacred and gets enforced everywhere — code, prompts, skills, agents.

---

## 2. Where we actually are (honest read)

### What's shipped and working

- Next.js 14 App Router, 11 authenticated pages, ~70 API routes
- Scout AI tool-call loop with 15 tools, Claude Haiku 4.5
- GHL client with OAuth + PIT fallback, retry logic, ~30 wrappers
- Intelligence engine (6 tables, 100-pt scoring, 1,987 profiles bootstrapped)
- Workflow engine (7 tables, A/B testing, approvals, health scoring)
- Accountability engine (5 monitoring checks)
- Call log system (4 call types, transcript analyzer, grading endpoint)
- TypeScript strict, 0 errors

### What's broken or rotted

- **~70 API routes are unauthenticated server-side** — anyone can impersonate any user
- **Daily HQ scorecards are misleading** — count only Scout actions, not real GHL activity
- **fetchTasks capped at 10 contacts** — reps with 20 leads see half their tasks
- **579 KB CSV with 1,389 real customer contacts** sitting in repo root (gitignored, but still)
- **Scout system prompt hardcoded** — every prompt change is a deploy
- **Two parallel scoring systems** confuse Scout and humans
- **Schema fragmented** across `supabase/migrations/`, `lib/intelligence/schema.sql`, `lib/workflows/schema.sql`
- **Untyped Supabase client** — every `.from('table')` returns `any`
- **Zero tests, zero CI**
- **Doc drift is severe:** `docs/memory.md` says Phase 0, reality is Phase 4. Six "instructions" files exist; only `handoff.md` is current
- **Duplicate `/commands/` and `.claude/commands/`** dirs have already drifted apart
- **Broken slash commands** (`/next`, `/status`) confidently produce wrong output

### What's parked

- MasterSuite integration (not in scope today)
- Vonage (not in scope — GHL handles SMS)
- Coaching pipeline design (deferred until real franchisee in system)

---

## 3. Critical findings (the urgent stuff)

| Finding | Severity | Effort | Slot |
|---|---|---|---|
| `git push --force` to main = production, no guardrails | 🔴 Existential | 30 min | Tier 0a |
| ~70 unauthenticated API routes | 🔴 Existential | 1 day | Tier 0b |
| Customer data + potential secrets in repo (working tree + history) | 🔴 Existential | 1 day | Tier 0c |
| Doc drift across 6 files | 🟡 High | Session A | Session A |
| Schema fragmented | 🟡 High | Session A | Session A |
| No CI, no tests, untyped Supabase | 🟡 High | Session B | Session B |
| Hardcoded Scout prompt | 🟢 Medium | Tier 1 | Tier 1 |
| Two scoring systems | 🟢 Medium | Tier 1 | Tier 1 |

---

## 4. Locked philosophy

### Cleanup
- **Delete by default. No archive directory.** Git history is the archive.
- **Burn broken before building new.** Don't leave broken `/next` / `/status` "until replacement lands."
- **Single source of truth per concern.** One README, one CLAUDE.md, one master-plan, one handoff.

### Structure
- **Right-sized for solo + occasional contributors.** Not enterprise overhead.
- **No `/sprints/` directory.** Roadmap lives in `master-plan.md` checkboxes.
- **No `docs/archive/`.** Exception: this blueprint after it retires.
- **No CHANGELOG.md.** Commits + ADRs cover it.
- **No staging environment yet.** Sandbox + production until load justifies.

### Engineering rigor
- **TypeScript strict + typed Supabase client.** No `any` in production code.
- **CI on every PR.** Type-check + lint + test. Block merges on failure.
- **Critical paths have smoke tests.** Scout, GHL, scoring, webhooks, auth.
- **Migrations are numbered and reversible.** No more `lib/*/schema.sql`.
- **Secrets in env vars only.** Never in code, never in `app_settings`.

### Doc discipline
- **Front matter on every doc:** `Last verified: YYYY-MM-DD`, `Source: code | manual | session`
- **Stale warning:** > 14 days flagged
- **`/wrap-session` mandatory** at end of every Claude Code session
- **`/verify-claims` before any doc PR**

### Webhooks decision (LOCKED)
- **Keep the GHL webhook handler. Drop "no webhooks" rule from CLAUDE.md.**
- Polling-only doesn't scale to hundreds of franchisees (500 GHL calls/min at 100 reps)
- Handler is built; just needs error-fix + GHL config verification

### Superpowers decision (LOCKED)
- **Pass entirely.** Cherry-picking fights the all-or-nothing install pattern.
- Build NAH-native versions of `code-reviewer` agent (cleaner than maintaining a partial install of someone else's framework).

---

## 5. Final repo structure

```
/
├── README.md                  Team onboarding, < 30 min to productive
├── CLAUDE.md                  Scout + Claude Code rules
├── CONTRIBUTING.md            How to work in this repo
├── handoff.md                 Last session state (auto-regenerated)
├── .env.example               Documented env vars
├── .gitignore                 Tightened (Tier 0c)
│
├── /docs/
│   ├── master-plan.md         Source of truth: state + roadmap + open decisions
│   ├── system-shape.md        Architecture + data model + pipelines (replaces 1055-line architecture.md)
│   ├── scout.md               Behavior, tools, prompts, RAG strategy
│   ├── scout-tools.md         Tool catalog
│   ├── integrations.md        GHL, Read.ai, Zorakle, MasterSuite (future)
│   ├── team.md                Roles, permissions, GHL mapping
│   ├── runbook.md             What to do when X breaks
│   ├── security.md            Auth model, RLS, secrets, data handling
│   ├── data-model.md          DB schema reference
│   └── /adr/                  Architectural Decision Records
│       ├── 0001-ghl-divorce.md
│       ├── 0002-supabase-source-of-truth.md
│       ├── 0003-draft-review-confirm.md
│       ├── 0004-eos-embedded-not-standalone.md
│       ├── 0005-keep-webhooks.md
│       └── (more as decisions are made)
│
├── /.claude/
│   ├── settings.json          Hooks + permission allowlist
│   ├── /commands/             Slash commands
│   ├── /skills/               NAH skills + installed third-party
│   ├── /hooks/                Hook scripts
│   └── /agents/               Subagent definitions
│
├── /tests/
│   └── /critical-paths/       Smoke tests for things that must never silently break
│
├── /scripts/
│   └── README.md              Index + classification (one-shot vs recurring)
│
├── /supabase/
│   └── /migrations/           THE source of schema (lib/*/schema.sql get moved here)
│
├── .github/
│   ├── workflows/ci.yml       tsc + lint + test on PR
│   └── pull_request_template.md
│
└── (existing /app, /lib, /components, /types, /public)
```

---

## 6. Naming conventions (locked)

| Type | Convention | Example |
|---|---|---|
| Docs in `/docs/` | `kebab-case.md` | `master-plan.md`, `system-shape.md` |
| Repo-root convention files | `UPPER_CASE.md` | `README.md`, `CLAUDE.md`, `CONTRIBUTING.md` |
| Auto-regenerated state | `lowercase.md` | `handoff.md` |
| ADRs | `NNNN-kebab-slug.md` | `0001-ghl-divorce.md` |
| Slash commands | kebab-case in `.claude/commands/` | `wrap-session.md`, `audit-docs.md` |
| Custom skills | kebab-case dir with `SKILL.md` | `migration-safety-check/SKILL.md` |
| Tests | `*.test.ts` next to file, OR in `/tests/` for cross-cutting | `client.test.ts`, `tests/critical-paths/auth.test.ts` |
| Migrations | `NNN_snake_case.sql` | `006_intelligence_tables.sql` |

---

## 7. Execution roadmap

### Tier 0 — Existential fixes (run before any restructure)

| Phase | Effort | Prompt file | Output |
|---|---|---|---|
| **0a — Git guardrails install** | 30 min | `TIER_0A_GIT_GUARDRAILS.md` | Dangerous git commands blocked |
| **0b — Auth retrofit** | 1 day | `TIER_0B_AUTH_RETROFIT.md` | ~70 routes secured + 5 auth tests |
| **0c — Data privacy audit** | 1 day | `TIER_0C_DATA_PRIVACY_AUDIT.md` | Customer data → DB, secrets → env, history scrub recommendation |

### Sessions A–C — Foundation buildout

| Session | Effort | Phase 0 cleanup + main work |
|---|---|---|
| **A — Doc reorg** | 4–6 hrs | Delete dead docs, consolidate migrations, create master-plan + system-shape + runbook + security + data-model + scout + scout-tools + integrations + team, write 5–10 ADRs from `docs/memory.md` "Decisions Made", drop `commands/` root duplicate, kill `/next` `/status` `/audit`, fix README, update CLAUDE.md (drop no-webhooks rule), `data/` and `migration/` resolved, `node-cron` removed, `.env.example` reconciled |
| **B — Foundation tooling** | 4–6 hrs | `setup-pre-commit` install, `npx supabase gen types typescript` + wire `createClient<Database>()`, `.github/workflows/ci.yml`, `.github/pull_request_template.md`, vitest installed, 5–10 critical-path smoke tests, `.claude/settings.json` with hook list + Bash allowlist |
| **C — Custom skills + hooks + agents** | 4–6 hrs | Build the 7 skills + 2 agents + 3 hooks (see §10–§13), delete deprecated commands |

### Tier 1 — Feature gaps (after foundation lands)

Per CC's recommended sequencing:

| Order | Gap | Effort |
|---|---|---|
| 1 | Form webhook config + policy decision (#7) | 1–2 days |
| 2 | Real users in GHL (#3) | 3–5 days |
| 3 | Daily HQ wiring per-user (#2) | 1 week |
| 4 | LLM depth — externalize Scout prompt, expand RAG (#1) | 1–2 weeks |
| 5 | Multi-contact + multi-territory calls (#4) | 2 weeks |
| 6 | Per-call-type grading (#5) | 1–2 weeks |
| 7 | MasterSuite — needs scoping conversation first | 3–4 weeks once scoped |

**Vonage:** dropped for now. GHL handles SMS.

---

## 8. What gets deleted

### Session A deletes

| File / dir | Reason |
|---|---|
| `SESSION_START.md` | Duplicate of README, stale |
| `docs/memory.md` | Critical drift, no owner. Decisions migrate to ADRs |
| `docs/PROGRESS.md` | Frozen, superseded by handoff.md |
| `docs/build-plan.md` | Overtaken by handoff.md |
| `docs/architecture.md` | 1055 lines, mostly wrong. Replaced by system-shape.md |
| `commands/` (root) | Duplicate of `.claude/commands/`, drifted |
| `.claude/commands/audit.md` (20 KB) | Never run end-to-end. Replaced by focused `/audit-docs` |
| `.claude/commands/next.md` | Reads from stale memory.md, broken |
| `.claude/commands/status.md` | Same root cause |
| `node-cron` from `package.json` | Dead dep |
| `migration/` (root) | Orphaned from `supabase/migrations/` |
| `data/` (root) | Resolved in Tier 0c; deleted if empty |

### Tier 0c deletes (data privacy)

| File / dir | Action |
|---|---|
| `CT Contact Master - Sheet1.csv` | Move to Supabase, delete from repo |
| Any other customer data files | Same pattern |
| Hardcoded secrets | Move to env vars |

### NEVER delete without verification

- Any file in `/app/`, `/lib/`, `/components/` without `grep -r` first
- Any migration in `/supabase/migrations/`
- `handoff.md`, `CLAUDE.md`, `README.md`

---

## 9. Slash commands (final — 5 total)

| Command | Purpose | Output target |
|---|---|---|
| `/wrap-session` | End-of-session, regenerates handoff.md | `handoff.md` |
| `/audit-docs` | Doc-vs-code drift check | ≤ 20 lines, ✓/✗/⚠ format |
| `/verify-claims` | Scan README+CLAUDE for stale numbers | ≤ 20 lines |
| `/draft-adr` | Template a new ADR | New file in `docs/adr/` |
| `/load-context` | Manual SessionStart trigger if hook fails | ≤ 5 lines briefing |

**Each has one job.** Output bounded. No 200-line walls of text.

---

## 10. Custom skills (final — 7 total, dependency-ordered)

| # | Skill | Trigger | Why |
|---|---|---|---|
| 1 | `migration-safety-check` | `PreToolUse(Edit)` on `*.sql` | Schema across 3 places — destructive ALTER risk highest |
| 2 | `nah-context-load` | `SessionStart` hook | Reads `handoff.md` + last 5 commits, ≤ 5 lines |
| 3 | `verify-claims` | `/verify-claims` and `/audit-docs` | Drift defense |
| 4 | `new-adr` | `/draft-adr` | Replaces graveyard of decisions in old memory.md |
| 5 | `ghl-boundary-check` | `PreToolUse(Edit)` on `lib/`, `app/api/` | Enforces GHL goes through `lib/ghl/client.ts` |
| 6 | `scout-tool-add` | When `lib/scout/tools.ts` changes | Coordinates 3 required edits (tools, executor, docs) |
| 7 | `deploy-readiness` | Manual or pre-push | tsc clean, no console.log, env match |

---

## 11. Custom agents (final — 2 total)

| Agent | Purpose | When invoked |
|---|---|---|
| `code-reviewer` | Reviews against NAH rubric (GHL boundary, DRC pattern, no hardcoded secrets, RLS-aware) | After major code change |
| `migration-reviewer` | Schema review (idempotency, RLS, indexes, FKs, breaking ALTER detection) | After migration write |

**Built NAH-native, not cherry-picked from Superpowers.** Cleaner ownership.

---

## 12. Hooks (final — 3 total)

| Hook | Action | Skill called |
|---|---|---|
| `SessionStart` | Auto-load context | `nah-context-load` |
| `PreToolUse(Bash)` | Block dangerous commands | git-guardrails (Tier 0a) |
| `PreToolUse(Edit)` on `*.sql` | Force migration safety check | `migration-safety-check` |

**Dropped:** UserPromptSubmit DRC reminder (friction noise per CC).

---

## 13. Third-party plugins (final decisions)

| Plugin | Status | Reason |
|---|---|---|
| `mattpocock/skills/git-guardrails-claude-code` | ✅ Install (Tier 0a) | Highest ROI, lowest effort |
| `mattpocock/skills/setup-pre-commit` | ✅ Install (Session B) | Local quality gate |
| `obra/superpowers` (full plugin) | ❌ **Pass entirely** | All-or-nothing install fights NAH patterns |
| `obra/superpowers` cherry-pick | ❌ Skip | Build NAH-native versions instead |
| `mattpocock/skills/grill-me` | 🟡 Defer | Useful but not now |
| `mattpocock/skills/improve-codebase-architecture` | 🟡 Defer until ADRs exist | Skill needs CONTEXT.md + ADRs as inputs |
| `mattpocock/skills/triage-issue` | ❌ Skip | Workflow assumes GitHub Issues + TDD; we don't use either |

---

## 14. Engineering baseline (Session B specifics)

### Quality gates
- ✅ `npx tsc --noEmit` clean
- ✅ `npm run lint` clean (after lint config)
- ✅ `npm test` passes
- ✅ All gates run on PR via GitHub Actions
- ✅ All gates run locally via Husky pre-commit
- ✅ Block merges on failure (start strict, never tighten later)

### Type safety
- `npx supabase gen types typescript --project-id <id> > types/supabase.ts`
- `createClient<Database>(...)` everywhere
- Result: every `.from('table')` is fully typed
- Reconciliation needed: `types/database.ts` and `types/supabase.ts` overlap — pick one (auto-generated wins)

### Tests (5–10 to start)
1. GHL retry/auth logic — `lib/ghl/client.ts:188`
2. Scout tool-call loop — `lib/scout/client.ts:241`
3. Scoring engine — `lib/intelligence/scoring.ts:37`
4. Webhook dedup — `app/api/webhooks/ghl/route.ts:78`
5. Auth boundary — `requireAuth` rejects unauth, accepts authed
6. (Tier 0b adds 5 more for auth specifically)

### `.claude/settings.json` minimum
```json
{
  "hooks": {
    "SessionStart": [...],
    "PreToolUse": [...]
  },
  "permissions": {
    "allow": [
      "Bash(git status:*)",
      "Bash(git log:*)",
      "Bash(git diff:*)",
      "Bash(npx tsc:*)",
      "Bash(npm test:*)",
      "Bash(ls:*)",
      "Bash(cat:*)"
    ]
  }
}
```

---

## 15. Drift prevention strategy

The drift problem is the root of most pain in this repo today. Six "instructions" files, all stale except one.

### Procedural defenses
1. **`/wrap-session` mandatory** at end of every Claude Code session — automated via SessionEnd hook (Session C)
2. **`/audit-docs` weekly** — manual at first, GitHub Action eventually
3. **`/verify-claims` before any doc PR** — catches stale numbers (page count, table count, tool count)
4. **Front matter freshness contract** on every doc — `Last verified: YYYY-MM-DD` shows stale warning > 14 days
5. **Single source of truth per concern** — README is for humans, CLAUDE.md is for Claude, handoff.md is for state, master-plan.md is for roadmap. No overlap.

### What kills drift
- **Auto-regeneration where possible** — handoff.md regens via `/wrap-session`
- **Verification skills, not human discipline** — `verify-claims` catches what humans miss
- **Burn broken docs immediately** — leaving `/next` and `/status` in place caused real wrong-output incidents

---

## 16. What does NOT exist (intentional)

| Not built | Why |
|---|---|
| `/sprints/` directory | Solo + Claude operator. Roadmap = checkboxes in master-plan.md |
| `docs/archive/` | Git history is the archive. Exception: this blueprint after retirement |
| `docs/memory.md` | Replaced by handoff + ADRs + auto-memory |
| `CHANGELOG.md` | Commits + ADRs cover it for internal tool |
| Staging environment | Sandbox + production sufficient until franchisee load justifies |
| On-call rotation | Runbook exists; rotation parked until team grows |
| Per-rep RLS row filtering | Parked, ADR placeholder |
| MasterSuite integration | Parked until v1 complete |
| Vonage integration | Dropped — GHL handles SMS |

---

## 17. The 7 feature gaps + sequencing (Tier 1)

After Tier 0 + Sessions A/B/C land, this is the work order:

| # | Gap | Effort | Foundation in place? | Blockers |
|---|---|---|---|---|
| 1 | LLM depth (Scout conversation) | M (1–2 wks) | Yes | Hardcoded prompt; top-10 KB cap; no convo summarization |
| 2 | Daily HQ wiring per-user | M (1 wk) | Yes | scorecard reads only Scout actions; fetchTasks capped at 10 |
| 3 | Real users in GHL | S–M (3–5 d) | Schema yes, no admin UI | Auth retrofit (done in Tier 0b) |
| 4 | Multi-contact + multi-territory calls | M–L (2 wks) | Single-contact works | Schema migration + analyzer + UI |
| 5 | Per-call-type grading | M (1–2 wks) | Call types tagged, grade route exists | Need rubric per call_type, scoring is profile-level today |
| 6 | MasterSuite | L (3–4 wks) | None | Needs scoping doc first |
| 7 | Form submission webhook | S (1–2 d) | **Already wired** in `/api/webhooks/ghl/route.ts` | Verify GHL config, fix error swallowing |

**Recommended order:**
1. Form webhook (#7) — quick win
2. Real users (#3) — depends on auth retrofit
3. Daily HQ wiring (#2) — depends on #3
4. LLM depth (#1) — depends on #3 for per-user memory
5. Multi-contact calls (#4) — independent
6. Per-call grading (#5) — depends on #4
7. MasterSuite (#6) — last, needs scoping conversation

---

## 18. Status tracker (update as we go)

### Tier 0
- [x] **0a — git-guardrails install** — done 2026-04-27, merged to main (Session 9)
- [ ] **0b — Auth retrofit** — IN PROGRESS
  - Phase 2a complete — 15 Critical routes retrofitted (Session 10)
  - Phase 2b complete — frontend auth sweep, 94 files + JWT auto-refresh + force-logout (Session 11)
  - Phase 2c complete — 15 broken requireAdmin callers migrated, admin-check.ts deleted (Session 12)
  - Phases 2d-2f queued (Medium routes, cron tokens, webhook secrets)
- [ ] **0c — Data privacy audit** — prompt ready

### Sessions A–C
- [ ] **A — Doc reorg + cleanup** — prompt to draft after 0c lands
- [ ] **B — Foundation tooling** — prompt to draft after A lands
- [ ] **C — Custom skills + hooks + agents** — prompt to draft after B lands

### Tier 1
- [ ] **#7 — Form webhook config**
- [ ] **#3 — Real users in GHL**
- [ ] **#2 — Daily HQ per-user wiring**
- [ ] **#1 — LLM depth**
- [ ] **#4 — Multi-contact calls**
- [ ] **#5 — Per-call grading**
- [ ] **#6 — MasterSuite scoping → integration**

### Decisions log (lock as we go)
- ✅ Repo structure (§5)
- ✅ Naming conventions (§6)
- ✅ Cleanup philosophy (§4)
- ✅ Webhooks: keep + drop "no webhooks" rule
- ✅ Superpowers: pass entirely
- ✅ Vonage: dropped
- ✅ MasterSuite: parked until v1 complete
- ✅ No `/sprints/`, no `docs/archive/`, no CHANGELOG, no staging
- ✅ Cleanup is aggressive — delete by default, git history is the archive
- ✅ 5 slash commands, 7 custom skills, 2 custom agents, 3 hooks
- ✅ Engineering baseline: typed Supabase, CI on PR, smoke tests on critical paths
- ✅ Drift prevention: front matter + 3 commands + auto-regen handoff
- ✅ **Tier 0a hook (installed 2026-04-27):** hard-block PreToolUse hook for `git push`, `reset --hard`, `clean -fd`, `branch -D`, `checkout .`, `restore .` — `exit 2`, no approval prompt
- ✅ **Session B permissions architecture (locked, not yet built):**
  - Hard block (Tier 0a hook): force push, reset --hard, clean -fd, branch -D, rm -rf
  - Ask via `permissions.ask`: regular git push, npm install of new deps
  - Auto-allow via `permissions.allow`: status, log, diff, add, commit
  - Tier 0a hook is the "hard block" piece of this larger architecture
- ✅ **Solo-operator workflow (standing rule):** feature branch → push → merge to main → delete branch → wrap session. No PR review until CI gates land in Session B.

### Open questions / parking lot
- 🟡 Vonage scope if revisited later — replace GHL messaging or supplement for call recording
- 🟡 MasterSuite data direction (push vs pull) — needs scoping conversation
- 🟡 Per-rep RLS row filtering — separate ADR + sprint
- 🟡 JWT in localStorage → httpOnly cookies migration — separate prompt after Tier 0b
- 🟡 OAuth token storage cleanup (currently JSON-stringified in `app_settings`) — cleanup pass later
- 🟡 Two scoring systems consolidation — pick `lib/intelligence/scoring.ts`, migrate `lib/profile/lead-scoring.ts`, delete

---

## 19. Quick reference for Claude Code

If you're a Claude Code session reading this for the first time:

1. **Current state:** see §2. Trust this over any other doc until `master-plan.md` exists.
2. **What you're working on now:** check §18 status tracker — find the next unchecked item.
3. **Hard rules:**
   - Don't push to main without explicit approval
   - Don't merge without explicit approval
   - Don't delete files without `grep -r` first
   - Don't refactor unrelated code "while you're here"
   - Run `npx tsc --noEmit` before commit
   - One commit per logical change
4. **When in doubt:** check this doc's §4 (locked philosophy) for the principle that applies.
5. **When you finish a session:** run `/wrap-session` (or generate the equivalent updates to `handoff.md` if the command isn't built yet).

---

## 20. Living doc rules

- Update §18 status tracker after every Tier/Session completes
- Update "Open questions" as items resolve or new ones surface
- Update "Decisions log" as new locks happen
- After Session A lands and `docs/master-plan.md` exists, this doc retires:
  - Move to `docs/archive/blueprint-v1.md`
  - `master-plan.md` takes over as the active source of truth
  - This is the **only exception** to the no-archive rule (this doc is the historical record of how the structure was built)

---

## Change log

| Date | Change |
|---|---|
| 2026-04-27 | v1.0 — initial blueprint, all decisions locked, Tier 0 prompts drafted |

---

**END OF BLUEPRINT**
