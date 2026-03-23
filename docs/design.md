# NAH Franchise OS — Design System

> This document defines the complete visual design system for the New Again Houses Franchise OS.
> Every color, font size, spacing unit, component, and layout rule is documented here.
> The app is dark mode by default. There is no light mode.

---

## 1. Design Philosophy

- **Dark mode only** — reduces eye strain for reps who live in this app all day
- **Data-dense but not cluttered** — show the information that matters, hide what doesn't
- **Scout is the star** — the AI interface should feel alive, distinct, and premium
- **Speed over decoration** — every element exists to help reps move faster
- **Accessible** — meets WCAG 2.1 AA standards for contrast, focus states, and screen readers

---

## 2. Color Palette

### Primary Colors

| Name | Hex | Usage |
|------|-----|-------|
| **NAH Orange** | `#E8431A` | Primary brand color. CTAs, primary buttons, active nav items, key highlights |
| **Scout Purple** | `#7C3AED` | Scout-specific UI. Chat bubbles (Scout side), Scout status indicators, AI accent |

### Background Colors

| Name | Hex | Usage |
|------|-----|-------|
| **bg-primary** | `#0F0F0F` | Main app background |
| **bg-secondary** | `#1A1A1A` | Card backgrounds, sidebar background |
| **bg-tertiary** | `#262626` | Elevated surfaces, modals, dropdowns |
| **bg-hover** | `#333333` | Hover state for interactive surfaces |
| **bg-active** | `#404040` | Active/pressed state for interactive surfaces |

### Text Colors

| Name | Hex | Usage |
|------|-----|-------|
| **text-primary** | `#F5F5F5` | Primary text — headings, body copy, labels |
| **text-secondary** | `#A3A3A3` | Secondary text — descriptions, timestamps, helper text |
| **text-tertiary** | `#737373` | Disabled text, placeholder text |
| **text-inverse** | `#0F0F0F` | Text on light/colored backgrounds (e.g., inside orange buttons) |

### Semantic Colors

| Name | Hex | Usage |
|------|-----|-------|
| **success** | `#22C55E` | Won deals, completed tasks, positive metrics |
| **warning** | `#F59E0B` | Approaching deadlines, medium-severity alerts |
| **danger** | `#EF4444` | Overdue items, high/critical alerts, destructive actions |
| **info** | `#3B82F6` | Informational badges, neutral status indicators |

### Border Colors

| Name | Hex | Usage |
|------|-----|-------|
| **border-default** | `#2A2A2A` | Default borders on cards, inputs, dividers |
| **border-hover** | `#404040` | Border hover states |
| **border-focus** | `#E8431A` | Focus ring on inputs and interactive elements |

### Scout-Specific Colors

| Name | Hex | Usage |
|------|-----|-------|
| **scout-bubble-bg** | `#7C3AED1A` | Scout's chat bubble background (purple at 10% opacity) |
| **scout-bubble-border** | `#7C3AED33` | Scout's chat bubble border (purple at 20% opacity) |
| **scout-thinking** | `#7C3AED` | Scout "thinking" animation dots |
| **scout-action-bg** | `#7C3AED0D` | Background for Scout's drafted action cards (purple at 5% opacity) |
| **user-bubble-bg** | `#262626` | User's chat bubble background |

---

## 3. Typography

**Font Family:** `Inter` (Google Fonts)

- **Fallback stack:** `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
- **Monospace (for data/code):** `'JetBrains Mono', 'Fira Code', 'Courier New', monospace`

### Type Scale

| Name | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| **display** | 32px / 2rem | 700 (Bold) | 1.2 | Page titles (Scout AI, Daily HQ) |
| **h1** | 24px / 1.5rem | 700 (Bold) | 1.3 | Section headings |
| **h2** | 20px / 1.25rem | 600 (Semibold) | 1.35 | Card titles, subsection headings |
| **h3** | 16px / 1rem | 600 (Semibold) | 1.4 | Sub-headings within cards |
| **body-lg** | 16px / 1rem | 400 (Regular) | 1.5 | Scout chat messages, primary body text |
| **body** | 14px / 0.875rem | 400 (Regular) | 1.5 | Standard body text, table cells, form labels |
| **body-sm** | 13px / 0.8125rem | 400 (Regular) | 1.5 | Secondary information, helper text |
| **caption** | 12px / 0.75rem | 400 (Regular) | 1.4 | Timestamps, metadata, badge labels |
| **overline** | 11px / 0.6875rem | 600 (Semibold) | 1.4 | Overline labels, category tags (UPPERCASE + letter-spacing 0.05em) |

---

## 4. Spacing System

**Base unit:** `4px`

All spacing uses multiples of the 4px base unit.

| Token | Value | Usage |
|-------|-------|-------|
| `space-0` | 0px | No spacing |
| `space-1` | 4px | Tight gaps — between icon and label, inline badge padding |
| `space-2` | 8px | Small gaps — between related items, input padding vertical |
| `space-3` | 12px | Medium-small gaps — card padding vertical, list item spacing |
| `space-4` | 16px | Default gap — card padding horizontal, section spacing |
| `space-5` | 20px | Medium gaps — between cards in a grid |
| `space-6` | 24px | Large gaps — between page sections |
| `space-8` | 32px | XL gaps — page top/bottom padding, major section breaks |
| `space-10` | 40px | 2XL gaps — sidebar width padding, dashboard section breaks |
| `space-12` | 48px | Page margin on large screens |
| `space-16` | 64px | Sidebar width, major layout spacing |

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `radius-sm` | 4px | Small elements — badges, chips |
| `radius-md` | 8px | Default — cards, inputs, buttons |
| `radius-lg` | 12px | Larger cards, modals |
| `radius-xl` | 16px | Chat bubbles, prominent cards |
| `radius-full` | 9999px | Circular elements — avatars, dot indicators |

---

## 5. App Shell Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  Top Bar (56px height)                                            │
│  ┌──────┬────────────────────────────────────┬─────────────────┐ │
│  │ Logo │  Page Title                        │  User Avatar ▼  │ │
│  └──────┴────────────────────────────────────┴─────────────────┘ │
├──────────┬───────────────────────────────────────────────────────┤
│          │                                                       │
│ Sidebar  │  Main Content Area                                    │
│ (240px)  │                                                       │
│          │  - Scrollable                                         │
│ ┌──────┐ │  - Max-width: 1280px (centered on wide screens)      │
│ │Scout │ │  - Padding: 24px (desktop) / 16px (mobile)           │
│ │ AI   │ │                                                       │
│ ├──────┤ │                                                       │
│ │Daily │ │                                                       │
│ │ HQ   │ │                                                       │
│ ├──────┤ │                                                       │
│ │Pipe- │ │                                                       │
│ │line  │ │                                                       │
│ ├──────┤ │                                                       │
│ │Leads │ │                                                       │
│ ├──────┤ │                                                       │
│ │Dash- │ │                                                       │
│ │board │ │                                                       │
│ ├──────┤ │                                                       │
│ │Know- │ │                                                       │
│ │ledge │ │                                                       │
│ ├──────┤ │                                                       │
│ │Sett- │ │                                                       │
│ │ings  │ │                                                       │
│ └──────┘ │                                                       │
│          │                                                       │
└──────────┴───────────────────────────────────────────────────────┘
```

### Layout Rules

- **Sidebar:** Fixed left, 240px wide on desktop. Collapsible to 64px (icons only). Hidden on mobile with hamburger toggle.
- **Top Bar:** Fixed top, 56px height. Contains logo (left), page title (center), user menu (right).
- **Main Content:** Fills remaining space. Scrollable. Max-width 1280px centered on screens wider than 1440px.
- **Mobile breakpoint:** Below 768px, sidebar becomes a slide-out drawer.
- **Tablet breakpoint:** 768px–1024px, sidebar collapses to icon-only mode.

### Sidebar Navigation Items

| Item | Icon | Visible To |
|------|------|-----------|
| Scout AI | MessageSquare | All roles |
| Daily HQ | LayoutDashboard | Rep, Leadership |
| Pipeline | Kanban | Rep, Leadership |
| Leads | Users | Rep, Leadership |
| Dashboard | BarChart3 | Leadership only |
| Knowledge | BookOpen | Leadership only |
| Settings | Settings | All roles (limited by role) |

---

## 6. Page Wireframes

### Scout AI Page

```
┌──────────────────────────────────────────────────────────┐
│  Scout AI                                        [?] [...] │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Session Start — Today, 9:14 AM                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│                          ┌────────────────────────────┐  │
│                          │  User message bubble       │  │
│                          │  "What should I focus on   │  │
│                          │   today?"                  │  │
│                          └────────────────────────────┘  │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  ● Scout                                            │ │
│  │                                                     │ │
│  │  Good morning! Here's your priority list for today: │ │
│  │                                                     │ │
│  │  1. 🔴 Call back James Miller — he's been in       │ │
│  │     Attempted Contact for 5 days with only 3       │ │
│  │     attempts. Needs 3 more before the 7-day mark.  │ │
│  │                                                     │ │
│  │  2. 🟡 Discovery call with Sarah Chen at 2:00 PM.  │ │
│  │     Here's your pre-call prep...                    │ │
│  │                                                     │ │
│  │  3. 🟢 Follow up with David Kim — FDD window       │ │
│  │     closes tomorrow. He's been engaged.             │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  📋 DRAFTED ACTION                                  │ │
│  │  ─────────────────────────────────────────────────  │ │
│  │  Type: SMS to James Miller                         │ │
│  │  Content: "Hey James, it's [Rep] from New Again    │ │
│  │  Houses. Wanted to follow up on the franchise      │ │
│  │  opportunity — do you have 5 min today?"           │ │
│  │                                                     │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐         │ │
│  │  │  ✎ Edit  │  │ ✓ Send   │  │ ✕ Cancel │         │ │
│  │  └──────────┘  └──────────┘  └──────────┘         │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌──────────────────────────────────────┬─────┬───────┐ │
│  │  Ask Scout anything...               │ 🎤  │  ➤   │ │
│  └──────────────────────────────────────┴─────┴───────┘ │
└──────────────────────────────────────────────────────────┘
```

#### Scout Page Components

- **Chat area:** Scrollable, newest messages at the bottom. Auto-scrolls on new messages.
- **Scout bubbles:** Left-aligned, purple-tinted background, Scout avatar icon.
- **User bubbles:** Right-aligned, neutral dark background.
- **Drafted action card:** Distinct from chat bubbles. Elevated card with purple-tinted border. Contains action type, content preview, and Edit/Send/Cancel buttons.
- **Input bar:** Fixed to bottom. Text input with voice button (mic icon) and send button. Voice recording shows a waveform animation.
- **Thinking indicator:** When Scout is processing, show animated purple dots ("Scout is thinking...").
- **Session dividers:** Horizontal line with date/time when a new session starts.

---

### Daily HQ Page

```
┌──────────────────────────────────────────────────────────┐
│  Daily HQ — Tuesday, March 23                    [Rep ▼] │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │  REP SCORECARD — TODAY                           │    │
│  │                                                  │    │
│  │  Calls: 7    Texts: 12    Emails: 3              │    │
│  │  Stage Moves: 2    New Leads Contacted: 4        │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────┐  ┌────────────────────────┐  │
│  │  🔴 ALERTS (3)         │  │  📋 TODAY'S TASKS (8)  │  │
│  │  ──────────────────    │  │  ──────────────────    │  │
│  │                        │  │                        │  │
│  │  • Speed-to-lead:     │  │  ☐ Call James Miller   │  │
│  │    New lead 12 min    │  │  ☐ Call Lisa Wong      │  │
│  │    ago — not contacted │  │  ☐ Send FDD follow-up │  │
│  │                        │  │    to David Kim        │  │
│  │  • Stale in Attempted │  │  ☑ Confirm discovery   │  │
│  │    Contact: 2 leads   │  │    call — Sarah Chen   │  │
│  │    approaching 7 days  │  │  ☐ Log call notes —   │  │
│  │                        │  │    Mike Johnson        │  │
│  │  • Closing stall:     │  │  ☐ Send validation     │  │
│  │    No update on Tom    │  │    materials — Amy Lee │  │
│  │    Garcia in 4 days   │  │  ☐ Re-engage nurture   │  │
│  │                        │  │    lead: Pat Brown     │  │
│  │                        │  │  ☐ Update closing      │  │
│  │                        │  │    checklist — Tom G   │  │
│  └────────────────────────┘  └────────────────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │  PIPELINE SNAPSHOT                                │    │
│  │                                                  │    │
│  │  New Lead        ████░░░░░░  3                   │    │
│  │  Attempted       ██████░░░░  5                   │    │
│  │  Connected       ████░░░░░░  3                   │    │
│  │  Disc. Sched.    ██░░░░░░░░  2                   │    │
│  │  Disc. Complete  ██░░░░░░░░  1                   │    │
│  │  Validation      ████░░░░░░  3                   │    │
│  │  FDD Sent        ██░░░░░░░░  2                   │    │
│  │  In Closing      █░░░░░░░░░  1                   │    │
│  │                                                  │    │
│  │  Total Active: 20    Won This Month: 1           │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │  UPCOMING (Next 48 Hours)                         │    │
│  │                                                  │    │
│  │  Today 2:00 PM — Discovery Call: Sarah Chen      │    │
│  │  Today 4:30 PM — Check-in Call: David Kim (FDD)  │    │
│  │  Tomorrow 10:00 AM — Follow-up: Lisa Wong        │    │
│  └──────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

#### Daily HQ Layout Rules

- **Grid layout:** 2 columns on desktop, single column on mobile.
- **Scorecard:** Full width, always at the top. Quick visual summary of today's activity.
- **Alerts and Tasks:** Side by side on desktop. Alerts on the left (red accent), tasks on the right.
- **Pipeline Snapshot:** Full width. Horizontal bar chart showing lead count per stage.
- **Upcoming:** Full width at the bottom. Time-ordered list of scheduled calls and follow-ups.
- **Leadership view:** When leadership selects "All Reps" from the dropdown, the view aggregates across all reps and adds a rep comparison section.

---

### Pipeline Board (Phase 2)

```
┌──────────────────────────────────────────────────────────────────────┐
│  Pipeline Board                                     [Filter ▼] [🔍] │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  New Lead    │ Attempted  │ Connected │ Disc Sched │ Disc Done │ ... │
│  (3)         │ (5)        │ (3)       │ (2)        │ (1)       │     │
│  ──────────  │ ────────── │ ───────── │ ────────── │ ───────── │     │
│  ┌────────┐  │ ┌────────┐ │ ┌───────┐ │ ┌────────┐ │ ┌───────┐ │     │
│  │J.Miller│  │ │L.Wong  │ │ │S.Chen │ │ │T.Davis │ │ │A.Lee  │ │     │
│  │Score:62│  │ │Score:45│ │ │Scr:78 │ │ │Scr:81  │ │ │Scr:72 │ │     │
│  │🔴 12m  │  │ │🟡 Day5 │ │ │🟢     │ │ │🟢 Tmrw│ │ │🟡     │ │     │
│  └────────┘  │ └────────┘ │ └───────┘ │ └────────┘ │ └───────┘ │     │
│  ┌────────┐  │ ┌────────┐ │ ┌───────┐ │ ┌────────┐ │           │     │
│  │B.Adams │  │ │M.Park  │ │ │R.Hill │ │ │P.Scott │ │           │     │
│  │Score:55│  │ │Score:38│ │ │Scr:64 │ │ │Scr:85  │ │           │     │
│  │🟢      │  │ │🔴 Day6 │ │ │🟢     │ │ │🟢 Fri  │ │           │     │
│  └────────┘  │ └────────┘ │ └───────┘ │ └────────┘ │           │     │
│              │            │           │            │           │     │
└──────────────┴────────────┴───────────┴────────────┴───────────┴─────┘
```

#### Pipeline Board Rules

- **Horizontal scroll:** Stages scroll horizontally. Each stage is a column.
- **Lead cards:** Draggable between adjacent stages (with validation). Show name, score, and alert status.
- **Alert indicators:** Red dot = critical/overdue, yellow dot = warning, green dot = on track.
- **Drag-and-drop:** Dragging a card to a new stage triggers the Draft → Review → Confirm flow via Scout.
- **Filters:** Filter by rep, score tier, alert status, or lead source.

---

### Lead Profile (Phase 2)

```
┌──────────────────────────────────────────────────────────┐
│  ← Back to Pipeline                                       │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────┐  James Miller              Score: 62 🟡    │
│  │  Avatar  │  james.miller@email.com                    │
│  │          │  (555) 234-5678                            │
│  └──────────┘  Austin, TX                                │
│                Stage: Attempted Contact (Day 5)          │
│                Source: Google Ads                         │
│                Assigned to: Rep Name                      │
│                                                          │
│  ┌─────────┬──────────┬──────────┬─────────────────────┐ │
│  │ Summary │ Timeline │ Activity │ Scout Actions       │ │
│  └─────────┴──────────┴──────────┴─────────────────────┘ │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │  QUALIFICATION SUMMARY                            │    │
│  │                                                  │    │
│  │  Interest Level: High                            │    │
│  │  Capital Awareness: Aware, exploring financing   │    │
│  │  Territory: Austin, TX (Available)               │    │
│  │  Timeline: Within 60 days                        │    │
│  │  Experience: Prior business ownership             │    │
│  │  Key Notes: Owns two rental properties...        │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │  SCORE BREAKDOWN                                  │    │
│  │                                                  │    │
│  │  Source Quality     ███████████░░░░ 10/20         │    │
│  │  Capital            ███████████░░░░ 10/20         │    │
│  │  Territory          ██████████████  15/15         │    │
│  │  Engagement         █████████░░░░░  8/15          │    │
│  │  Experience         ████████████░░ 12/15          │    │
│  │  Timeline           █████████░░░░░  7/15          │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────┐ │
│  │ 📞 Call    │  │ 💬 Text    │  │ 📧 Email           │ │
│  └────────────┘  └────────────┘  └────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

---

### Leadership Dashboard (Phase 2)

```
┌──────────────────────────────────────────────────────────┐
│  Leadership Dashboard                  [This Month ▼]     │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌───────┐ │
│  │  Active     │ │  Won This  │ │  Avg Days  │ │  Conv │ │
│  │  Leads      │ │  Month     │ │  to Close  │ │  Rate │ │
│  │             │ │            │ │            │ │       │ │
│  │    47       │ │     3      │ │    42      │ │  6.4% │ │
│  │  ▲ +5       │ │  ▲ +1      │ │  ▼ -3     │ │  ▲+1% │ │
│  └────────────┘ └────────────┘ └────────────┘ └───────┘ │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │  PIPELINE FUNNEL                                  │    │
│  │                                                  │    │
│  │  New Lead         ████████████████████  18        │    │
│  │  Attempted        ██████████████░░░░░  12        │    │
│  │  Connected        ████████░░░░░░░░░░   7        │    │
│  │  Disc Scheduled   █████░░░░░░░░░░░░░   4        │    │
│  │  Disc Complete    ████░░░░░░░░░░░░░░   3        │    │
│  │  Validation       ███░░░░░░░░░░░░░░░   2        │    │
│  │  FDD Sent         ██░░░░░░░░░░░░░░░░   1        │    │
│  │  In Closing       █░░░░░░░░░░░░░░░░░   0        │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │  REP LEADERBOARD                                  │    │
│  │                                                  │    │
│  │  Rep Name       Leads  Calls  Moves  Won  Score │    │
│  │  ───────────────────────────────────────────────  │    │
│  │  Sarah Johnson    15     34     8     2    92    │    │
│  │  Mike Rodriguez   12     28     6     1    85    │    │
│  │  Alex Kim          8     19     3     0    71    │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─────────────────────┐ ┌──────────────────────────┐    │
│  │  LEAD SOURCE ROI    │ │  ACTIVE ALERTS            │    │
│  │                     │ │                          │    │
│  │  Source    Leads Won│ │  🔴 Critical: 2           │    │
│  │  Referral   5    2  │ │  🟡 Warning: 5            │    │
│  │  Organic    8    1  │ │  🔵 Info: 3               │    │
│  │  Google    12    0  │ │                          │    │
│  │  Social    18    0  │ │  [View All →]             │    │
│  └─────────────────────┘ └──────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

---

## 7. Component Library

### Buttons

| Variant | Background | Text | Border | Usage |
|---------|-----------|------|--------|-------|
| **Primary** | `#E8431A` | `#0F0F0F` | none | Primary CTAs — "Send", "Confirm", "Save" |
| **Secondary** | transparent | `#F5F5F5` | `#2A2A2A` | Secondary actions — "Edit", "Cancel", "Back" |
| **Ghost** | transparent | `#A3A3A3` | none | Tertiary actions — "Skip", "Dismiss" |
| **Danger** | `#EF4444` | `#F5F5F5` | none | Destructive actions — "Delete", "Remove" |
| **Scout** | `#7C3AED` | `#F5F5F5` | none | Scout-specific actions — "Ask Scout", "Send to Scout" |

**Button sizes:**
- **sm:** height 32px, padding 8px 12px, font 13px
- **md:** height 40px, padding 10px 16px, font 14px (default)
- **lg:** height 48px, padding 12px 24px, font 16px

**Button states:**
- Default → Hover (lighten 10%) → Active (darken 5%) → Disabled (opacity 0.4, cursor not-allowed)
- Focus: 2px ring in `border-focus` color with 2px offset

### Cards

```
┌─────────────────────────────────────┐
│  Card Title                    [⋮]  │  ← Header (optional)
│─────────────────────────────────────│  ← Divider (optional)
│                                     │
│  Card content goes here.            │  ← Body
│  Can contain any elements.          │
│                                     │
│─────────────────────────────────────│  ← Divider (optional)
│  Footer actions                     │  ← Footer (optional)
└─────────────────────────────────────┘
```

- Background: `bg-secondary` (`#1A1A1A`)
- Border: 1px solid `border-default` (`#2A2A2A`)
- Border-radius: `radius-lg` (12px)
- Padding: 16px
- Hover state (if interactive): border changes to `border-hover`

### Badges / Status Chips

| Type | Background | Text | Usage |
|------|-----------|------|-------|
| **Pipeline Stage** | `#262626` | `#F5F5F5` | Shows which stage a lead is in |
| **Score — Hot** | `#EF44441A` | `#EF4444` | Lead score 80–100 |
| **Score — Warm** | `#F59E0B1A` | `#F59E0B` | Lead score 60–79 |
| **Score — Cool** | `#3B82F61A` | `#3B82F6` | Lead score 40–59 |
| **Score — Cold** | `#7373731A` | `#737373` | Lead score below 40 |
| **Alert — Critical** | `#EF44441A` | `#EF4444` | Critical severity alert |
| **Alert — Warning** | `#F59E0B1A` | `#F59E0B` | Warning severity alert |
| **Alert — Info** | `#3B82F61A` | `#3B82F6` | Informational alert |
| **Role** | `#7C3AED1A` | `#7C3AED` | User role badge |

- Border-radius: `radius-sm` (4px)
- Padding: 2px 8px
- Font: `caption` (12px, 400)

### Form Inputs

- Background: `bg-secondary` (`#1A1A1A`)
- Border: 1px solid `border-default` (`#2A2A2A`)
- Border-radius: `radius-md` (8px)
- Height: 40px (single-line), auto (textarea)
- Padding: 10px 12px
- Text: `text-primary`
- Placeholder: `text-tertiary`
- Focus: border changes to `border-focus` (`#E8431A`), subtle glow `0 0 0 2px #E8431A33`
- Error: border changes to `danger` (`#EF4444`), error message below in `danger` color

### Tables

- Header row: background `bg-tertiary` (`#262626`), text `text-secondary`, font `overline`
- Body rows: background `bg-secondary` (`#1A1A1A`), text `text-primary`, font `body`
- Row hover: background `bg-hover` (`#333333`)
- Row border: 1px solid `border-default` (`#2A2A2A`) between rows
- Cell padding: 12px 16px

### Scout UI Components

#### Scout Chat Bubble

```
┌─ ● ──────────────────────────────────────┐
│  Scout's response text goes here.         │
│  Can include formatted text, lists,       │
│  and inline data.                         │
└───────────────────────────────────────────┘
```

- Background: `scout-bubble-bg` (`#7C3AED1A`)
- Border: 1px solid `scout-bubble-border` (`#7C3AED33`)
- Border-radius: `radius-xl` (16px) with top-left at `radius-sm` (4px)
- Padding: 12px 16px
- Scout avatar: 24px circle with purple background and Scout icon, positioned top-left

#### User Chat Bubble

- Background: `user-bubble-bg` (`#262626`)
- Border: none
- Border-radius: `radius-xl` (16px) with top-right at `radius-sm` (4px)
- Padding: 12px 16px
- Aligned to the right side of the chat area

#### Scout Action Card (Draft)

```
┌──────────────────────────────────────────┐
│  📋  DRAFTED ACTION                       │
│  ─────────────────────────────────────── │
│  Type: [SMS / Email / Task / Stage Move] │
│  To: [Contact Name]                      │
│                                          │
│  [Content preview]                       │
│                                          │
│  ┌────────┐  ┌──────────┐  ┌──────────┐ │
│  │ ✎ Edit │  │ ✓ Confirm│  │ ✕ Cancel │ │
│  └────────┘  └──────────┘  └──────────┘ │
└──────────────────────────────────────────┘
```

- Background: `scout-action-bg` (`#7C3AED0D`)
- Border: 1px solid `scout-bubble-border` (`#7C3AED33`)
- Border-radius: `radius-lg` (12px)
- Padding: 16px
- Edit button: Secondary variant
- Confirm button: Primary variant (orange)
- Cancel button: Ghost variant

#### Scout Thinking Indicator

Three animated dots in `scout-thinking` color (`#7C3AED`) that pulse in sequence:

```
● ● ●   Scout is thinking...
```

- Animation: Each dot fades from 0.3 → 1.0 → 0.3 opacity with 0.2s delay between each
- Duration: 1.4s per cycle, infinite loop
- Text: `text-secondary`, italic

#### Voice Input Indicator

When the user is recording voice:

```
┌──────────────────────────────────────┬─────┬───────┐
│  ████░████░██████░███░█████          │ 🔴  │ Done  │
└──────────────────────────────────────┴─────┴───────┘
```

- Waveform: animated bars in `#E8431A` (NAH Orange)
- Recording dot: pulsing red circle
- "Done" button replaces the send button during recording

---

## 8. Motion & Animation Rules

| Element | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| **Page transitions** | Fade in | 200ms | ease-out |
| **Card hover** | Subtle lift (translateY -2px) + border color change | 150ms | ease-out |
| **Button hover** | Background color shift | 100ms | ease-in-out |
| **Modal open** | Fade in + scale from 0.95 | 200ms | ease-out |
| **Modal close** | Fade out + scale to 0.95 | 150ms | ease-in |
| **Scout thinking** | Dot pulse (opacity 0.3 → 1.0) | 1.4s loop | ease-in-out |
| **New chat message** | Slide up + fade in | 250ms | ease-out |
| **Sidebar collapse** | Width transition 240px → 64px | 200ms | ease-in-out |
| **Alert badge** | Pulse ring animation | 2s loop | ease-in-out |
| **Toast notification** | Slide in from right + fade | 300ms in, 200ms out | ease-out |
| **Drag-and-drop card** | Lift (scale 1.02, shadow increase) | 150ms | ease-out |

### Motion Principles

1. **Fast and functional** — animations exist to provide feedback, not decoration. Keep them under 300ms.
2. **No motion on data load** — data appears instantly. No skeleton loaders that animate forever.
3. **Respect prefers-reduced-motion** — if the user's OS setting requests reduced motion, disable all non-essential animations. Keep only focus rings and opacity transitions.

---

## 9. Accessibility Requirements

### WCAG 2.1 AA Compliance

| Requirement | Implementation |
|-------------|---------------|
| **Color contrast** | All text meets 4.5:1 minimum contrast ratio against its background. Large text (18px+ or 14px bold) meets 3:1. Verified against the dark background palette. |
| **Focus indicators** | All interactive elements have a visible focus ring (2px solid `#E8431A` with 2px offset). Focus is never hidden. |
| **Keyboard navigation** | All features are accessible via keyboard. Tab order follows visual order. Escape closes modals and dropdowns. Arrow keys navigate within menus and kanban columns. |
| **Screen reader support** | All images have alt text. All icons have aria-labels. Live regions (`aria-live`) announce Scout responses and alert changes. Chat messages are announced as they arrive. |
| **Form accessibility** | All inputs have associated labels (visible or aria-label). Error messages are linked to inputs via `aria-describedby`. Required fields are marked with `aria-required`. |
| **Touch targets** | All clickable elements are at minimum 44x44px on mobile. |
| **Skip navigation** | A "Skip to main content" link is the first focusable element on every page. |
| **Semantic HTML** | Use proper heading hierarchy (h1 → h2 → h3). Use landmark roles (nav, main, aside). Use lists for lists. Use tables for tabular data. |
| **Color is not the only indicator** | Alerts use icons and text in addition to color. Score tiers use labels in addition to color coding. Pipeline stages use position and text in addition to column color. |

### Accessible Scout Chat

- Each Scout message is wrapped in an `article` element with `role="log"` on the container
- New messages trigger `aria-live="polite"` announcements
- Drafted actions have `role="alertdialog"` with clear labels for Edit, Confirm, and Cancel buttons
- Voice recording button announces state changes: "Recording started", "Recording stopped"
- Thinking indicator announces "Scout is thinking" and "Scout has responded"
