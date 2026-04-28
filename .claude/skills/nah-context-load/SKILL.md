---
name: nah-context-load
description: Use at session start or when user asks 'where are we?', 'what's the status?', 'what did I last do?', or types /load-context. Reads handoff.md and recent git history to output a concise status briefing.
---

# NAH Context Load

Load the current project context and output a concise status briefing.

## Steps

1. Read `handoff.md` from the project root
2. Run `git log --oneline -5` to get the last 5 commits
3. Check today's date

## Output Format

Output exactly 5 lines, no more:

```
Phase: [current phase from handoff.md Status line]
Last build: [most recent commit message + hash]
Open issues: [count from "Open Issues Carried Forward" section, with top severity item named]
Next step: [exact text from "Exact Next Step" section]
Today: [YYYY-MM-DD]
```

Do not add commentary, greetings, or explanations. Just the 5 lines.
