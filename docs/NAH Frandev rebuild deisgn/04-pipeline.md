# Pipeline

Entry: Sidebar → Pipeline. Reference: `New Again Houses App.dc.html` (Pipeline). Match existing components.

Shell: Ask Scout bar (`Which leads need attention?...`).

## Top (both states)

1. **KPI cards** (3): `52 In Sales / active prospects`, `7 In Onboarding / territories`, `10 In Runway / territories`.
2. **Search**: `Search prospects...`.

## State A — collapsed summary

Accordion rows, each: chevron, group name, `N prospects`, and a row of **urgency count pills** (colored counts). Groups & pills (sample):

- Path to Ownership · 67 · `45 3 1 3 0 15`
- Onboarding · 59 · `0 6 1 52`
- Runway · 52 · `0 2 8 42`
- Territories · 88 · `23 0 65`
- Long-Term Follow-Up · 3010 · `3010 0 0`

**Urgency Key** card: 🟢 Fresh · 🟠 At Risk · 🔴 Losing · 🔵 Won.

## State B — expanded kanban (per group)

Clicking a group row expands it inline into a horizontal kanban. Each **column** has a colored top accent (red→green across the row), title + count badge, and one or more **stage sub-sections** (stage name + count; one may be a blue `FOCUS QUEUE`). **Prospect cards**: drag handle, colored status dot (green Fresh / orange At Risk / red Losing / blue Won), name, `{age}d` + source (`PTO Form` / `Organic` / `Paid Ad` / `Referral` / `Franchise R…`). Columns show `+N more` when truncated. Empty stages show `—`; empty columns show `No prospects`.

Full column/stage sets per group are in the prototype:

- **Path to Ownership**: Engagement (Outreach·FOCUS QUEUE, Intro Call) · Qualification (NDA, Matt Call, Zorakle) · Discovery (Sam Call, PFS, Background, Mark Call) · Compliance (FDD, FDD Review Call, Territory Call, FA Info Gathering) · Awarding (Matt Final Call, Franchise Award Letter, FA, FF) · Closed.
- **Runway**: First Offer (First Lead, First Walkthrough, First Offer, 10 Offers) · First Purchase (First Contract, Closing Set, Closing, Construction Start) · Inventory Building (1st Completed, 25 Offers, 3 Purchased) · Running.
- **Territories**: Inactive · Available · Active.
- **Long-Term Follow-Up**: Nurture · Follow-up · Re-engaged.
- **Onboarding**: (stages not captured — map from real data.)

## Behavior — drag & drop

Prospect cards are **draggable between stages/columns**. On drag: card dims, scales slightly, lifts with shadow (grabbing cursor). Hovered target stage highlights (blue inset ring + tint). Drop moves the card and persists.
