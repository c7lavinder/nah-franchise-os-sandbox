# Handoff: Franchise OS — Messaging Hub

## Overview

This is the **SMS messaging page** for an internal franchise-operations CRM ("Franchise OS"). The team uses it to sell to prospects and coach franchisees. The page has three working areas:

- **Conversation list** (left) — searchable SMS threads, with All / Unread filters and unread badges.
- **Conversation thread** (center) — an Apple-Messages-style SMS thread with a contact header and a composer.
- **Work rail** (right) — Work Queue, today's Calendar, and Tasks.

Data sources to wire up in the real app:

- **Messages**: Signal House (SMS only for now).
- **Calendar + Tasks**: GoHighLevel (GHL).

## About the Design Files

The file in this bundle (`Messaging Hub v2.dc.html`) is a **design reference created in HTML** — a prototype showing the intended look and behavior. It is **not production code to copy directly**. It is authored as a "Design Component" with a small custom template runtime, so the markup uses non-standard tags (`<sc-for>`, `<sc-if>`, `{{ }}` holes). **Do not** try to port that runtime.

Your task is to **recreate this design in the target codebase's existing environment** (React, Vue, etc.) using its established components, styling system, and data layer. If no environment exists yet, pick the most appropriate framework and implement it there. Treat the HTML as the source of truth for layout, spacing, color, type, and interaction — not for code structure.

## Fidelity

**High-fidelity.** Colors, typography, spacing, radii, and interactions are final. Recreate the UI pixel-accurately using the codebase's existing libraries and patterns. Exact hex values and pixel measurements are given below.

---

## Screen: Messaging Hub

### Purpose

Single page where a salesperson/coach reads and replies to SMS conversations, sees who needs attention, and acts on GHL appointments and tasks without leaving the screen.

### Page-level layout

- Outer page background: `#eef2f6`. Horizontal scroll allowed (`overflow-x: auto`) so the desktop layout never crushes.
- Centered content card, **max width 1280px** (`width: 1280px; max-width: 100%`), padding `24px`, border-radius `26px`, border `1px solid rgba(180,205,230,.5)`, background `radial-gradient(900px 480px at 50% -8%, #f4faff, #e6f1fb)`, shadow `0 30px 60px -30px rgba(20,60,100,.35)`.

Inside the card, top to bottom:

1. **"2 unread" pill**
2. **KPI card row** (3 cards)
3. **Workspace** (list · thread · rail)

### 1. "2 unread" pill

- Inline-flex pill, background `#F5A623`, white text, `padding: 6px 14px`, radius `999px`, `font-size: 13px`, `font-weight: 700`, shadow `0 3px 8px rgba(245,166,35,.32)`. Bottom margin `16px`.

### 2. KPI cards (keep consistent — these match every page of the site)

Row of 3 equal cards (`display:flex; gap:18px`), each `flex:1`:

- Background `linear-gradient(135deg, #1aa6e6, #0a85cf)`, radius `18px`, padding `22px 24px`, white text, shadow `0 12px 26px rgba(13,131,201,.26)`.
- Value: `font-size: 40px; font-weight: 700; line-height: 1`.
- Label: `font-size: 16px; font-weight: 600; margin-top: 10px`.
- Sub: `font-size: 13px; opacity: .82; margin-top: 2px`.
- Content: `25 / New Prospects / last 30 days` · `62/250 / Active Franchisees / of 250 goal` · `7/100 / High Performers / 10+ purchased last 12mo`.

Row bottom margin `18px`.

### 3. Workspace (responsive flex, NOT a rigid 3-column grid)

Container: `display:flex; flex-wrap:wrap; align-items:flex-start; gap:18px;`

This is important: the rail must **wrap below** when the viewport is too narrow rather than crushing the thread.

- **List column**: `flex: 0 0 300px; height: 730px;` (fixed width, does not shrink).
- **Thread column**: `flex: 1 1 460px; min-width: 360px; height: 730px;` (grows, but never narrower than 360px).
- **Rail column**: `flex: 1 1 280px; min-width: 280px;` and is itself `display:flex; flex-wrap:wrap; align-content:flex-start; gap:14px;` holding 3 cards each `flex: 1 1 240px; min-width: 240px`.

Behavior:

- **Wide (≈1100px+ workspace)**: list 300 · thread fills · rail 280 as a vertical column on the right (its 240px cards stack one-per-row).
- **Narrow**: rail wraps to a new line below and lays its 3 cards out as a horizontal row; thread keeps ≥360px.

All three panels: white `#fff`, radius `18px` (rail cards `16px`), shadow `0 1px 3px rgba(16,40,70,.06), 0 12px 28px -16px rgba(16,40,70,.2)`, `overflow:hidden` on list/thread.

---

### Component: Conversation list

Container is a vertical flex column.

**Header (padding `14px 14px 10px`):**

- Search field: row, background `#f1f4f8`, radius `11px`, padding `9px 12px`, gap `8px`. Magnifier icon (16px, stroke `#9aa3b0`, width 2). Placeholder text `Search conversations…` at `14px`, color `#9aa3b0`.
- Filter row (margin-top `12px`, gap `8px`):
  - **All** pill (active): background `#0E96D8`, white, `font-size:13px; font-weight:600; padding:5px 14px; radius:999px`.
  - **Unread** label: `#7a8696`, `13px`, weight 600 + a count badge (blue `#0E96D8` circle, white, `11px/700`, min 18px, radius 9px) showing `2`.
  - Refresh icon pushed right (`margin-left:auto`), 16px, stroke `#9aa3b0`.

**Scroll area (`flex:1; overflow-y:auto; padding:4px 8px 10px`):** list of conversation rows.

**Conversation row** (a `<button>`, full width, left aligned, `display:flex; gap:11px; align-items:center; padding:10px 11px; radius:13px; margin-bottom:2px`):

- Background: `#eaf4fd` when selected, otherwise transparent. Hover: `#f3f7fb`.
- Avatar: 42px circle, contact color background, white initials, `font-weight:600; font-size:14px`.
- Body (`flex:1; min-width:0`):
  - Top line: name (`font-weight:600; font-size:14.5px; color:#1c2430`, truncate) + time on the right (`12px`, `#9aa3b0`).
  - Bottom line: preview text (`13px`, `#8a94a3`, truncate) + unread badge if any (blue circle, white, `11px/700`, 18px, radius 9px) showing the count.

**Sample conversations** (id, name, phone, type, time, unread, preview, initials, avatar color):

- `denzel` — Denzel Lavinder · (615) 878-9793 · Prospect · Thu · unread 1 · "Just confirming we're still on for 2?" · DL · `#0E96D8`
- `brittany` — Brittany Cho · (210) 555-0148 · Franchisee · Thu · 0 · "Thank you! That helped a ton." · BC · `#7C5CFC`
- `marcus` — Marcus Webb · (404) 555-0192 · Prospect · Jun 22 · unread 1 · "Sounds good, I'll get those over." · MW · `#1FB6A8`
- `priya` — Priya Nair · (480) 555-0177 · Franchisee · Jun 21 · 0 · "Numbers looked great this month." · PN · `#F5A623`
- `sofia` — Sofia Ramos · (305) 555-0133 · Prospect · Jun 20 · 0 · "Might revisit this in the fall." · SR · `#EB5757`

---

### Component: Conversation thread

Vertical flex column with header / scroll body / composer.

**Header (`padding:14px 18px; border-bottom:1px solid #eef1f5; display:flex; align-items:center; gap:12px`):**

- Avatar: 36px circle, contact color, white initials, `font-weight:600; font-size:13px`.
- Center block (`flex:1; min-width:0`):
  - Row: name (`font-weight:600; font-size:14px; color:#1c2430; white-space:nowrap`) + a **type badge**:
    - Prospect: text `#C77B12`, bg `#FEF3E0`, radius `999px`, `padding:2px 9px`, `font-size:11px`, `font-weight:700`.
    - Franchisee: text `#127D6B`, bg `#E4F6F0`, same shape.
  - Phone line: `font-size:12px; color:#8a94a3; margin-top:1px`.
- Right status: `SMS · Signal House`, `12px`, `#9aa3b0`, preceded by a 7px green dot `#1FB6A8`.

**Message body (`flex:1; overflow-y:auto; padding:14px 20px; background:#fff; display:flex; flex-direction:column`):**

- **Day separator**: centered, `margin:14px 0 8px`, `font-size:11px; font-weight:600; color:#9aa3b0` (e.g. "Thursday 9:41 AM", "Today").
- **Incoming bubble** (left): `max-width:70%; background:#E9E9EB; color:#1c1c1e; padding:7px 12px; border-radius:18px; border-bottom-left-radius:6px; font-size:13px; line-height:1.4; margin:2px 0`.
- **Outgoing bubble** (right): same metrics but `border-bottom-right-radius:6px`, `background: linear-gradient(180deg, #1aa3e6, #0E96D8)`, `color:#fff`. Aligned to the right (`align-items:flex-end`).
- **Delivered receipt**: under the last outgoing bubble, `font-size:11px; color:#9aa3b0; margin-top:3px`, text "Delivered".

**Composer (`padding:12px 16px; border-top:1px solid #eef1f5; display:flex; align-items:center; gap:10px`):**

- "+" attach button: 30px circle, `border:1.5px solid #d5dbe3`, plus icon stroke `#9aa3b0`.
- Text input: `flex:1; border:1.5px solid #e2e7ee; border-radius:999px; padding:9px 15px; font-size:13.5px; color:#1c2430`, placeholder "Text Message".
- Send button: 34px circle, background `#0E96D8`, white up-arrow icon. Click or Enter sends.

**Sample thread for `denzel`** (in = incoming, out = outgoing):

1. (sep) Thursday 9:41 AM
2. in: "Hey, saw your follow-up. Still interested in the North Nashville territory."
3. out: "Awesome, Denzel! It's still open. Did you get a chance to review the FDD I sent over?"
4. in: "Yeah, went through most of it. Had a couple questions on the royalty structure."
5. out: "Totally fair. Want to hop on a quick call? I can walk you through it."
6. in: "That works. Afternoon is better for me."
7. out: "Perfect — sending a calendar invite for 2:00 PM today. Talk then 👍" (delivered)
8. (sep) Today
9. in: "Just confirming we're still on for 2?"

(Other contacts have their own shorter sample threads — see the HTML.)

---

### Component: Work rail

Three stacked cards (Work Queue, Calendar, Tasks). Each card: white, radius `16px`, padding `16px`, shadow as above, `flex:1 1 240px; min-width:240px`.

**Card header pattern**: icon (17px) + title (`font-weight:700; font-size:15px; color:#1c2430`) + right-aligned count (`12px; #9aa3b0`).

**Work Queue** (icon stroke `#0E96D8`, count "2 to clear"):

- Rows separated by `1px solid #f2f4f7`, `padding:8px 0`, gap 10px.
- 8px colored status dot + label (`13.5px/600; #1c2430`) + meta (`12px; #9aa3b0`).
- Items: "Reply to Denzel Lavinder · Unread · 2h ago" (`#0E96D8`); "Reply to Marcus Webb · Unread · 8d ago" (`#1FB6A8`).

**Calendar** (icon stroke `#0E96D8`, count "2 events"):

- Sub-line: "Tuesday, June 30 · from GHL" (`12.5px; #9aa3b0`).
- Each event is an **expandable row** (a `<button>`): left 3px color bar (full height), title (`13.5px/600`), meta line `{time} · {who}` (`12px; #8a94a3`), and a chevron on the right (16px, stroke `#b3bcc8`) that **rotates 180° when open** (`transition: transform .2s`).
- **Expanded detail panel** (only one open at a time): background `#f7f9fc`, radius `11px`, padding `13px 14px`, indented left `13px`, with a short entrance animation (`opacity 0→1 + translateY(-4px→0)`, `.18s`). Contains:
  - Description paragraph (`12.5px; color:#5b6573; line-height:1.45`).
  - Label/value rows (`12px` label `#9aa3b0` left, `12.5px/600` value `#1c2430` right): **Date**, **Time** (`{time} · {duration}`), **Type**, **Assignee**, **Contact**, **Phone**.
  - Action row: **Join** button (filled `#0E96D8`, white) + **Open in GHL** (filled `#eef1f5`, text `#5b6573`), both `12.5px/600; padding:8px 0; radius:9px`, equal width.
- Events:
  - Discovery call · Denzel Lavinder · `#0E96D8` · Tue, Jun 30 · 2:00 PM · 30 min · Zoom call · You · (615) 878-9793 · desc: "Walk through royalty-structure questions and confirm the North Nashville territory before sending the agreement."
  - Coaching session · Brittany Cho · `#7C5CFC` · Tue, Jun 30 · 4:30 PM · 45 min · Phone call · You · (210) 555-0148 · desc: "Review Q2 performance and map out a 2-unit expansion plan for the fall."

**Tasks** (icon stroke `#F5A623`, count "3 pending"):

- Each task is an **expandable row** (`<button>`): 16px square checkbox (`border:1.5px solid #cfd6df; radius:5px`), title (`13.5px/600`), a **priority chip**, and a rotating chevron (same as calendar).
- **Priority chip**: `font-size:10.5px; font-weight:700; radius:999px; padding:2px 8px`.
  - High: text `#D64545`, bg `#FDECEC`
  - Medium: text `#C77B12`, bg `#FEF3E0`
  - Low: text `#127D6B`, bg `#E4F6F0`
- **Expanded detail** (same panel styling as calendar, indented left `26px`): description, then rows **Due**, **Priority** (value colored by priority), **Assignee**, **Contact**, **Phone**; action row **Mark done** (filled `#1FB6A8`, white) + **Open in GHL**.
- Tasks:
  - "Send FDD to Marcus Webb" · Today · High · You · Marcus Webb · (404) 555-0192 · desc: "Email the FDD document with the e-sign link and flag the royalty section for his review."
  - "Follow up with Sofia Ramos" · Today · Medium · You · Sofia Ramos · (305) 555-0133 · desc: "Nurture lead — check her interest level and confirm fall timing for a revisit."
  - "Prep coaching deck — Priya" · Tomorrow · Low · You · Priya Nair · (480) 555-0177 · desc: "Pull this month's numbers into the coaching deck before the scheduled call."

---

## Interactions & Behavior

- **Select conversation**: clicking a list row sets it active (`#eaf4fd` highlight) and loads its thread into the center panel. Default selected: `denzel`.
- **Send message**: typing in the composer and pressing **Enter** (or clicking the send button) appends an outgoing bubble (marked "Delivered") to the active thread and clears the input. Empty/whitespace-only messages are ignored.
- **Expand appointment / task**: clicking a calendar event or task row toggles its detail panel open (chevron rotates 180°, panel animates in). **Only one event and one task can be open at a time** (opening another closes the previous within that list). Clicking the open row again collapses it.
- **Hover**: list rows lighten to `#f3f7fb`.
- **Responsive**: workspace uses flex-wrap; the rail drops below the list+thread when the viewport is too narrow (see layout above). The thread never goes below 360px.

## State Management

Minimum state needed:

- `selectedConversationId` — which thread is active.
- `draft` — current composer text.
- `openEventIndex` — index of expanded calendar event, or null.
- `openTaskIndex` — index of expanded task, or null.
- `threads` — map of conversationId → array of messages (so newly sent messages can be appended).

Data fetching (real app):

- Conversations + messages from **Signal House** (SMS).
- Calendar events + tasks from **GHL**.

## Design Tokens

**Colors**

- Page background: `#eef2f6`
- Card surface: `#ffffff`
- Card gradient bg (frame): `radial-gradient(900px 480px at 50% -8%, #f4faff, #e6f1fb)`
- Brand blue (accent / sent bubble / selected): `#0E96D8`; gradients `linear-gradient(135deg,#1aa6e6,#0a85cf)` (KPI), `linear-gradient(180deg,#1aa3e6,#0E96D8)` (sent bubble)
- Amber (unread pill / tasks icon): `#F5A623`
- Incoming bubble: `#E9E9EB`, text `#1c1c1e`
- Text primary: `#1c2430`; secondary: `#8a94a3`; tertiary/placeholder: `#9aa3b0`; detail body: `#5b6573`
- Avatar palette: `#0E96D8`, `#7C5CFC`, `#1FB6A8`, `#F5A623`, `#EB5757`
- Status green (online/SMS dot): `#1FB6A8`
- Selected row: `#eaf4fd`; hover row: `#f3f7fb`
- Hairline border: `#eef1f5` / `#f2f4f7`; input border: `#e2e7ee`; control border: `#d5dbe3` / `#cfd6df`
- Badge tints — Prospect `#C77B12`/`#FEF3E0`; Franchisee `#127D6B`/`#E4F6F0`
- Priority — High `#D64545`/`#FDECEC`; Medium `#C77B12`/`#FEF3E0`; Low `#127D6B`/`#E4F6F0`
- Detail inset panel: `#f7f9fc`; neutral button: `#eef1f5`

**Typography**

- Font stack: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
- Sizes: KPI value 40/700 · KPI label 16/600 · panel title 15/700 · contact name 14/600 · message 13/400 (line-height 1.4) · list name 14.5/600 · preview & meta 12–13 · badges 11/700 · priority chip 10.5/700

**Radii**: page card 26 · panels 18 · rail cards 16 · row/detail 11–13 · bubbles 18 (one corner 6) · pills/badges 999

**Spacing**: card padding 24 · panel padding 16 · gaps 14–18 · bubble padding 7×12

**Shadows**

- Panel: `0 1px 3px rgba(16,40,70,.06), 0 12px 28px -16px rgba(16,40,70,.2)`
- KPI: `0 12px 26px rgba(13,131,201,.26)`
- Page card: `0 30px 60px -30px rgba(20,60,100,.35)`

**Animation**

- Chevron rotate: `transform .2s`
- Detail expand: `opacity 0→1` + `translateY(-4px→0)` over `.18s ease`

## Assets

- **Icons**: all inline stroke SVGs (search/magnifier, refresh, calendar, clipboard/checklist, plus, send arrow-up, chevron-down). Replace with the codebase's existing icon set (e.g. Lucide / Heroicons) at matching sizes (16–17px) and stroke colors noted above.
- **Avatars**: colored circles with initials (no image assets). Swap for real contact photos when available, falling back to initials.
- No external images or fonts (system font stack).

## Files

- `Messaging Hub v2.dc.html` — the high-fidelity design reference (open in a browser to view/interact). This is the design that was approved.

> Note: the `.dc.html` file uses a custom template runtime (`<sc-for>`, `<sc-if>`, `{{ }}`). Read it for layout/values, but reimplement with the codebase's own component model — do not port the runtime.
