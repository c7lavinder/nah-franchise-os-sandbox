# Contributing — NAH Franchise OS

How to work in this repo for both humans and Claude Code.

---

## Branch naming

Use kebab-case prefixed by type:

- `feat/add-territory-search`
- `fix/daily-hq-auth-error`
- `chore/update-dependencies`
- `docs/add-runbook-section`
- `refactor/consolidate-scoring`

---

## Commit format

Conventional commits:

```
feat(auth): add requireAuth to pipeline routes
fix(daily-hq): show actual error status on failure
chore(deps): update vitest to 4.x
docs(scout): update tool catalog
refactor(db): consolidate schema into numbered migrations
test(auth): add admin role check tests
```

Always end with:

```
Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

---

## Solo workflow

Current team is solo (Corey + Claude Code). Workflow:

1. Create feature branch (for multi-file changes)
2. Commit scoped changes with conventional commit messages
3. **Pre-commit hook auto-runs:** lint-staged (Prettier) + tsc --noEmit + npm test
4. Push to origin — **CI auto-runs:** tsc + lint + test (GitHub Actions)
5. Merge to main (fast-forward)
6. Delete branch (local + remote)
7. Vercel auto-deploys from main in ~3 minutes

For single-file fixes, commit directly to main is acceptable.

### Quality gates (enforced automatically)

| Gate             | Where                    | What                                |
| ---------------- | ------------------------ | ----------------------------------- |
| Prettier format  | Pre-commit (lint-staged) | Formats staged .ts/.tsx/.json/.md   |
| TypeScript check | Pre-commit + CI          | `npx tsc --noEmit`                  |
| Tests            | Pre-commit + CI          | `npm test` (27 critical-path tests) |
| Lint             | CI only                  | `npm run lint` (next lint)          |

### Supabase type regeneration

When `supabase/migrations/*` changes, regenerate types:

```bash
npx supabase login                    # one-time
npx supabase gen types typescript --project-id llnrvophuvrqcqducgrr > types/supabase.ts
```

---

## When to add a test

- New auth pattern or security boundary
- Bug fix that could regress
- Critical business logic (scoring, pipeline stage moves)

Tests live in `tests/critical-paths/` and use vitest.

---

## When to add an ADR

Create a new `docs/adr/NNNN-kebab-slug.md` when:

- A significant architectural decision is made
- A technology is chosen or rejected
- A pattern is established that future code must follow
- A previous decision is reversed

---

## When to update docs

- `docs/master-plan.md` — after completing a tier/session/milestone
- `handoff.md` — at end of every session (`/wrap-session`)
- `docs/security.md` — when auth model changes
- `docs/scout-tools.md` — when Scout tools are added/removed
- `CLAUDE.md` — when new rules or patterns are established

---

## Claude Code infrastructure (.claude/)

Custom skills, hooks, and slash commands that enforce NAH patterns automatically.

### Skills (.claude/skills/)

| Skill                        | What it does                                                            | Triggered by                                        |
| ---------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------- |
| `migration-safety-check`     | SQL edit checklist (idempotency, RLS, rollback, defaults, large tables) | PreToolUse(Edit) hook on \*.sql + skill description |
| `nah-context-load`           | 5-line status briefing from handoff.md + git log                        | `/load-context` command, skill description          |
| `verify-claims`              | Checks doc numbers against actual code                                  | `/verify-claims`, `/audit-docs` commands            |
| `new-adr`                    | Auto-numbered ADR template creation                                     | `/draft-adr` command                                |
| `ghl-boundary-check`         | Blocks GHL/Anthropic SDK outside their wrappers                         | PreToolUse(Edit) hook on lib/ and app/api/          |
| `scout-tool-add`             | 3-file coordination reminder for Scout tools                            | Skill description (when editing tools.ts)           |
| `deploy-readiness`           | Pre-push checklist (tsc, tests, secrets, env vars)                      | Skill description, manual invocation                |
| `git-guardrails-claude-code` | Setup instructions for git safety hooks                                 | Manual invocation                                   |

### Hooks (.claude/settings.json)

| Event            | Script                         | What it does                                   |
| ---------------- | ------------------------------ | ---------------------------------------------- |
| PreToolUse(Bash) | `block-dangerous-git.sh`       | Blocks destructive git/fs/SQL commands         |
| PreToolUse(Edit) | `migration-safety-reminder.sh` | Surfaces SQL checklist on \*.sql edits         |
| PreToolUse(Edit) | `ghl-boundary-check.sh`        | Hard-blocks GHL/Anthropic SDK outside wrappers |

### Slash commands (.claude/commands/)

| Command             | What it does                                                      |
| ------------------- | ----------------------------------------------------------------- |
| `/wrap-session`     | Updates handoff.md with session summary                           |
| `/load-context`     | Shows current phase, last commit, open issues, next step          |
| `/verify-claims`    | Checks doc numbers against code                                   |
| `/audit-docs`       | Full doc audit (expanded verify-claims)                           |
| `/draft-adr`        | Creates new ADR with auto-detected next number                    |
| `/review-code`      | Reviews changes against NAH rubric (GHL, DRC, secrets, RLS, auth) |
| `/review-migration` | Reviews SQL changes (idempotency, RLS, indexes, FK, rollback)     |

### How to add a new skill

1. Create `.claude/skills/<skill-name>/SKILL.md` with frontmatter:
   ```yaml
   ---
   name: skill-name
   description: When to trigger — be specific about file patterns and user intents.
   ---
   ```
2. Write the skill body with clear steps and expected output format
3. If it needs automatic enforcement, add a hook script in `.claude/hooks/` and register it in `.claude/settings.json`
4. Add a slash command in `.claude/commands/` if it should be user-invocable

---

## What NOT to do

- Don't refactor unrelated code while working on a scoped task
- Don't commit customer data (CSV, XLSX) — `.gitignore` blocks them
- Don't commit `.env.local` — only `.env.local.example` with placeholders
- Don't hardcode API keys in source — always `process.env.*`
- Don't skip `npx tsc --noEmit` before pushing
