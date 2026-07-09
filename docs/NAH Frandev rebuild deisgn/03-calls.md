# Calls

Entry: Sidebar → Calls. Reference: `New Again Houses App.dc.html` (Calls list + call detail). Match existing components.

## A. Calls list

Shell: Ask Scout bar (`How can I improve my call performance?...`).

1. **KPI cards** (3): `23 Calls This Week / Mon–Sun`, `0 Calls Scheduled / upcoming`, `63 Avg Call Score / 463 graded calls`.
2. **Drop zone**: dashed card, upload icon, `Drop New Call Here`, `Drop a recording, transcript file, or click to paste — AI handles the rest`.
3. **Filter row**: segmented `This Week`(active) / `This Month` / `All`, count `23 calls`, refresh icon.
4. **Call groups** — 2-col grid of cards, each: title + count badge, then call rows. Groups: **Path to Ownership, Onboarding, Coaching, Team Calls, Group Calls, Other Calls** (empty groups show `No calls`).

**Call row**: screen/monitor icon; call-type title (optional ⚠ warning); **team members on row 1** (colored tags), **contacts/outsiders on row 2** (grey tags); right-aligned timestamp + duration. Entire row is clickable → opens call detail.

## B. Call detail (click a call)

Replaces the list (KPI cards hidden). Back arrow returns.

- **Header**: back, title (e.g. `FDD review and Discovery Day scheduling`), tag / delete / refresh icons. Below: type pill + `Completed` + `time · duration` (+ ⚠ if flagged) + platform (`Google Meet`).
- **Entity chips row**: `TEAM` (always) + `CONTACT` + `JOURNEY` (prospect calls) + `TERRITORY` (coaching calls). Team calls show none.
- **Scout "What to do next"** card: blue avatar, `WHAT TO DO NEXT [WITH NAME] · Scout`, recommendation text.
- **Tabs**: `Overview` (+ `Knowledge Captured` for team calls).
- **Entity selector cards** (under tab): one card per contact + territory (icon, name, kind, data-point count). Clicking one opens its **intelligence panel** (see below); clicking `Overview` returns.

### Overview content

- **Summary** card: bulleted key points + Scout attribution.
- **Grade** card: letter + score (e.g. `B  4.12/100`); per-criterion rows (name + colored bar + letter). Criteria differ by call type (Intro/Discovery, Coaching, Team). Two boxes: **Strengths** (green), **Improve** (amber). **Next** callout (blue left-border).
- **Transcript** card: `From Read.ai`, Copy action, speaker rows (avatar initials, colored name, text).

### Entity intelligence panel (per contact/territory)

- Header: avatar/location icon, name, `N actions · M data points`.
- Progress bar: `X / Y extracted fields saved to profile` + `%`.
- **Unreviewed** (contacts): select bar (`0 of N selected · Select all · Clear` + `Push selected (0)`), then field cards — each: checkbox, field name, priority pill (`HIGH` green / `MEDIUM` amber), mapping chip (`→ Contact: Name`), optional `⚠ Unsupported contact field`, value, and **Push to Profile / Edit / Skip** actions.
- **Reviewed** (territories): `All extracted fields have been reviewed.` + `SAVED / SKIPPED` list (checkmark + field + priority + mapping + `Saved`).

Example contact fields (sample): Num Dependents, Prior Re Experience, Financing Type, Lead Source, Pfs Received. Example territory fields: Challenges Reported, Goals Discussed, Coaching Notes.
