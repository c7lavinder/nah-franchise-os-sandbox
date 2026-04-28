---
name: verify-claims
description: Use when user asks to verify the docs, before publishing a doc change, or whenever they mention 'drift', 'is the doc current', or 'check claims'. Also invoked by /verify-claims and /audit-docs commands.
---

# Verify Claims

Scan key documentation files for numeric claims and verify them against actual code.

## Files to Scan

- `README.md`
- `CLAUDE.md`
- `docs/master-plan.md`
- `handoff.md`

## Claims to Verify

Check each file for these common claim types:

| Claim                                        | How to verify                                                                        |
| -------------------------------------------- | ------------------------------------------------------------------------------------ |
| Page count (e.g., "14 pages")                | `find app -name "page.tsx" \| wc -l`                                                 |
| API route count (e.g., "216 routes")         | `find app/api -name "route.ts" \| wc -l`                                             |
| Scout tool count (e.g., "24 tools")          | Count entries in `lib/scout/tools.ts`                                                |
| Test count (e.g., "27 tests")                | `npm test -- --reporter=verbose 2>&1 \| grep -c "pass\|fail"` or parse vitest output |
| Model name (e.g., "Claude Haiku 4.5")        | Check `lib/scout/client.ts` for model string                                         |
| Table count                                  | Count `CREATE TABLE` in `supabase/migrations/*.sql`                                  |
| Env var count                                | Count non-comment, non-blank lines in `.env.local.example`                           |
| Auth route count (e.g., "209 authenticated") | Count files with `requireAuth` import                                                |

## Output Format

Output max 20 lines in this format:

```
Doc Verification — [date]
─────────────────────────
README.md
  [pass] 14 authenticated pages — actual: 14
  [DRIFT] 216 API routes — actual: 218
  [pass] 24 Scout tools — actual: 24

docs/master-plan.md
  [pass] 27 tests — actual: 27
  [WARN] "6 tables" in intelligence engine — unable to verify (no migration count per engine)

Summary: X pass / Y drift / Z warn
```

## Rules

- Never auto-rewrite documentation. Only report findings.
- If a claim can't be verified programmatically, mark it as WARN with explanation.
- If a number is off by 1-2, report as DRIFT (may be stale). If off by >5, report as STALE.
