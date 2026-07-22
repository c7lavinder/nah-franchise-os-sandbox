# Claude Code Prompt — Unified Calls Page

The approved mock is `Calls Options.dc.html`, **option 1a** (the first section, id="1a") — copy that file into the repo as the visual source of truth. Options 1b/1c in the same file are rejected explorations; ignore them.

---

## Context

We are replacing two existing calls pages with ONE unified Calls page:

- **MasterSuite calls page** (franchisee-facing): flat list, status tabs (Completed/Pending/Skipped/Failed), search, rep + time filters, AI summaries, letter-grade chips.
- **Frandev calls page** (internal): calls grouped into panels by call type, drag-and-drop between panels to retype, KPI cards, "Drop New Call Here" upload zone.

The unified page uses the frandev **panel-per-call-type** layout with MasterSuite's grading and status model. It ships to both apps: **which panels appear is driven by permissions/user type** (internal users see sales/coaching panels; franchisee users see acquisition panels). Same component, different panel config.

Match the existing app's stack and conventions (same as the Property page). The visual language is the same MasterSuite token set already used on the record pages (Nunito Sans; bg `#eef1f6`; white panels, `1px solid #dde4ef`, radius 8, shadow `0 1px 2px rgba(27,42,74,.06)`; text `#26324b`/`#5a6b88`/`#8494ad`/`#98a6bf`; blue `#1e88e5`).

## Layout (top to bottom)

```
┌────────────┬──────────────────────────────────┬─────────────────┐
│ Calls      │  ⇪ Drop New Call Here            │ This Week /     │
│ header +   │  (full-width dashed dropzone)    │ This Month / All│
│ stats      │                                  │ range chips     │
├────────────┴──────────────────────────────────┴─────────────────┤
│ status chips: ✓Completed ⏱Pending ⊘Skipped ⚠Failed  + hint text │
│ [Failed selected → red "FAILED TO TRANSCRIBE" tray expands]      │
├──────────────────────────────────────┬───────────────────────────┤
│ call-type panels (2-col grid,        │ 📅 UPCOMING rail (290px)  │
│ permission-driven set)               │ scheduled calls           │
└──────────────────────────────────────┴───────────────────────────┘
```

### Header row

- **Left card**: "Calls" (17px/900) + stat line "1,737 graded · 12 this week · 63 avg score" (11px muted).
- **Center**: full-width drop zone — white, `2px dashed #c4cddc`, radius 8: "⇪ Drop New Call Here — recording, transcript, or paste — AI handles the rest". Wire to the existing call-ingest endpoint; accept audio files, transcript files, and pasted text. Keep prominent.
- **Right card**: range chips This Week / This Month / All (selected = solid blue pill).

### Status chip row (under header)

- Chips with counts: `✓ Completed 1,737` · `🕐 Pending 0` · `⊘ Skipped 15.8k` · `⚠ Failed 64`. Selected chip = blue tint (`#e3f0fc`/`#1e88e5`/border `#9ec3f2`); selected **Failed** = red tint (`#fdecec`/`#d64545`/border `#f5d4d4`). Unselected = white/#5a6b88.
- Muted hint text after the chips: "Failed calls need re-upload or manual transcript · panels below show the selected status".
- Selecting a status re-filters the panel grid. Selecting **Failed** ALSO expands a tray above the panels: white card, red-tinted header "⚠ FAILED TO TRANSCRIBE (64)", rows = caller + meta + failure reason (`No audio detected`, `Transcription timed out`) + `↻ Retry` and `⇪ Re-upload` outline buttons. Retry re-queues transcription; Re-upload opens the drop zone flow for that call.

### Call-type panels (main grid, 2 columns)

One white panel per call type. Panel header: colored type dot + panel name + count pill + right-aligned muted hint "drop calls here to retype".

**Panel set is config, not markup** — `{key, name, color, audience[]}` — resolved by the user's permissions/user type:

- Franchisee (acquisitions): Offer Calls `#6b46c1`, Qualification Calls `#1e88e5`, Dispo Calls `#f0a12c`, Purchase Agreement, Admin, Cold/Follow-Up… (extend freely; more types coming e.g. project management, construction)
- Internal (sales/coaching): Intro, Coaching `#c2447d`, Onboarding, Team, Group Calls…

**Call row** inside a panel: `⋮⋮` drag handle (grab cursor, hover bg `#f6f8fc`) · name (12.5px/800) + **outcome pill** · meta line "Yesterday 9:26 AM CT · 1:59 · Chris Segura" (time zone always shown) · right: **grade chip** — 30px rounded square, letter + tiny numeric score, colored A green `#e5f3e8/#2e7d43`, B light-green, C amber `#fdf3e3/#c07f16`, D/F red `#fdecec/#d64545`.

**Outcome pills** (NOT "Graded"/"Needs Review" — those are dead): short call-outcome labels colored by sentiment — green ok (Open to Offer, Deal Accepted, Action Items Set), amber follow-up (Call Back Later, Follow Up Scheduled, Wants Comps, Needs Follow Up), red negative (Not Interested, No Contact). Outcome comes from the AI grading pipeline; make the vocabulary a config list per call type.

**Drag-and-drop retype**: dragging a row from one panel and dropping on another updates the call's `type` (PATCH the call record) and re-files it. Show a drop-target highlight on the panel during drag. This is the existing frandev behavior — keep it.

Clicking a row opens the existing call-detail view (transcript, grade breakdown).

### Upcoming rail (right, 290px)

- Header "📅 UPCOMING" + count pill + "＋ Schedule" link.
- Row per scheduled call: name + blue type pill, when ("Today · 3:30 PM CT"), muted note line.
- Footer explainer: "When a scheduled call happens, its recording lands in the matching panel automatically." Wire that: match completed recordings to scheduled entries (by contact + time window) and auto-type them from the scheduled type.
- Source scheduled calls from the existing appointments/calendar data.

## Wiring notes

- Reuse the existing calls API the MasterSuite list uses (statuses, grades, AI summaries, reps, timestamps) — this is a re-layout, not a new data model. New fields needed: `call_type` (writable, for drag retype) and `outcome_label`.
- Counts on status chips and panel headers come from the filtered query, live.
- Range chips (This Week/Month/All) filter panels AND recompute header stats.
- Search/rep/time filters from the old list page should remain available — fold them into a compact filter row if present in the current stack (not in the mock; keep it minimal).
- Permission config decides panel set per user type on the server side; the page renders whatever panel list it's given.
- All times display with time zone abbreviation (CT etc.) per the territory's zone.
- Floating Scout/Chiron assistant button overlays bottom-right, same as record pages.

## Acceptance

- [ ] One page, panel set driven by permission/user-type config
- [ ] Status chips filter panels; Failed expands the retry/re-upload tray
- [ ] Drag a call between panels → type updates and persists
- [ ] Outcome pills + grade chips on every completed call; no "Needs Review"/"Graded" labels
- [ ] Upcoming rail shows scheduled calls; completed recordings auto-file into panels
- [ ] Drop zone ingests recordings/transcripts/paste
- [ ] Side-by-side with mock 1a: no visual drift at 1440px
