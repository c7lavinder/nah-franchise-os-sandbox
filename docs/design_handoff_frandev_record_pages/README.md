# Handoff: FranDev record pages — Journey, Contact, Territory

## Overview

Three FranDev record pages get a visual rebuild: **Journey**, **Contact** (which serves both
Prospect and Franchisee), and **Territory**. Same routes, same data, same fields — better
visual hierarchy, and every tab actually built out and clickable.

The second half of the ask matters more than the restyle: these three pages should render from
**one shared page template**, so a change to the shell applies to all of them at once. The repo
is already most of the way there (see _The real ask_ below); this work finishes the job.

Target files in the repo:

| Page      | Route                         | View                               | Model                   |
| --------- | ----------------------------- | ---------------------------------- | ----------------------- |
| Contact   | `/frandev/contact-v2/{key}`   | `Pages/Frandev/ContactV2.cshtml`   | `ContactV2.cshtml.cs`   |
| Journey   | `/frandev/journey-v2/{key}`   | `Pages/Frandev/JourneyV2.cshtml`   | `JourneyV2.cshtml.cs`   |
| Territory | `/frandev/territory-v2/{key}` | `Pages/Frandev/TerritoryV2.cshtml` | `TerritoryV2.cshtml.cs` |

---

## ⚠️ Prospect and Franchisee are the SAME page

There is no separate Franchisee page and none should be created. Both are
`Pages/Frandev/ContactV2.cshtml` rendering the same layout, the same tabs, and the same
field groups. The **only** differences are in the header:

|               | Prospect                         | Franchisee                              |
| ------------- | -------------------------------- | --------------------------------------- |
| Type chip     | `PROSPECT` — amber               | `FRANCHISEE` — green                    |
| Status chip   | `DISCOVERY` — blue               | `ACTIVE` — blue                         |
| Source chip   | e.g. `Franchise Times ad` — grey | e.g. `Referral — existing owner` — grey |
| Sub-line tail | —                                | `· owner since Feb 2, 2023`             |
| Contact brief | usually empty state              | usually filled                          |
| Personal EOS  | Goals, Issues, To-dos            | Goals, Issues, To-dos, **Habits**       |

Everything else is identical. Two files exist in this bundle
(`Frandev Prospect.dc.html`, `Frandev Franchisee.dc.html`) **only** so you can see both header
states side by side. Do not implement them as two pages. Drive the difference off the
contact's type/status, not off a route.

---

## About the design files

The `.dc.html` files in this bundle are **design references created in HTML** — prototypes
showing intended layout, hierarchy, and behavior. They are not production code and should not
be copied into the app. Open them in a browser to see the intent; implement the result in the
existing ASP.NET Razor Pages + Bootstrap 3 environment using the shell partials named below.

They render standalone: each is a self-contained HTML file that loads `support.js` from the
bundle root. Keep the folder structure intact and open any `.dc.html` directly.

## Fidelity

**Hi-fi for layout, hierarchy, and content. Not authoritative for color and type.**

This is the one thing to get right. The mocks were drawn before the instruction "match the
exact design of our property page," so they use their own palette and drop the property page's
`zoom: 0.82`. The property page is now the visual source of truth.

- **Take from the mocks**: what panels exist, their order, their grid structure, what's in each
  cell, which tabs exist, what each tab contains, collapsed/expanded defaults, empty states,
  the pipeline stepper design, the relative type hierarchy.
- **Take from the property page**: every hex value, font size, radius, shadow, border, and the
  page zoom. Use the existing class vocabulary — `.ghead`, `.gt-card`, `.gt-h`, `.gt-fk`,
  `.gt-fv`, `.grr-*`, `.kt`, `.csnap`, `.jhero` — rather than writing new CSS.

Concretely: where the mock says `border:1px solid #E6E9ED`, ship
`border:1px solid rgba(15,23,42,.07)` because that is what `.gt-card` uses. Where the mock says
`color:#7A828F` on a section label, ship `#94a3b8` because that is `.gt-h`. Mapping table in
_Design tokens_ below.

**Do not apply `zoom: 0.82` on top of the mock's pixel values.** Either keep the property
page's zoom and use the property page's own px values (preferred — that is what "match the
property page" means), or drop zoom everywhere consistently. Not both.

---

## The real ask: one shared template

### What already exists

The property page — `Pages/Property/Analysis/GunnerPropertyAnalysis.cshtml` — is already
built as a shell that composes panels from a catalog. This is the pattern to extend.

**Shell CSS, single copies, already shared:**

```
Pages/Gunner/ShellStyles/_Header.cshtml       .ghead — record header
Pages/Gunner/ShellStyles/_Rail1.cshtml        right rail, part 1
Pages/Gunner/ShellStyles/_Rail2.cshtml        right rail, part 2
Pages/Gunner/ShellStyles/_Tabs.cshtml         #gunner-tabs — tab strip + every pane style
Pages/Gunner/ShellStyles/_StageBar.cshtml     stage bar
Pages/Gunner/ShellStyles/_ContactTiles.cshtml contact tiles
Pages/Gunner/ShellStyles/_PersonPage.cshtml   the person-page delta: .jhero, .csnap, .kt,
                                              .g-openbtn, .g-delbtn, .g-typesel, .gn-person
Pages/Gunner/_GunnerShellStyles.cshtml        includes the above for journey-v2 / contact-v2 /
                                              territory-v2
```

`_Tabs.cshtml` says it plainly: _"Shared by the property page and the FranDev detail pages —
this file is the ONLY copy."_ Good. Keep it that way.

**Panel composition, already catalog-driven:**

```
Pages/Gunner/GunnerPanelCatalog.cs            PanelKey → PartialPath registry
Pages/Gunner/GunnerSlotCatalog.cs             slot registry
Pages/Property/Analysis/_GunnerRightRail.cshtml    composes rail from railCatalog
Pages/Property/Analysis/_GunnerTabs.cshtml         the tab strip
Pages/Property/Analysis/HeaderPanels/_HeaderIdentity.cshtml, _HeaderActions.cshtml
Pages/Property/Analysis/MainPanels/_MainEconomicsGrid.cshtml, _MainNaxWells.cshtml
Pages/Property/Analysis/RailPanels/_Rail*.cshtml   12 rail panels
```

`GunnerPropertyAnalysis.cshtml` loops a manifest of `PanelKey`s and renders
`@headerCatalog[hp.PanelKey].PartialPath` / `@mainCatalog[mp.PanelKey].PartialPath` /
`@railCatalog[rp.PanelKey].PartialPath`, with a hardcoded fallback list when no manifest is set.
Layout grid comes from `Helpers/Constants.cs`:

```csharp
PropertyPageContentGridCssClass = "col-lg-8 col-lg-pull-4 col-md-12 col-sm-12 col-xs-12";
PropertyPageSidebarGridCssClass = "col-lg-4 col-lg-push-8 col-md-12 col-sm-12 col-xs-12";
```

Content left, rail right, rail declared first in source and pushed. All three FranDev V2 pages
already use these constants — `ContactV2.cshtml:297`, `JourneyV2.cshtml:418`,
`TerritoryV2.cshtml:309`.

### What's missing

1. **ContactV2 restates shell rules inline** instead of pulling them from
   `ShellStyles/`. `_PersonPage.cshtml` flags this in its own header comment: _"ContactV2 still
   restates them inline; folding it in here is the obvious follow-up."_ Do that follow-up first
   — it is the single highest-value change in this handoff, and it is the reason a shell tweak
   today does not reach all pages.
2. **No shared record-page shell partial.** Each V2 page hand-rolls header → grid → rail →
   tabs. The property page's composition loop is not reused.
3. **Tab panes are stubs.** Most tabs render nothing. All of them need bodies (spec below).

### What to build

Extract the property page's shell into a partial the FranDev pages share. Suggested shape —
match repo conventions over these exact names:

```
Pages/Gunner/ShellStyles/_RecordPage.cshtml     the shell: chrome, .ghead, the two-column
                                                Bootstrap grid, #gunner-tabs strip, rail
                                                container, Scout dock. Renders panels from a
                                                manifest exactly as GunnerPropertyAnalysis does.

Pages/Frandev/RecordPageVm.cs                   base VM: Chips[], Title, Subtitle, Actions[],
                                                HeroPanelKey, Tabs[], RailPanelKeys[]

Pages/Frandev/FrandevPanelCatalog.cs            PanelKey → PartialPath, mirroring
                                                GunnerPanelCatalog. Or extend that catalog with
                                                a Frandev dictionary rather than adding a class.
```

Each page model then supplies only a manifest and its data. Its `.cshtml` becomes a thin file
that sets the manifest and renders `_RecordPage`. A change to `_RecordPage` or a
`ShellStyles/` partial reaches Journey, Contact, and Territory — and, because the CSS files are
already the only copies, the property page too.

**Rail panels are shared, not duplicated.** Nine of the rail sections (Activity, Journeys,
Contacts, Team, Calls, Tasks, Notes, Appointments, Documents) are the same collapsible row on
every page — only the count and the target record differ. One partial, parameterised. Model on
`RailPanels/_Rail*.cshtml` and `Pages/Gunner/GunnerContactRailVm.cs`.

### Constraints carried over from the design review

- **Chrome is recreated exactly.** The MasterSuite top bar, global search, nav dropdowns, and
  breadcrumbs do not change. Only the page body is redesigned.
- **Keep all nine rail sections on every page**, including the ones whose count is 0 — parity
  across pages was an explicit decision. Zero-count sections render dimmed, not hidden.
- **Keep click-to-edit inline cells.** Field values stay editable in place; do not move to a
  modal or a separate edit mode. Reuse `.gt-edit` from `_Tabs.cshtml`, which already has the
  hover/focus/saved/error states.
- **Keep dev mode.** `Pages/Frandev/FrandevDevManifest.cs` and the `data-wire` / `data-calc`
  annotations stay. Any new panel gets a `PanelKey` and appears in the manifest.
- **Desktop 1440 is the design width.** The Bootstrap grid handles smaller.
- **No `Offers` rail section on the FranDev pages.** It was removed — FranDev records have no
  offers. Territory shows `Journeys` in that slot; Contact shows `Territories` under Activity.

---

## Page template anatomy

Every one of the three pages is this, top to bottom. Panels 2–6 are the shell.

**1. MasterSuite chrome** — unchanged. 52px bar: logo, territory label, global search, nav
dropdowns. `Pages/Gunner/ShellStyles/_Header.cshtml` + `Pages/Gunner/_GunnerHeader.cshtml`.

**2. Record header (`.ghead`)** — one card, full width.

- Row 1: chips. Type, then status, then an optional grey context chip. `white-space:nowrap`
  on every chip; they wrap as a group, never mid-label.
- Row 2: record title, 26px/800/-.025em. Optional slug or secondary identifier beside it,
  13px/700/.07em, muted. No record ID badges — those were removed.
- Row 3: sub-line, 12.5px/500, muted — the identifying facts, `·` separated.
- Right side: actions. Primary is solid accent (`.g-openbtn`); destructive is tinted red
  (`.g-delbtn`); a type `<select>` uses `.g-typesel`. Disabled actions render at `opacity:.55`,
  `cursor:default` — visible, not hidden, so the page shape is stable.

**3. Two-column body** — `Constants.PropertyPageContentGridCssClass` (left, content) and
`PropertyPageSidebarGridCssClass` (right, rail). Rail is ~392px at 1440. Gap 14px.

**4. Panel 1 — the hero card (`.jhero`)** — sits above the tab strip, outside
`#gunner-tabs`, so it needs `.jhero` rather than `.gt-card`. Content is page-specific:
Contact gets the 3-up contact facts + brief; Journey gets the pipeline stepper; Territory gets
ownership + map.

**5. Tab strip (`#gunner-tabs .gt-strip`)** — `<button>` elements, `.gt-tab`, active gets
`.active` (accent text + 2px accent bottom border, `margin-bottom:-2px` over the strip's own
2px border). On these pages the tabs switch panes client-side; the existing FranDev pages use
server-side `?tab=` anchors, and `_PersonPage.cshtml` turns the underline off for that case —
if you keep anchors, keep that rule. `white-space:nowrap` on labels. Tab labels carry a
Font Awesome icon on the Contact page.

**6. Tab panes** — `.gt-pane`, only `.active` visible. Cards inside are `.gt-card`; section
labels `.gt-h`; field key/value `.gt-fk` / `.gt-fv`.

**7. Right rail** — top to bottom:

- A page-specific summary card (2×2 `.csnap` / `.kt` tiles, or a figures list).
- The nine collapsible sections, each a 12px-radius card: icon, uppercase label, count pill,
  chevron. Live counts get accent-tinted pills; zero counts get grey pills and a dimmed label.
- A contact-tiles card (`_ContactTiles.cshtml`) where relevant.
- The Workflow agent card — purple, `#ECEBFE` on `#C9C5F0`.

**8. Scout dock** — fixed bottom-right pill, "Ask Scout anything…" + circular accent send
button. `Pages/Gunner/_ChironDock.cshtml`.

---

## Screen: Contact (Prospect | Franchisee)

**Purpose.** Internal FranDev view of one person — who they are, what's known about them, and
what's outstanding. Low-interaction: it is read and skimmed far more than it is edited.

### Hero panel

3-up grid, `repeat(3,minmax(0,1fr))`, gap 16px: **Email**, **Phone**, **Location**. Each cell is
an uppercase 11px label over a 14.5px/700 value with a `fa-pencil` affordance that reveals on
hover. Below a 1px divider: **Contact brief** — uppercase label + 13.5px/1.55 prose. When
absent, grey placeholder text naming what will fill it, e.g. _"No contact brief yet — the
nightly agent writes one after the first meaningful activity."_

### Tabs: Overview · Profile · Personal EOS

Icons: `fa-th-large`, `fa-pie-chart`, `fa-line-chart`. Default tab **Overview**.

#### Overview tab — identical on all three pages

Two columns, `repeat(auto-fit,minmax(280px,1fr))`, gap 12px. **This exact card set is the
shared Overview; build it once as a partial and use it on Journey and Territory too.**

Left column:

- **Contacts (n)** — `fa-users` + label + `＋ Add` link. Rows: 32px circular initials avatar
  (`#E6F7FD` bg, `#0080B5` text), name as link 13.5px/800, role chip, meta line 12px muted.
- **Team (n)** — same header pattern. Rows: 30px grey avatar, name (truncates with ellipsis),
  uppercase role chip pushed right.

Right column:

- **Graded calls (n)** — `fa-certificate`. Rows: call name link, who, length, grade pill
  (green for A range, blue for B range).
- **Tasks (n pending)** — `fa-clipboard`. Rows: 15px checkbox (done = filled green + white
  check), label, due date right-aligned. Done rows dim the label; overdue rows turn the due
  date red.
- **Notes (n)** — label + `＋ Add note`. Rows: 13px/1.5 prose + `author · date` meta.

#### Profile tab

Seventeen collapsible field groups, **all collapsed by default**. Each header row:
`fa-angle-right` chevron, group icon, title 13.5px/800, and `n/total filled` right-aligned —
accent when > 0, ghost grey when 0. Expanded rows are a
`minmax(0,1.5fr) minmax(0,2fr) 18px` grid: label / value / pencil. Empty values render `—` in
ghost grey. Footer, right-aligned: `Last synced from MasterSuite: {timestamp}`.

| Group                     | Icon                      | Prospect | Franchisee |
| ------------------------- | ------------------------- | -------- | ---------- |
| Identity & contact        | `fa-user-o`               | 5/13     | 1/13       |
| Background & demographics | `fa-briefcase`            | 3/22     | 7/22       |
| Personality & psychology  | `fa-lightbulb-o`          | 1/16     | 2/16       |
| Goals & vision            | `fa-bullseye`             | 2/14     | 0/14       |
| Financial profile         | `fa-usd`                  | 4/18     | 0/18       |
| Franchise fit             | `fa-puzzle-piece`         | 2/10     | 0/10       |
| Territory                 | `fa-map-marker`           | 1/11     | 0/11       |
| Sales journey             | `fa-line-chart`           | 3/12     | 0/12       |
| Validation                | `fa-check-circle-o`       | 0/8      | 0/8        |
| Trainual                  | `fa-book`                 | 0/5      | 0/5        |
| Compliance                | `fa-shield`               | 0/8      | 0/8        |
| Objections & concerns     | `fa-exclamation-triangle` | 2/16     | 0/16       |
| Behavioral signals        | `fa-heartbeat`            | 0/12     | 0/12       |
| Engagement                | `fa-bolt`                 | 0/8      | 0/8        |
| External research         | `fa-search`               | 0/10     | 0/10       |
| AI Scout intelligence     | `fa-android`              | 0/17     | 0/17       |
| Predictive scores         | `fa-bar-chart`            | 0/12     | 0/12       |

Counts above are mock data — drive them from the real model. Identity & contact fields:
Name, Email, Phone, Address, City, State, Linkedin.

#### Personal EOS tab

- **Goals** — three labeled boxes: Income goal, Lifestyle goal, Quality of life goal. Each is a
  bordered `#FBFCFD` block, min-height 52px, that reads as editable prose. Unfilled shows the
  prompt question in ghost grey (_"What does success look like personally?"_).
- **Issues (n)** — red count pill. Rows: colored dot, text 13px/700, `raised {date}` meta.
  Trailing input, _"Add an issue…"_.
- **To-dos (n)** — accent count pill. Same row shape, `due {date}` meta, overdue in red.
  Trailing input, _"Add a to-do…"_.
- **Habits** _(Franchisee)_ — rows: habit name, cadence chip, streak right-aligned (green for a
  live streak, amber for a broken one). Footer: text input + cadence `<select>`
  (Weekly / Daily / Bi-weekly / Monthly).

### Right rail

- **Where things stand** — 2×2 tiles. Deliberately _not_ counts that repeat in the rail below:
  Next touch, Last contact, Owner, Capital. Values 16–19px/800, tabular; sub-note 10.5px muted.
- **Nine sections**, in order: Activity, Territories, Journeys, Team, Calls, Tasks, Notes,
  Appointments, Documents. Icons: `fa-commenting-o`, `fa-map-marker`, `fa-users`, `fa-user-o`,
  `fa-phone`, `fa-check-square-o`, `fa-file-text-o`, `fa-calendar-o`, `fa-folder-o`.
- **Workflow agent** card.

---

## Screen: Journey

**Purpose.** Where one person sits in the franchise sales process, and what is holding them up.

### Hero panel — pipeline stepper

This is the centerpiece and the part most worth building carefully.

**Row 1** — pipeline chips, one per pipeline, clickable. Active is solid accent; inactive is
white on a 1px border. Right-aligned: days-in-stage, amber. No counts on the chips.

**Row 2** — the stepper. `display:grid; grid-auto-flow:column;
grid-auto-columns:minmax(126px,1fr); gap:7px; overflow-x:auto`. Columns keep a 126px floor and
the row scrolls rather than letting labels collide. Each column:

- **Connector row**: 3px line, 22px circular node, 3px line. First column's left line and last
  column's right line are transparent. Lines are green through the current stage, `#E2E7EE`
  after.
- **Node**: done = green fill + white check; current = accent fill + dot + `0 0 0 4px`
  accent-at-15% halo; upcoming = white on `#DDE2E8`.
- **Stage card**: 3px accent bar across the top, then title 11.5px/800 with `text-wrap:balance`,
  a right-aligned meta (`date` when done, `n/total` when current, blank when upcoming), then
  the sub-stage list. Current card is white with a lifted shadow; done cards are faintly green
  (`#F8FBF9` on `#E0EEE5`); upcoming are grey (`#FBFCFD` on `#EDF0F4`).
- **Accent bar ramp**: `hsl(6 + (i/last)*132, 72%, 58%)` — red at the first stage through green
  at the last, matching the pipeline board. Upcoming stages use `#E8ECF1`.
- **Sub-stage rows**: 9px icon + 10.5px/600 label. Done = `fa-check-circle`; the single next
  one on the current stage = `fa-dot-circle-o` in accent; upcoming = `fa-circle-o` in
  `#D9DEE5`. A stage with no sub-stages prints _"No sub-stages"_ in ghost grey.

**Row 3** — **Journey brief**, uppercase label + prose.

### Pipelines and sub-stages — real structure

Four pipelines. A journey sits in one stage of one pipeline; pipelines it has not entered render
entirely grey with _"no history in this pipeline"_.

**Path to Ownership**

| Stage         | Sub-stages                                              |
| ------------- | ------------------------------------------------------- |
| Engagement    | New Lead, Intro Call, PTO                               |
| Qualification | NDA, Matt Call, Zorakle                                 |
| Discovery     | Sam Call, PFS, Background, Mark Call                    |
| Compliance    | FDD, FDD Review Call, Territory Call, FA Info Gathering |
| Awarding      | Matt Final Call, Franchise Award Letter, FA, FF         |
| Closed        | Closed                                                  |

**Onboarding**

| Stage       | Sub-stages                                                                          |
| ----------- | ----------------------------------------------------------------------------------- |
| Setup       | Legal Entity, NAH Website, Google Workspace, Bank Account                           |
| Training    | Trainual Part 1, Trainual Part 2, Trainual Part 3, Trainual Part 4, Trainual Part 5 |
| Launch Prep | Accounts, Insurance, Workstation                                                    |
| Onboarded   | Onboarded                                                                           |

**Runway**

| Stage              | Sub-stages                                               |
| ------------------ | -------------------------------------------------------- |
| First Offer        | First Lead, First Walkthrough, First Offer, 10 Offers    |
| First Purchase     | First Contract, Closing Set, Closing, Construction Start |
| Inventory Building | 1st Completed, 25 Offers, 3 Purchased                    |
| Running            | Running                                                  |

**Long-Term Follow-Up**

| Stage      | Sub-stages   |
| ---------- | ------------ |
| Nurture    | Nurture      |
| Follow-up  | _(none)_     |
| Re-engaged | Resume Sales |

⚠️ **One unverified label.** The first sub-stage of _Engagement_ was cut off in the source
screenshot; the mock uses **"New Lead"** as a placeholder. Confirm against the real pipeline
config before shipping.

### Tabs: Overview · Profile · Territories

Default **Overview**, using the shared Overview card set. Messages and Documents tabs were
removed — that content lives in the rail.

### Right rail

- **Revenue** card: Franchise fee, Royalty paid, Due (amber), Total (green, larger), then a
  goal progress bar with `$347,500 of $500k goal · 70%`.
- Nine sections: Activity, Territories, Contacts, Team, Calls, Tasks, Notes, Appointments,
  Documents.
- **Contacts on this journey** tiles.

---

## Screen: Territory

**Purpose.** How one franchise territory is performing and who operates in it.

### Hero panel

Two columns, `minmax(0,1fr) 300px`. Left: **Ownership** — 44px accent avatar, owner name linking
to the contact page, `Owner since {date} · Open journey →`; then **Territory brief** prose.
Right: map placeholder, `#E7F3EA` on `#CDE5D3`, min-height 190px, centered caption. Replace
with real ZIP boundary rendering.

### Tabs: Overview · Ecosystem · Performance · Data · EOS

Default **Overview** (shared card set).

#### Ecosystem

- **Org chart card**: owner at top — 72px avatar ringed `#9BD9F2`, name, `OWNER`, _View
  profile_ link — then a 34px vertical connector, then a centered row of stakeholders. Each:
  role chip with icon, 58px avatar tinted per role, name. Role tints: Contractor amber,
  Partner green, Family pink.
- **Stakeholder table**: `minmax(0,1.6fr) minmax(0,0.9fr) minmax(0,1fr) minmax(0,1.3fr) 22px`
  — Name/company (ellipsis), Role chip, Phone, Email, `fa-trash-o`. Empty cells `—` in ghost
  grey. Footer: full-width `＋ Add stakeholder` button.

#### Performance

- **Period control** — segmented, inside a white 11px-radius shell with 4px padding:
  Last Month · Last 3 Months · Last 12 Months · YTD · All Time. Active is solid accent.
  Appears **only** on this tab.
- **KPI cards** — `repeat(auto-fit,minmax(190px,1fr))`. Each: icon + label 12.5px, value
  26px/800/-.03em tabular, note 11.5px. Nine of them: Leads entered, Lead progression,
  Lead → purchase, Active inventory, Purchased, Sold, Cycle time, Avg profit, Total profit.
  Money values green.
- **Lead list building** — two columns. Left: title, sub-caption, big total (38px/800) +
  _"lead list created"_, then a 172px `conic-gradient` donut. Right: 2-up legend tiles (dot,
  label, count) for the eight lead types, then a **Benchmark progression** block —
  percent, `472 / 8,000 target`, progress bar, shortfall line.
  Types and colors: Birddog `#2563eb`, Probate `#ea580c`, Litigation `#16a34a`, City citations
  `#dc2626`, Eviction `#8b5cf6`, Divorce `#0891b2`, Tax delinquent `#ca8a04`, Other `#db2777`.
- **Lead sources** — inline bordered chips, count bold then label.
- **Property funnel** — rows of
  `minmax(0,1.3fr) minmax(40px,3fr) minmax(0,0.62fr)`: stage name + "% from prior" sub-line,
  30px rounded bar, count + share. Bar colors ramp blue → purple → orange → green across the
  six stages. Below, a **Bottleneck board**: amber icon tile, _"Biggest pressure point: {x}"_,
  then three drop-off callouts with down arrows.
- **Pipeline comparison** — `minmax(0,1.5fr) minmax(0,0.55fr) minmax(0,0.62fr)
minmax(0,0.58fr)`: Stage / This / Median / Target, target green when beaten, red when missed,
  `—` when none. Footer explains how targets scale from monthly goals.
- **Active inventory (n)** and **Sold — YTD (n)** — one block per property: address link,
  status chip, source, then right-aligned days-held (red), ARV, profit (green or red). Below,
  a 5-step horizontal timeline — Purchased → Construction → Complete → Listed → Sold/Rented —
  13px nodes on 2px connectors, each with a label and a date.

#### Data

Fifteen collapsible groups, all collapsed, same header pattern as the Contact Profile tab:
Owner & contact `6/6`, Address `4/4`, Business `5/8`, Key dates `3/5`, Marketing `2/9`,
Compliance & accounts `7/9`, Territory overview `5/12`, Demographics `0/15`, Population trends
`0/10`, Housing `0/16`, Real estate market `0/16`, Flip market `0/14`, Economy & employment
`0/14`, Construction `0/11`, Competition `0/10`. Sync stamp in the footer.

#### EOS

- **Goals** table — `minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1.6fr)
minmax(0,0.8fr)`: metric / Actual / Current year / Year 5 / Year 25. Long Year-5 prose wraps.
- **Scorecard** — Metric / Goal / Actual, actual green when met, amber when short.
- **Monthly spend** — line items then a bold total row.
- **Lead generation channels** — horizontally scrolling groups (Bulk lists, Lead mining, Listed,
  Auctions, Referral partners, Digital). Each channel is a checkbox over a 34px × 150px colored
  bar with the label set vertically (`writing-mode:vertical-rl; transform:rotate(180deg)`).
  Checked = filled blue box; unchecked = white on grey. Bar tints by group family.
- **Business habits** — habit name + an A/B/C/D/F button row, earned grade filled accent.
- **Rocks / Issues / To-dos** — three cards, `repeat(auto-fit,minmax(240px,1fr))`, each with a
  count pill and dot-prefixed items with owner/date meta.
- Sync stamp.

### Right rail

- **Operations — YTD** — 2×2 tiles + a "High performer" chip in the header.
- Nine sections: Activity, Journeys, Contacts, Team, Calls, Tasks, Notes, Appointments,
  Documents.
- **Contacts on this territory** tiles + Workflow agent card.

---

## Interactions & behavior

- **Tabs** switch the visible pane. Existing FranDev pages use server-side `?tab=` anchors;
  the mocks switch client-side. Either is fine — pick one and apply it to all three pages.
  Selected tab should survive a reload.
- **Collapsible sections** — field groups and rail sections are closed on load, every page,
  no exceptions. Use native `<details>` with `.gt-acc2` from `_Tabs.cshtml`, which already has
  the rotating chevron. Open/closed state is not persisted.
- **Inline edit** — click a field value to edit in place. `.gt-edit` provides the states:
  transparent at rest, bordered on hover, accent ring on focus, green flash on save, red on
  error.
- **Pipeline chips** switch which pipeline the stepper shows. Stage cards and sub-stage rows are
  `cursor:pointer` — wire them to stage/sub-stage detail or advance actions.
- **Period control** on Territory Performance re-cuts the numbers. In the mock it only switches
  active state; the data does not change. This needs real wiring.
- **Hover** — rail rows and list rows tint to `#FBFCFD`; links go accent; the primary button
  darkens to `#0080B5`; the trash icon goes red.
- **Disabled actions** (Merge, Delete, Transfer, Retire) render at `opacity:.55` with
  `cursor:default`. They are placeholders for unbuilt flows — keep them visible.
- **Empty states** are always specific: name what will fill the space and what fills it, never
  a bare dash on its own line. Zero-count rail sections dim rather than disappear.

## State

Per page: active tab; per-section open/closed; per-field edit + save status. Journey adds the
selected pipeline. Territory adds the selected period. Nothing here needs a client store —
component-local state or server round-trips both work.

Data each page needs, beyond what the V2 models already load: graded calls with grades, tasks
with due dates and done state, notes with authors, per-group filled/total field counts,
pipeline definitions with ordered sub-stages and per-record completion, and (Territory) funnel
counts, lead-list type breakdown, benchmark targets, inventory timelines, EOS goals/scorecard/
spend/channels/habits.

---

## Design tokens

**Use the property page column.** The mock column is listed so you can translate the design
files; it is not what ships.

| Role              | Mock value                     | Property page — ship this                                    |
| ----------------- | ------------------------------ | ------------------------------------------------------------ |
| Page background   | `#F6F8FB`                      | `#f6f8fb`                                                    |
| Card background   | `#fff`                         | `#fff`                                                       |
| Card border       | `#E6E9ED`                      | `rgba(15,23,42,.07)`                                         |
| Card shadow       | `0 1px 2px rgba(16,30,51,.04)` | `0 1px 3px rgba(15,23,42,.06), 0 1px 2px rgba(15,23,42,.04)` |
| Card radius       | 14px                           | 14px                                                         |
| Inner tile radius | 11px                           | 9px (`.kt`)                                                  |
| Button radius     | 9px                            | 9px                                                          |
| Pill radius       | 999px                          | 999px                                                        |
| Ink               | `#1B2430`                      | `#0f172a`                                                    |
| Body text         | `#4A5462`                      | `#334155`                                                    |
| Muted / labels    | `#7A828F`                      | `#94a3b8`                                                    |
| Faint             | `#AEB5BF`                      | `#94a3b8`                                                    |
| Ghost / empty     | `#C3C9D2`                      | `#cbd5e1`                                                    |
| Hairline          | `#F4F6F8`                      | `rgba(15,23,42,.06)`                                         |
| Accent            | `#00A1E1`                      | `#00a1e1`                                                    |
| Accent hover      | `#0080B5`                      | `#0089c4`                                                    |
| Accent tint       | `#E6F7FD`                      | `#e6f7fd`                                                    |
| Accent tint text  | `#0080B5`                      | `#0080b5`                                                    |
| Green / money     | `#1E8E4E`                      | `#059669`                                                    |
| Green tint / text | `#E7F6EC` / `#15803d`          | `#dcfce7` / `#15803d`                                        |
| Amber             | `#B07A0E`                      | `#a16207`                                                    |
| Amber tint        | `#FFF4D6`                      | `#fef9c3`                                                    |
| Red               | `#CE4138`                      | `#b91c1c`                                                    |
| Red tint          | `#FDEAEA`                      | `#fee2e2`                                                    |
| Purple (agent)    | `#5751C4` / `#423DA8`          | `#6d28d9` on `#ede9fe`                                       |
| Section label     | 11px / 700 / .08em / uppercase | `.gt-h` — 11px / 700 / .08em / `#94a3b8`                     |
| Field key         | 12.5px / 600                   | `.gt-fk` — 10.5px / uppercase / .03em                        |
| Field value       | 13px / 700                     | `.gt-fv` — 14.5px / 700                                      |
| Record title      | 26px / 800 / -.025em           | `.ghead` title                                               |
| KPI value         | 22–26px / 800 / -.02em         | `.gt-mv` 21px / 800 / -.02em                                 |
| Page zoom         | none                           | `zoom: 0.82` via `.gn-person`                                |

**Type.** Mocks use Hanken Grotesk 400–800. The app's own stack governs — see
`wwwroot/assets/css/platform/typography.scss` and `wwwroot/css/gunner.css`. Do not introduce a
webfont the app does not already load.

**Numbers.** Every figure gets `font-variant-numeric: tabular-nums` so columns align.

**Spacing.** 14px between page-level blocks, 12px between cards inside a tab, 9px between rail
rows, 16–18px card padding, 6–7px between chips.

**Icons.** Font Awesome 4.7, already in the app at
`wwwroot/assets/css/vendor/font-awesome.min.css` with webfonts in `wwwroot/assets/css/fonts/`.
Use `<i class="fa fa-*">`; the bundle copy exists only so the mocks render offline.

## Assets

- `assets/MasterSuite.svg` — logo, copied from `wwwroot/assets-v1/img/logos/MasterSuite.svg`.
  Use the app's own copy.
- `assets/css/vendor/font-awesome.min.css` + `assets/css/fonts/*` — copied from
  `wwwroot/assets/css/`. Use the app's own copy.
- No other imagery. The Territory map is a labeled placeholder awaiting real ZIP boundaries.

## Files in this bundle

| File                                  | What it shows                                                   |
| ------------------------------------- | --------------------------------------------------------------- |
| `Frandev Journey.dc.html`             | Journey — pipeline stepper with all four pipelines, 3 tabs      |
| `Frandev Prospect.dc.html`            | Contact in **prospect** state — 3 tabs, 17 field groups         |
| `Frandev Franchisee.dc.html`          | Contact in **franchisee** state — same page, different header   |
| `Frandev Territory.dc.html`           | Territory — 5 tabs including full Performance and EOS           |
| `MSHeader.dc.html`                    | The MasterSuite chrome bar, for reference only — do not rebuild |
| `Gunner Buyer/Seller/Partner.dc.html` | The Gunner contact pages, same shell, **not in scope**          |
| `support.js`                          | Runtime that makes the `.dc.html` files open in a browser       |
| `github.md`                           | Repo/branch/commit provenance and a screen → source-file map    |

All sample data — names, addresses, dollar figures, dates, fill counts — is invented. Only the
pipeline and sub-stage names are real, and one of those is flagged above.

---

## Acceptance checklist

**Template**

- [ ] ContactV2's inline shell CSS is gone; it pulls from `Pages/Gunner/ShellStyles/`.
- [ ] A single shared record-page shell renders the header, grid, tab strip, rail, and dock for
      all three pages.
- [ ] Editing the shell partial visibly changes all three pages and the property page.
- [ ] The nine rail sections come from one parameterised partial, not nine copies × three pages.
- [ ] Every panel has a `PanelKey` and appears in the dev manifest.

**Prospect / Franchisee**

- [ ] One page, one route family. No `Franchisee.cshtml`.
- [ ] Header chips, sub-line tail, and the Habits card are the only rendered differences.

**Per page**

- [ ] Every tab renders real content. No blank panes.
- [ ] All field groups and rail sections load collapsed.
- [ ] Nine rail sections on every page, zero-count ones dimmed and present.
- [ ] No Offers section anywhere in FranDev.
- [ ] Field values edit in place with save/error feedback.

**Visual**

- [ ] Side by side with the property page at 1440, cards, labels, and type read as the same
      system — same borders, same shadows, same label treatment.
- [ ] No element overflows its container at 1024–1440. Tables use `fr` tracks, not fixed px
      maxes; the pipeline stepper scrolls rather than colliding.
- [ ] Numbers are tabular and columns align.
- [ ] Chips and tab labels never wrap mid-label.

**Journey specifically**

- [ ] All four pipelines selectable; the stepper re-renders per pipeline.
- [ ] Sub-stages match the tables above; "New Lead" confirmed or corrected.
- [ ] Node, connector, and accent-bar states are correct for done / current / upcoming.
