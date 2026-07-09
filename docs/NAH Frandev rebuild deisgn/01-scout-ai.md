# Scout AI (assistant home)

Entry: Sidebar → Scout AI (default landing). Reference: `New Again Houses App.dc.html` (Scout screen).

## Layout

Full-viewport, centered column, no KPI cards, no Ask Scout bar (the composer is the input). Sidebar collapses to icon rail focus but keeps labels.

Top → bottom, centered:

1. `new again houses` logo mark.
2. Greeting heading (large, bold, navy): `Good afternoon, Corey.` — time-of-day + user first name.
3. Subheading (muted): `How can I help you today?`
4. **Suggestion chips** — 6 rounded white pills, 2-column grid:
   - `Who should I call today?`
   - `Summarize my last call with a prospect`
   - `Draft a follow-up for cold prospects`
   - `Which prospects haven't been contacted in 7+ days?`
   - `What's our pipeline close rate this month?`
   - `Help me prep for my next discovery call`
5. **Composer** — wide rounded pill: paperclip (attach), `Ask Scout anything...` placeholder, mic icon, circular blue send button.
6. Disclaimer (muted): `AI may generate inaccurate information. Verify important details.`

## Behavior

Chips populate/submit the prompt. Sending a message transitions to a conversation view (not in prototype — build only if it already exists).
