---
name: deploy-readiness
description: Use before pushing significant changes, when user asks 'is this ready to ship?', 'can I push?', 'deploy check', or before merging to main. Runs a pre-deploy checklist.
---

# Deploy Readiness Check

Run this checklist before pushing to main or merging a feature branch.

## Checks

Run each check and report results:

### 1. TypeScript clean

```bash
npx tsc --noEmit
```

Must exit 0 with no errors.

### 2. Tests passing

```bash
npm test
```

All tests must pass (currently 27 critical-path tests).

### 3. No console.log in changed files

```bash
git diff main...HEAD -- '*.ts' '*.tsx' | grep '^\+.*console\.log'
```

If on main, check staged files instead:

```bash
git diff --cached -- '*.ts' '*.tsx' | grep '^\+.*console\.log'
```

Flag any matches. `console.error` and `console.warn` are acceptable.

### 4. No hardcoded secrets

Check changed files for patterns:

- `sk-ant-` (Anthropic keys)
- `sk-` followed by 20+ chars (OpenAI keys)
- `eyJ` followed by 30+ chars (JWT tokens)
- `password = "` or `secret = "` with actual values

### 5. Env vars match .env.example

Compare env vars used in code (`process.env.SOMETHING`) against `.env.local.example`. Flag any new env vars that aren't documented.

## Output Format

```
Deploy Readiness — [date]
────────────────────────
  [pass] TypeScript: 0 errors
  [pass] Tests: 27/27 passing
  [pass] No console.log in changes
  [pass] No hardcoded secrets
  [pass] Env vars documented
────────────────────────
  READY TO SHIP
```

Or if issues found:

```
  [FAIL] TypeScript: 3 errors (list them)
  [WARN] console.log found in app/api/foo/route.ts:42
  ────────────────────────
  NOT READY — fix issues above
```
