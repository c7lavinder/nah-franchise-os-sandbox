Run a full documentation audit across all key project files.

This is the expanded version of /verify-claims. Scan ALL documentation files for accuracy:

1. **Numeric claims** — same as /verify-claims (page count, route count, tool count, test count, model name, etc.)
2. **File references** — do referenced file paths actually exist?
3. **Status claims** — do "COMPLETE" / "Done" markers match reality?
4. **Cross-doc consistency** — do README, CLAUDE.md, master-plan, and handoff agree with each other?

Files to audit:

- README.md
- CLAUDE.md
- CONTRIBUTING.md
- docs/master-plan.md
- docs/scout.md
- docs/scout-tools.md
- docs/security.md
- docs/system-shape.md
- handoff.md

Output max 20 lines in this format:

```
Full Doc Audit — [date]
---
[pass/DRIFT/STALE/BROKEN] [file]: [specific finding]

Summary: X pass / Y issues found
```

Rules:

- Never auto-rewrite docs. Report only.
- Flag broken file references as BROKEN.
- Flag stale status markers as STALE.
