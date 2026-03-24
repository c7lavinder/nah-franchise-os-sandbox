# /wrap-session — End of Session Protocol

> When I type /wrap-session do exactly this in order.

---

## PRE-WRAP CHECK — fix before wrapping:

- □ Every function passed 4-step self-audit?
- □ TypeScript errors in files touched?
- □ GHL calls outside /lib/ghl?
- □ Scout actions missing confirm step?
- □ Hardcoded API keys anywhere?
- □ console.log in production code?
- □ TODO comments not addressed?
- □ Missing error handlers on external calls?
- □ Everything matches CLAUDE.md spec?
- □ Every new function has JSDoc comment?

---

## STEP 1 — Update memory.md Current Status table

Current phase | last session one sentence | last file changed |
today date YYYY-MM-DD | exact next action | blockers | build health

## STEP 2 — Update memory.md What Has Been Built

Check off completed items. Add new items.
Partial = [~] / Broken = [!] / Done = [x]

## STEP 3 — Update memory.md Established Patterns

Add any new reusable patterns with code examples.
Future sessions must follow these patterns.

## STEP 4 — Update memory.md Known Issues

Every bug found even if fixed.
Format: severity | status | description | file | fix

## STEP 5 — Update memory.md Decisions Log

Format: Phase | Decision | Reason | Alternatives considered

## STEP 6 — Update memory.md Audit Log

Format: Phase | date | file audited | issues found | how fixed

## STEP 7 — Update memory.md Session History

Add one row at TOP of table.
Format: Session# | Date | What built | Files changed count | Issues found

## STEP 8 — Update memory.md Next Session Starts With

Write exact next action specific enough to start in 30 seconds.
Format: Next action / Blocking / Read first

## STEP 9 — Update CLAUDE.md only if:

New Scout tool built | behavior rule changed | new capability added
If not touched write: CLAUDE.md — no changes needed

## STEP 10 — Update docs only if relevant:

- Feature completed → docs/features.md check the box
- Pipeline changed → docs/pipeline.md
- New API endpoint → docs/integrations.md
- Architecture decision → docs/architecture.md
- Design component built → docs/design.md
- Build order changed → docs/build-plan.md
- Tech stack confirmed → docs/stack.md

If none write: docs — no changes needed

## STEP 11 — Write handoff.md — overwrite completely every session:

```
# Session Handoff — [YYYY-MM-DD] — Session [#]

## Status
Phase: / Health: / Duration:

## What Was Built This Session
[bullet list — specific files and features]

## What Is Confirmed Working
[tested and working]

## What Is Broken or Incomplete
[file — what is wrong — severity]

## Decisions Made
[decision — reason]

## Files Created
[/path/file.ts — what it does]

## Files Modified
[/path/file.ts — what changed]

## Files Deleted
[none if none]

## Bugs Found
[severity — description — status fixed/open]

## Open Issues Carried Forward
[anything unresolved]

## Exact Next Step
[single sentence specific enough to start in 30 seconds]

## Copy This To Start Next Session
---
Read memory.md first. Then CLAUDE.md. Then handoff.md.
Last session [date]: [one sentence]
Next action: [exact task]
Self-audit every function: Write > Question 18 checks > Improve > Validate
Run /wrap-session when done.
---
```

## STEP 12 — Verify before confirming complete:

- □ memory.md Current Status has today's date?
- □ memory.md Next Session has specific actionable task?
- □ handoff.md written this session not a previous one?
- □ All bugs in memory.md Known Issues?
- □ All decisions in memory.md Decisions Log?
- □ All audits in memory.md Audit Log?
- □ Session History has new row?
- □ Any updated docs saved?

## STEP 13 — Output this exact confirmation:

```
✅ /wrap-session COMPLETE — [YYYY-MM-DD]
Phase: [phase] / Health: [green/yellow/red]
Built: [count] items / Bugs: [count] / Decisions: [count] / Audits: [count]
Files updated: memory.md ✓ / handoff.md ✓ / [any others] ✓
Open issues: [list or None]
Next session: "[exact next action in quotes]"
Session safe to end.
```

---

## EMERGENCY WRAP

If context limit reached:

Update memory.md Current Status and Next Session Starts With at minimum.

Output:

```
⚠️ EMERGENCY WRAP — context limit. memory.md updated minimally. Full wrap needed next session start.
```
