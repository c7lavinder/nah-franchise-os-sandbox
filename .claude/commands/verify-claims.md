Verify numeric claims in project documentation against actual code.

Scan these files for numeric claims:

- README.md
- CLAUDE.md
- docs/master-plan.md
- handoff.md

For each claim found (page count, route count, tool count, test count, model name, table count, env var count, auth route count), verify against the actual codebase.

Output max 20 lines in this format:

```
Doc Verification — [date]
---
[filename]
  [pass/DRIFT/STALE] [claim] — actual: [value]

Summary: X pass / Y drift / Z warn
```

Rules:

- Never auto-rewrite docs. Report only.
- DRIFT = off by 1-2. STALE = off by >5. WARN = can't verify.
