Load current project context and output a concise status briefing.

1. Read `handoff.md` from the project root
2. Run `git log --oneline -5` to get the last 5 commits
3. Note today's date

Output exactly 5 lines:

```
Phase: [current phase from handoff.md Status line]
Last build: [most recent commit message + hash]
Open issues: [count from "Open Issues Carried Forward", name top severity item]
Next step: [exact text from "Exact Next Step" section]
Today: [YYYY-MM-DD]
```

No greetings, no commentary, no extra explanation. Just the 5 lines.
