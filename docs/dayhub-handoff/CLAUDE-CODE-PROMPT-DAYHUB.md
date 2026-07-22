# Claude Code Prompt — Day Hub (Internal / FranDev)

Two mocks are the visual source of truth, copied into this folder:

- `Day Hub Internal.dc.html` — the full page: Panel 1 (today strip), Panel 2 (KPI strip), Panel 3 (module card columns). Its Panel 3 card contents are SUPERSEDED by the second file.
- `Convert Cards.dc.html` — the FINAL approved card sets for Panel 3's three columns (Convert / Launch / Grow). Build these exact cards.

Match the existing app stack and the MasterSuite token set already used on the record pages (Nunito Sans; bg `#eef1f6`; white panels `1px solid #dde4ef` radius 8 shadow `0 1px 2px rgba(27,42,74,.06)`; card style here is rounder: radius 12, shadow `0 1px 3px rgba(27,42,74,.08)`, padding 18/20; text `#26324b`/`#5a6b88`/`#8494ad`/`#98a6bf`; blue `#1e88e5`).

## Page structure (top → bottom)

1. **Greeting line** — "Good morning, {firstName}" + date + day summary (appointments count, journeys needing touch).
2. **Panel 1 — today strip** (3 equal cards):
   - **Today's Appointments**: time-block tile (time + AM/PM CT), who, what, right pill categorizing the appointment (Coaching pink / Convert blue / Launch green). Source: user's calendar.
   - **Ready to Dial** (amber-tinted header): heat-ranked contacts needing a call with reason line + green `Call` button. Source: journey staleness/blocker signals.
   - **Inbox**: avatar + one-line message + meta (Text/Document/Alert/Agent · age) + `Open` button. Source: unified comms feed.
3. **Panel 2 — KPI strip**: one white bar, 5 equal KPI cells (label / big value / delta colored by direction) + right 230px "SYSTEM PIPELINE HEALTH" progress cell. Internal KPIs: Active Journeys, In Onboarding, Active Territories, Houses Bought T30, Avg Call Score T7.
4. **Panel 3 — module columns**: three columns with tinted header cards:
   - **Convert** (blue tint `#e3f0fc`/`#1565c0`) — "Turn prospects into franchisees"
   - **Launch** (green tint `#e5f3e8`/`#2e7d43`) — "Get new franchisees launched and into their first houses"
   - **Grow** (purple tint `#efeafb`/`#6b46c1`) — "Help locations buy more houses"
     Cards within each column are **permission/role-driven config** — internal team sees this set; franchisees get a different set (their day hub is a separate later effort). Each card has a `status` field (production/beta/building) used ONLY for dev/admin visibility flags — no status pills in the normal UI.
5. **Floating Scout button** bottom-right (app-level overlay).

## Final card sets (from `Convert Cards.dc.html`)

### Convert

1. **Today's Target** — "Have 1 discovery call today", big fraction 0/1 (amber until met, green when hit), progress bar, context footnote. Target definitions are config; progress auto-computed from call/journey events.
2. **Q3 Goal** — "Have 5 territories sign this quarter", 3/5, segmented pips (one per unit, green filled), footnote naming closest journeys. Auto from journeys hitting signed stage in quarter.
3. **New Journeys** — latest 6, newest first: name+territory link, source pill, stage pill (stage color ramp: Lead neutral, Discovery blue, Validation purple, Award amber, Onboarding green), footer `Go to Journeys →`.
4. **Weekly Scorecard** — total leads in this week (14/25 big fraction + % + bar), then "WHERE THEY CAME FROM" source bars (Referral Partners / Organic / Events / Paid with counts).

### Launch (onboarding → runway → first houses)

1. **Onboarding** — Setup → Training → Launch Prep → Onboarded. Per-franchisee rows, closest to launch first: name, current stage·substep (real substeps: Legal Entity, NAH Website, Google Workspace, Bank Account; Trainual Parts 1–5; Accounts, Insurance, Workstation), % bar (green/amber/red by staleness), day counter + source. Footer `Go to Onboarding →`.
2. **Runway** — 4 stage tiles with counts and color ramp (First Offer orange 0 · First Purchase amber 2 · Inventory Building lime 8 · Running green 39; tiles have colored top edge), then mover rows (who + milestone + day count, e.g. Construction Start, 25 Offers milestone, 1st flip completed).
3. **Time to Launch** — big "31 days avg" (sign → first marketing live, last 4 launches), trend "↓ 6 vs prior 4", 4 descending mini-bars.

### Grow

1. **System Scorecard — T30** — 24 houses bought ↑9% vs prior 30; stat row Leads In / Offers / Contracts / Avg Profit (money green); divider; "BOTTLENECKS — WHERE DEALS DIE" stage-conversion bars (Stage 1→2 … Stage 4→Contract; worst step red) + amber pressure callout.
2. **Inventory Watch** — Active Flips / Past 120d (amber) / Past 180d (red) stats; rows: day badge (color by age), address, territory, stage.
3. **Territory Grades** — A–F histogram (counts above bars, green→red ramp) + footnote on grade drops.
4. **Calls** — This Week / Avg Score / Below C stats; rows: grade chip (A green…D/F red) + who + when (with CT time zone) + duration + type pill (Coaching pink, Team blue); footer `Go to Calls →` (links to the unified Calls page).

## Wiring notes

- Panel 3 cards are a registry: `{key, column, roles[], status, component}` — server resolves per user; page renders whatever list it gets. Same registry will later serve the franchisee day hub with different cards.
- Targets/goals (Today's Target, Q3 Goal) are configurable objects `{label, metric, target, period}`; progress computed from existing events (calls, journey stage changes, signings).
- All times show time zone (CT).
- Cross-links: journeys → Journey page, territories → Territory page, calls card → Calls page.
- Numbers in the mocks are real sample data — keep as fixtures until API wiring.

## Acceptance

- [ ] Greeting + 3-card today strip + KPI bar + 3 module columns, matching mocks at 1440px
- [ ] Card sets exactly as listed; no status pills or module legend in the UI
- [ ] Cards render from a role-driven registry, not hardcoded markup
- [ ] Today's Target and Q3 Goal auto-compute from events, config-defined
- [ ] All cross-links navigate; Scout button overlays bottom-right
