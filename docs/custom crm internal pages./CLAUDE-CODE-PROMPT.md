# Claude Code Prompt — CRM Internal + Franchisee Contact Pages

Paste everything below into Claude Code. The HTML mock files referenced (`Journey.dc.html`, `Territory.dc.html`, `Contact.dc.html`, `Contact Seller.dc.html`, `Contact Buyer.dc.html`, `Contact Partner.dc.html`) are the visual source of truth — copy them into the repo so Claude Code can read them.

---

## Context

We are extending our custom CRM (the app that already has the franchisee-facing **Property page**) with five more record pages that all reuse the Property page's panel architecture. Six approved HTML mockups are included in this repo — treat them as pixel-level design specs. Recreate them in our existing stack (match whatever framework/components the Property page uses; do not introduce new libraries).

**Internal-team pages** (used to sell franchises and coach franchisees):

1. **Journey page** — one prospect/franchisee's journey through the sales + onboarding pipeline (`Journey.dc.html`)
2. **Territory page** — one territory's operations, ecosystem, and EOS (`Territory.dc.html`)
3. **Contact page (internal)** — a prospect/franchisee person record (`Contact.dc.html`)

**Franchisee-facing pages** (inside the franchisee app, same shell as the Property page): 4. **Seller contact page** (`Contact Seller.dc.html`) 5. **Buyer contact page** (`Contact Buyer.dc.html`) 6. **Partner contact page** (`Contact Partner.dc.html`)

## The shared panel model (identical on every page)

Every record page is the same grid. Reuse ONE shared layout component/shell for all six pages; each page supplies its own panel contents.

```
┌──────────────────────────────────────────────────────────────┐
│ top app nav (existing, 44px)                                  │
├───────────────┬──────────────────────────┬────────────────────┤
│ 0A identity   │ 0B  (blank white bar,    │ 0C page actions    │
│ card          │      reserved for a      │                    │
│               │      future "next best   │                    │
│               │      action" chiron)     │                    │
├───────────────┴──────────────┬───────────┴────────────────────┤
│ PANEL 1  hero (page-specific)│ PANEL 3  KPI panel (360px)     │
├──────────────────────────────┤────────────────────────────────┤
│ PANEL 2  tab strip + tab     │ PANEL 4  activity rail:        │
│ content                      │  - fixed collapsible sections  │
│                              │  - contact selector card       │
│                              │  - purple workflow agent card  │
└──────────────────────────────┴────────────────────────────────┘
                                        [Ask Scout ✦]  ← floating
```

Rules that apply everywhere:

- **Row 0**: 0A = status pills + back arrow + record name (+ slug in muted caps to the right of the name, e.g. "Chattanooga CHATT"). 0B = an **empty white panel** (flex:1) — intentionally blank for now. 0C = page-level actions only (see per-page lists below). No Call/Text/Email/Schedule buttons anywhere in row 0.
- **Panel 4 rail** is the SAME fixed section list on every page, all **collapsed by default**, each header = uppercase label + count pill + chevron, expanding inline: ACTIVITY, OFFERS, CONTACTS, TEAM, CALLS, TASKS, NOTES, APPOINTMENTS, DOCUMENTS.
- Below the rail sections: a **contact selector card** ("CONTACTS ON THIS JOURNEY/TERRITORY" with avatar chips, selected chip = purple tint `#efeafb` / border `#c9b8ec`, plus a dashed "+ add" chip) and then the **purple workflow card** (booking/deal-match/intake agent): lavender `#f7f5fd` inset card with 10px side margins and rounded corners, header row (amber status dot, purple agent name, "Emails + texts" pill, purple toggle switch), then a vertical timeline of queued/draft steps (dot + connector line, white step cards with when/CHANNEL pill/status + message preview). The internal Contact page and the three franchisee contact pages have no selector card — just 12px spacing then the workflow card.
- **Floating AI assistant**, bottom-right fixed on every page: white "Ask Scout anything…" capsule + blue circular ✦ button (56px stack, z-50). On franchisee pages label it "Ask Chiron anything…". It is an app-level overlay, NOT part of page layout.
- **Tabs (Panel 2)**: active tab = blue text `#1e88e5` + 2px blue underline; inactive `#5a6b88`. Tab content areas are built per page below. Any tab marked _stub_ renders a centered muted placeholder.
- **Cross-links**: Journey ↔ Territory ↔ Contact (internal) link to each other everywhere a name appears (owner card, stakeholder tables, "Open journey →", territory chips, etc.).

## Visual language (matches the Property page / MasterSuite)

- Font: **Nunito Sans** (400/600/700/800/900). Page bg `#eef1f6`. Panels: white, `1px solid #dde4ef`, radius 8px, shadow `0 1px 2px rgba(27,42,74,.06)`.
- Text: primary `#26324b`, secondary `#5a6b88`, muted `#8494ad`, faint `#98a6bf`. Links `#1e88e5` (hover `#1565c0`).
- Section labels: 10.5–11px, weight 800, letter-spacing .8px, uppercase, `#8494ad`.
- Pills: green `#e5f3e8`/`#2e7d43` (active/positive), blue `#e3f0fc`/`#1e88e5` (stage/info), amber `#fdf3e3`/`#c07f16` (warning/"Chad fills"), red `#fdecec`/`#d64545` (destructive/negative), pink `#fdeef4`/`#c2447d` (family), neutral `#eef2f8`/`#5a6b88`.
- Purple workflow family: `#6b46c1` primary, `#efeafb` tint, `#e2dcf5`/`#e7e1f6` borders, `#8f7fc4` muted, toggle off `#c9c2dd`.
- KPI tiles: `#f6f8fc` bg, `#e4eaf4` border, radius 6px, 9.5px label / 16–17px value; money-positive values `#2e7d43`.
- Inner cards inside Panel 2: `1px solid #e4eaf4`, radius 6px; table headers `#f6f8fc` bg with 10.5px/800 uppercase columns; row dividers `#edf1f7`.
- Destructive buttons: red tint bg; secondary: `#f1f4f9` bg + `#dde4ef` border.

## Page specs

### 1. Journey page (internal) — `Journey.dc.html`

- **0A**: green ACTIVE pill + blue stage pill; name "Ryan Decker · Journey". **0C**: `Merge` (amber) + `Delete Journey` (red).
- **Panel 1 (hero)**: journey brief paragraph + **stage pipeline** — a row of stage tab buttons (Lead → Discovery → Validation → Award → Onboarding …) where the current stage is filled blue with glow, past stages tinted, future stages white; each shows name + date; **clicking a stage changes it**. To the right of the stage row: an **"Other ▾" dropdown** (white button, same height as stages) containing `↘ Follow-up` and `↘ Nurture`. No Revert button.
- **Panel 3**: revenue/royalty KPI tiles.
- **Panel 2 tabs**: Overview · Messages _(stub)_ · Profile · Documents _(stub)_ · Territories · EOS.
  - **Profile**: contact sub-tab chips (Ryan Decker Franchisee / Shannon Smylie family) with `👤+ Add contact` and `⑂ Split Journey` buttons on the right; "FRANCHISEE INFORMATION" 2-col field grid + EMAIL(2) list (★ primary / ☆ secondary); a Prospect Score card (big blue number 94); then six collapsible sections with icon + "n/m filled" counters: Identity & Contact 2/13, Background & Demographics 12/22, Personality & Psychology 3/16, Goals & Vision 3/14, Financial Profile 2/18, Franchise Fit 1/10 (rows in Franchise Fit carry an amber "Chad fills" tag). Every row: label / value (em-dash muted when empty) / ✎ edit affordance.
  - **Territories**: one accordion per linked territory (Murfreesboro TN MURF active — expanded by default; Clarksville TN CLRK reserved). Inside: OPERATIONS—YTD 4-tile row (Leads Entered 19, Deal Progression 42.1%, Sold 2, Avg Profit $-958 in red), QUARTERLY GRADES empty state, owner avatar card (link to Contact page), stakeholder table (NAME/COMPANY · ROLE · PHONE · EMAIL) + "＋ Add stakeholder".
  - **EOS**: "PERSONAL EOS" (Goals textareas: Income/Lifestyle/Quality-of-Life; Issues input; To-Dos input; Habits input + Daily/Weekly/Monthly select) then "TERRITORY EOS" scoped by territory chips (Murfreesboro/Clarksville). Territory EOS blocks: Goals table (ACTUAL/CURRENT YEAR/YEAR 5/YEAR 25), Scorecard (METRIC/GOAL/ACTUAL — T3 Leads Entered 60→19, T3 S1-to-S4 0%→42.1%, T3 Purchased 2→2, T3 AVG Inventory 2→1, T12 Median Cycle Days 180→—, T3 Gross Profit $50,000→$0, T3 Compliance 100%→100%), Monthly Spend list with blue Total ($1,137.00), **Lead Generation Channels**: full-width row of ~20 vertical 170px bars with rotated labels + checkbox above each (mauve = list-building, cream = referral, maroon = paid), Business Habits with A–F grade squares (selected A = green fill), and a 3-column Rocks (status pills) / Issues (checkboxes) / To-Dos (checkboxes, done = strikethrough) grid.
- **Panel 4** contact selector: Ryan + Shannon chips.

### 2. Territory page (internal) — `Territory.dc.html`

- **0A**: ACTIVE + HIGH PERFORMER green pills; "Chattanooga" + muted `CHATT` slug beside it. **0C**: `Transfer` (amber) + `🗑 Retire Territory` (red).
- **Panel 1**: OWNERSHIP block (avatar KT, "Ken Tolbert" → Contact page, "Owner since 2/5/2021 · Open journey →") + TERRITORY BRIEF paragraph; right side 300px territory-map placeholder (green tinted, "zip boundaries render from live data").
- **Panel 3**: "OPERATIONS — YTD" + High Performer pill; tiles: Leads Entered 319, Deal Progression 32%, Sold 6, Avg Profit $22,497 (green).
- **Panel 2 tabs**: Ecosystem · Performance · Data · EOS.
  - **Ecosystem**: stakeholder graph (owner node KT at top w/ blue ring, "♡ Family" pill, child nodes Chandler/Tara Tolbert in pink) + stakeholder table + "＋ Add stakeholder".
  - **Performance**: time-range chips (Last Month / Last 3 Months / Last 12 Months / **YTD** default / All Time); 3×3 KPI cards (Leads Entered 319, Lead Progression 32%, Lead→Purchase 41 avg days, Active Inventory 5, Purchased 6, Sold 6, Cycle Time 112, Avg Profit $22,497, Total Profit $134,982 — money green); Lead List Building card (count + donut + per-source rows + Benchmark Progression bar toward 7,000); Lead Sources chips; **Property Funnel** (6 horizontal rounded bars Stage 1→Stage 6 with counts/percentages, blue→purple ramp) + amber "Bottleneck board" (3 worst stage transitions in red); **Pipeline Comparison** table (STAGE/THIS/MEDIAN/TARGET + target methodology footnote); Latest Stage 4 Offers list (address + status pill + source/type chips + green `Pictures`/`Mastermind` outline buttons); Sold—YTD empty state.
  - **Data**: 11 collapsible sections: Owner & Contact, Address, Business, Key Dates, Marketing, Compliance & Accounts, Territory Overview 10/12, Demographics 4/15, Population Trends 1/10, Housing 1/16, Real Estate Market 0/16. Same row pattern as Profile sections.
  - **EOS**: territory EOS only (same blocks as Journey's Territory EOS, Chattanooga numbers: Gross Profit $134,982 actual, scorecard actuals 81/32%/2/5/112/$44,994/100%). Lead Gen Channels bars stretch full width (`flex:1` columns, bars max 34px).
- **Panel 4** contact selector: Ken / Chandler / Tara chips ("CONTACTS ON THIS TERRITORY").

### 3. Contact page (internal) — `Contact.dc.html`

- **0A**: FRANCHISEE green pill + blue **RUNNING** stage pill; "Ken Tolbert". **0C**: primary blue `Open journey →` button + `🗑 Delete Contact` (red). No Merge.
- **Panel 1**: 3-col grid — EMAIL(2) (★/☆ + "＋ Add"), PHONE, LOCATION; below divider: CONTACT BRIEF paragraph + "TERRITORIES OWNED" card (Chattanooga · active → Territory page).
- **Panel 3**: "INVENTORY — ACROSS 1 TERRITORY": big 6 Houses Purchased YTD + tiles Sold 6 / Active Deals 5 / Avg Conv 29% / Avg Profit $22,497.
- **Panel 2 tabs**: Contacts · Profile · Personal EOS.
  - **Contacts**: "JOURNEYS THIS PERSON IS IN (1)" card (PRIMARY · Joined 2/5/2021 · active pill → Journey page) + "RELATED CONTACTS (2)" (Chandler/Tara with Family pills).
  - **Profile**: same six collapsible sections pattern as Journey Profile (Ken's data, "Chad fills" tags in Franchise Fit).
  - **Personal EOS**: Goals textareas / Issues / To-Dos / Habits (no territory EOS here — it lives on Territory).
- **Panel 4**: rail then workflow card directly (no selector).

### 4–6. Franchisee contact pages — Seller / Buyer / Partner

Shared decisions: **0C** = `Merge` (amber) + `🗑 Delete Contact` (red); 0A includes a colored role pill (purple PRIMARY SELLER / green QUALIFIED BUYER / red WHOLESALER), a blue `GHL ↗` chip, and context line (linked property / company / "Partner · 1 deal linked"). Panel 1 uses one shared template across all three: a 3-col contact-info grid on top, divider, then two lower blocks that vary by role. Assistant = Chiron.

- **Seller (Susan Cox)** — Panel 1: PHONE / EMAIL / LINKED PROPERTY(614 Golf Club Lane); below: "STRONGEST SELLER SIGNALS" (empty state) + "MISSING CRITICAL FIELDS" chips (Motivation, Timeline, Asking price, Lowest acceptable, Decision makers, AI summary). Panel 3 "SELLER SNAPSHOT": Profile Filled 5/14 (36%), Deal Context 1 linked property, Last Contact Jul 16 2026 (full-width). Tabs: **Identity** (Contact Information table 2/8 with em-dash empties) · Situation · Financial · Activity · AI Insights _(stubs)_. Workflow = follow-up agent (draft steps, paused).
- **Buyer (Angel Cielo)** — Panel 1: TIER select (Qualified) + RESPONSE SPEED select; MARKETS blue chips (Delaware, Dover DE, Wilmington DE, + Add market); BUYBOX toggle chips (Builder/Flipper/Landlord/Multi Family/Turn Key — active = solid blue, clickable); right 270px CONTACT card (phone/email/company/last contact). Panel 3 "BUYER SNAPSHOT": Active Deals 1, Closed 0, Revenue —, Response Rate —, Profile Filled 7/15 with 47% progress bar; "Buyer since Jul 8, 2026". Tabs: **Identity** (Active Deals 1 — 2813 West 2nd Street card w/ Matched·Purchased·ARV $220,000·Ask $90,000; Previous Deals 0) · **Buybox** (Buyer Preferences table 5/9: Hold Period, Rehab Timeline, PM Company, Off-Market Only No, 1031 No, Opportunity Zone No, Creative Finance No, Subject-To No, Target Tenant —) · Activity · Communication · AI Insights _(stubs)_. Workflow = deal-match agent (running, queued deal-packet steps).
- **Partner (Adiel Sanchez)** — Panel 1: PHONE / EMAIL(—) / WEBSITE+COMM PREF; below: partner-type selector (currently shows "Wholesaler" — model as a select/chips, not "signals") + MISSING CRITICAL FIELDS chips (Email, Markets, Grade, Contact preference, Reputation notes, Internal notes). Panel 3 "PERFORMANCE WITH US": Sourced to Us 0 / Taken From Us 0 / Closed w/ Us 0 (red-tinted tile) / JV History 0 + Last Deal / Response Rate / Reliability row. Tabs: **Identity** (Wholesaler operation table, Markets & focus table, Deal history table — 512 14th Avenue NW Largo FL · No Offer pill · Wholesaler · linked Jun 29 2026, and "Everything with this person" message HISTORY (25) list with MSG badges) · Operation · Deal History · Activity · AI Insights _(stubs)_. Workflow = partner intake agent (paused, draft steps requesting missing info).

## Data & wiring notes

- All numbers/names above are real sample data from our current app — keep them as seed/fixture data so pages render realistically before API wiring.
- Model every collapsible ("n/m filled") section and rail section generically: `{name, icon, count/filled, rows[]}` so fields are config, not markup.
- Stage pipeline, tab strips, accordions, KPI tiles, pill, and the purple workflow card should each be one reusable component shared by all six pages.
- Interactions to preserve: clickable pipeline stages, Other▾ dropdown, tab switching, rail expand/collapse, accordion territories/sections, buybox chip toggles, agent on/off toggles (status line changes), contact-selector chips, hover states on links/menu items.
- Empty values render as muted em-dash "—"; missing-data empty states use the muted centered pattern ("No properties sold in this period", etc.).
- 0B stays blank but keep it a real component slot (`<NextBestActionBar/>` placeholder) — a guidance "chiron" will land there later.

## Acceptance checklist

- [ ] One shared record-page shell; six pages composed from it
- [ ] Panel 4 rail identical on all pages, collapsed by default
- [ ] Purple workflow card present on all six pages (selector card only on Journey/Territory)
- [ ] Floating Scout/Chiron button overlays every page bottom-right
- [ ] All cross-links navigate (journey ↔ territory ↔ contact)
- [ ] Tabs match the lists above; stubs render placeholder text
- [ ] Colors/typography match the token table exactly
- [ ] Side-by-side with the HTML mocks: no visual drift at 1440px width
