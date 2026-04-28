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

| Gate | Where | What |
|---|---|---|
| Prettier format | Pre-commit (lint-staged) | Formats staged .ts/.tsx/.json/.md |
| TypeScript check | Pre-commit + CI | `npx tsc --noEmit` |
| Tests | Pre-commit + CI | `npm test` (27 critical-path tests) |
| Lint | CI only | `npm run lint` (next lint) |

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

## What NOT to do

- Don't refactor unrelated code while working on a scoped task
- Don't commit customer data (CSV, XLSX) — `.gitignore` blocks them
- Don't commit `.env.local` — only `.env.local.example` with placeholders
- Don't hardcode API keys in source — always `process.env.*`
- Don't skip `npx tsc --noEmit` before pushing
