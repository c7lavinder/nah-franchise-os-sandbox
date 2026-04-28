Review the current changes against the NAH Franchise OS rubric. Run `git diff main...HEAD` (or `git diff --cached` if on main) to see what changed, then evaluate each item below.

## Review Checklist

### GHL Boundary

- Any new `fetch()` calls to `leadconnectorhq.com` outside `lib/ghl/client.ts`?
- Any new GHL API URL strings outside the wrapper?

### Scout / DRC Pattern

- Any Scout actions that skip Draft-Review-Confirm?
- Any new Anthropic SDK imports outside `lib/scout/`?

### Secrets

- Any hardcoded API keys, tokens, or passwords? Check for `sk-ant-`, `sk-`, `eyJ`, `password =`, `secret =` patterns.

### RLS Awareness

- Any new Supabase table access? If so, does it consider row-level security?
- Any `.from("table_name")` calls without appropriate user scoping?

### Auth Pattern

- Is `requireAuth` used correctly in new/modified API routes?
- Does the code check `if (user instanceof Response) return user;` immediately after?
- Admin-only routes have role check?

### Test Coverage

- Does this change touch a critical path? (`lib/ghl`, `lib/scout`, `lib/intelligence/scoring`, `app/api/auth`, `app/api/webhooks/*`)
- If yes, are there tests covering the change?

## Output Format

```
Code Review — NAH Rubric
═════════════════════════
  [pass/WARN/FAIL] GHL boundary
  [pass/WARN/FAIL] DRC pattern
  [pass/WARN/FAIL] No hardcoded secrets
  [pass/WARN/FAIL] RLS awareness
  [pass/WARN/FAIL] Auth pattern
  [pass/WARN/FAIL] Test coverage
═════════════════════════
  [GOOD TO GO / ISSUES FOUND — see details above]
```

For any WARN or FAIL, include the specific file and line.
