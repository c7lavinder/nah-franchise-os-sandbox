# Contacts — Journeys & Territories list + Journey detail + Contact detail

Entry: Sidebar → Contacts. Reference: `New Again Houses App.dc.html`. Match existing components.

Shell: Ask Scout bar (`Ask Scout anything...`).

## A. List view

1. **KPI cards** (3): `52 In Sales / active prospects`, `7 In Onboarding / territories`, `10 In Runway / territories`.
2. **Toolbar**: search (`Search journeys & territories...`) + refresh; right: `+ Add Journey` (primary blue).
3. **Stage-chip filter grid** — one card per group (uppercase label + count), each containing **stage chips**: a colored circle (icon inside), a dark count badge (blue when active), and a label. Zero-count chips are faded/grey. Groups & chips:
   - **PATH TO OWNERSHIP (67)**: Engagement 45, Qualification 3, Discovery 1, Compliance 3, Awarding 0, Closed 15.
   - **ONBOARDING (59)**: Setup 0, Training 6, Launch Prep 1, Onboarded 52.
   - **RUNWAY (52)**: First Offer 0, First Purchase 2, Inventory Building 8, Running 42.
   - **TERRITORIES (88)**: Inactive 26, Available 0, Active 62. _(territory-kind)_
   - **LONG-TERM (3010)**: Nurture 3010, Follow-up 0, Re-engaged 0.
4. **List section** below the chips — **journeys list always shown, Territory Network list stacked below it** (Territory Network hidden for Path to Ownership stages, since those journeys have no territory yet).
   - **Journeys list**: heading (`All Journeys 3075 journeys`, or the selected stage + count) + sort tabs `Urgency / Name / Recent ↓`. Rows: checkbox, name, optional territory-code chip, right-aligned urgency pill (Fresh/At Risk/Losing/Won), stage pill, source pill, chevron. Clicking a stage chip filters this list; clicking a journey row opens the **Journey detail**.
   - **Territory Network** (shown for non-PTO / default): heading `Territory Network 62 territories` + sort tabs `Name / Status / Quartile / Owner`. Rows: name + code (mono) + optional `High Performer` pill + quartile text (`Q3 · -5 pts`, colored by quartile) + gap tag (blue, e.g. `Lead Gen Gap`); right: `Active` status pill, stage pill (or `—`), owner chip (or `No owner`), chevron. Clicking a row opens the **Territory detail** (`06-territory-detail.md`).

## B. Journey detail (click a journey row)

- **Header**: back, name, action buttons: `Call, Text, Email, Schedule, Merge, Delete Journey`, refresh.
- **Stage stepper** card: group label (`Path to Ownership — Engagement`), horizontal stepper of stage circles (current highlighted, green dot), and actions: `Advance to Qualification`, `Skip` (left), `Follow-up`, `Nurture` (right). Onboarding/franchisee journeys show group pills (Onboarding / Path to Inventory / Territories), checked steps, and a `Revert` action.
- **Journey Brief** card (narrative + bold next-action + bullet + `Updated` date) and **Revenue** card (Franchise Fee / Royalty Paid / Due; progress bar for onboarded).
- **Tabs**: Overview, Messages, Profile, Documents, Territories (+ EOS for franchisees).
- **Left column** (all tabs): `CONTACTS (n)` (+ Add; contact name is a link → Contact detail), `TEAM (n)` (+ Add), `Territory Ownership` (Assign a territory / territory card).
- **Overview**: right column = `GRADED CALLS`, `TASKS`, `NOTES` cards.
- **Messages**: thread empty state + composer (`Type a message... Use @ to mention someone`).
- **Profile**: `PROSPECT INFORMATION` card (First/Last/Phone/Email/City/State/Lead Source) + field-group accordions: Identity & Contact, Background & Demographics, Personality & Psychology, Goals & Vision, Financial Profile, Franchise Fit, Territory, Sales Journey, Validation, Trainual, Compliance (each with `X/Y filled`; source badges `API sync` / `Scout AI` per field). Full field lists come from real data.
- **Documents**: document-type dropdown (e.g. Personal Financial Statement (PFS)) + dropzone (`Drop document here or click to browse`, PDF/Word/Excel/TXT/images ≤20MB) + empty state.
- **Territories**: assigned territory card, or `No territory assigned / Assign a territory`.

## C. Contact detail (click a contact name inside a journey)

- **Header**: back, name, `Franchisee` (or role) badge, `Open journey →` link. Subline: `Currently in Active (territories)`.
- **Contact info row**: Email list (primary starred, `+ Add`), Phone, Location.
- **Inventory card**: big `Houses Purchased YTD` number + stat cards (`Sold YTD`, `Active Deals`, `Avg Conv. Rate`, `Avg Profit/Flip`).
- **Tabs**: **Contacts** (`JOURNEYS THIS PERSON IS IN (n)` — journey cards with role + joined date + status), **Profile** (field-group accordions, same set as journey Profile with per-contact counts), **Personal EOS** (Goals: Income Goal, Lifestyle Goal, Quality of Life Goal — textareas).
