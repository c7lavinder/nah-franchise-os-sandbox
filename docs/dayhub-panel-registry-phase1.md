# Day Hub Panel Registry — Phase 1 Scope

> Scope document for the first phase of the Gunner/FranDev consolidation: carve the
> Gunner Day Hub into registry-driven panels. Written 2026-07-21 for walkthrough with Ben.
> Companion context: `docs/mastersuite-data-audit.md`, MasterSuite repo `Pages/Gunner/DayHub.cshtml`.

---

## 1. What we're doing, in one paragraph

Today the Gunner Day Hub is one hand-built page (~1,400 lines) hardwired to a single
operator: its queries filter on referral partner "Corey Lavinder" and the territory slug
`NASHC` is a constant in the code. We are turning it into a **panel system**: each card
becomes a self-contained partial with its own data loader, and a database registry decides —
per user — which cards render, in which slot, in what order. User type + permissions pick
the cards; the **existing territory selector (unchanged)** picks whose data fills them;
internal users with `AccessAllTerritories` get "view as a territory" for free. Phase 1
delivers the framework plus a pixel-identical Gunner Day Hub. New cards (FranDev, owner,
employee) come in Phase 2 as registry rows behind beta flags.

**Non-goals of Phase 1:** no visual changes for current users, no territory selector
changes, no `Program.cs`/platform changes, no un-hardcoding of Gunner card queries
(each existing card keeps its current scoping, marked `fixed` in the registry).

---

## 2. The three scoping axes (design recap)

| Axis         | Question                               | Mechanism                                                                                                                                                                                                                               |
| ------------ | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Identity  | Which cards do I get?                  | Panel registry: permission / user-type / status per card                                                                                                                                                                                |
| 2. Territory | Whose data fills them?                 | Existing selector, consumed read-only: `CookieHelper.CurrentTerritorySlug(HttpContext)` (self-guards access via JWT territory list / `AccessAllTerritories`). **We do not touch the selector's design or wiring — cards only read it.** |
| 3. View-as   | Internal team looking at a franchisee? | Falls out of axes 1+2: `AccessAllTerritories` + a selected territory ⇒ assemble that territory's card set. No selection ⇒ own internal hub.                                                                                             |

Per-card **ScopeSource** in the registry: `fixed` (legacy Gunner filters, unchanged) |
`territory` (reads the selector) | `user` (logged-in user). All 20 existing cards ship as
`fixed` in Phase 1.

The consumption idiom to copy into territory-aware cards (from `Pages/Inbox/Index.cshtml.cs:23-37`):
auth-guard → `CurrentTerritorySlug` (returns null if not permitted) → pass slug into the query.

---

## 3. Registry design

Two halves — DB controls _visibility and placement_, code controls _what a card is_:

**DB table** (migration, name follows `MasterSuiteUI_NavigationMenuItems` convention).
Generalized to serve every panelized page, not just the Day Hub — the same table later
drives the Property page (panels AND its workspace tabs) and the redesigned
Journey/Contact/Territory detail pages:

```sql
CREATE TABLE MasterSuiteUI_PagePanels (
  Id            INT AUTO_INCREMENT PRIMARY KEY,
  PageKey       VARCHAR(32)  NOT NULL,          -- dayhub | property | journey | contact | territory | ...
  PanelKey      VARCHAR(64)  NOT NULL,          -- matches code catalog entry
  Slot          VARCHAR(24)  NOT NULL,          -- dayhub: top|today|kpi|acq|bld|run|bottom; detail pages: header|main|tab|rail-kpi|rail-feed
  SortOrder     INT          NOT NULL DEFAULT 0,
  Permission    VARCHAR(64)  NULL,              -- e.g. 'Gunner', 'Frandev'; NULL = any authed user
  ScopeSource   VARCHAR(16)  NOT NULL DEFAULT 'fixed',  -- fixed | territory | user
  RequiresGhl   TINYINT(1)   NOT NULL DEFAULT 0,
  Status        VARCHAR(8)   NOT NULL DEFAULT 'live',   -- live | beta | off
  BetaUserIds   VARCHAR(255) NULL,              -- CSV of user ids while Status='beta'
  Enabled       TINYINT(1)   NOT NULL DEFAULT 1
);
```

A **tab is just a panel with `Slot='tab'`** — so a new or reworked workspace tab on the
Property page can ship `Status='beta'` to named users only. Phase 1 only seeds
`PageKey='dayhub'` rows; the generalization costs nothing now and avoids a schema
migration when the Property page gets the same treatment (Phase 1b) and when
Journey/Contact/Territory are redesigned onto the shared detail-page template
(header strip · main column w/ tabbed workspace · right rail w/ KPIs + activity/comms).

**User preference layer (added 2026-07-21, lands with Phase 1b Wave 2):** the registry is
admin-assigned and defines the _menu_ of panels/versions a user type may have. A second
lightweight table (`MasterSuiteUI_PagePanelUserPrefs`: UserId, PageKey, PanelKey,
Hidden/VersionChoice) lets individual users pick and choose within that menu — hide
optional cards, keep the simple version of a card instead of an enhanced one. Prefs can
only narrow, never expand, what the registry grants.

**Code catalog** (in the Gunner module): dictionary `PanelKey → { partial path, data loader }`.
A registry row with no catalog entry is skipped (DB can't invent code); a catalog entry with
no row never renders. **New card = 1 partial + 1 loader + 1 registry row. New version =
second catalog entry (`prospects_v2`) + swap the row.** Rollback/beta/reorder are data
changes, no deploy.

**Page assembly:** `DayHubModel.OnGetAsync` reads the registry once, filters rows by
permission + status/beta, then fans out **only the granted cards'** loaders in parallel
(replacing today's fixed ~24 `Task.Run` block) and renders slots in a thin shell loop.
A card whose loader throws renders an error stub — never kills the page.

---

## 4. Card inventory (what exists today)

~20 cards. Scoping legend: **partner** = hardcoded `ReferralPartnerName='Corey Lavinder'`
(`GunnerService.Inventory.cs:330`), **NASHC** = hardcoded `FranchiseSlug` const
(`DayHub.cshtml.cs:96`), **GHL** = GHL-origin data via mirror tables, **user** = scoped to
logged-in gunner_user when `view=mine`.

| #   | Card                                                                | Slot  | Scoping          | GHL? | Writes?                | Carve difficulty |
| --- | ------------------------------------------------------------------- | ----- | ---------------- | ---- | ---------------------- | ---------------- |
| 1   | Your Day (DaySetup, flag `Gunner_DaySetup`)                         | top   | user             | –    | –                      | Easy             |
| 2   | Today's Appointments                                                | today | GHL + user       | ✅   | ✅ 4 handlers          | **Hard**         |
| 3   | Needs You Now (tasks)                                               | today | GHL + user       | ✅   | ✅ 2 handlers          | **Hard**         |
| 4   | Exposed / Watchdog (flag `Gunner_Watchdog`)                         | today | NASHC            | –    | –                      | Easy             |
| 5   | Inbox                                                               | today | GHL + user       | ✅   | feed handler           | Medium           |
| 6   | 90-day Funnel strip                                                 | kpi   | partner          | –    | –                      | Easy             |
| 7   | Compliance cell (in funnel strip)                                   | kpi   | NASHC            | –    | –                      | Easy             |
| 8   | Today's Target — Offers                                             | acq   | partner          | –    | ✅ 5 handlers + big JS | **Hardest**      |
| 9   | Today's Target — Contracts                                          | acq   | partner          | –    | –                      | Easy             |
| 10  | Active Prospects (+agent chips, flag `Gunner_ProspectTouchSignals`) | acq   | partner          | –    | –                      | Easy             |
| 11  | Lead Categories                                                     | acq   | partner          | –    | –                      | Easy             |
| 12  | Weekly Scorecard                                                    | acq   | partner          | –    | –                      | Easy             |
| 13  | Active Projects                                                     | bld   | partner          | –    | –                      | Easy             |
| 14  | Inventory Summary                                                   | bld   | partner          | –    | –                      | Easy             |
| 15  | Cycle Time                                                          | bld   | partner          | –    | –                      | Easy             |
| 16  | Alta Capital placeholder                                            | bld   | static           | –    | –                      | Trivial          |
| 17  | Year to Date                                                        | run   | partner + global | –    | –                      | Easy             |
| 18  | Recent Graded Calls                                                 | run   | global           | –    | –                      | Easy             |
| 19  | EOS Habits                                                          | run   | NASHC            | –    | –                      | Easy             |
| 20  | Compliance + badges                                                 | run   | NASHC            | –    | –                      | Easy             |

**Shared furniture (not cards, stays in the shell):** greeting header + Mine/Everyone
toggle, pending agent-drafts chip strip, live-refresh dot, bug button partial, Chiron dock
partial.

---

## 5. GHL per-territory model

**Today:** one GHL sub-account for the whole install — `SystemConfig` keys
`Gunner_GhlLocationId` + `Gunner_GhlPrivateToken` (`Ghl/GhlConfig.cs`, 60s cache, DB-held
so token rotation is a DB write). Three Hangfire poll jobs fill the mirror tables the
GHL cards read: `gunner-poll-messages` (2 min → Inbox), `gunner-poll-tasks` (5 min →
Needs You Now), `gunner-poll-appointments` (5 min → Appointments). **Cards never call GHL
live at render — they read our DB.**

**Target:** each territory gets its own GHL sub-account; only a couple exist today, so
**most territories will have comms/tasks/appointments blank — that is expected and must
look intentional**, not broken.

Design (Phase 1 lays the flag; the table lands with the first territory-scoped GHL card
in Phase 2):

- New mapping table `gunner_ghl_account` (TerritorySlug, LocationId, PrivateToken,
  Enabled) — same SystemConfig-style DB-held-credentials philosophy, one row per connected
  territory. `GhlConfig` gains a per-territory lookup that falls back to today's single
  install keys, so current Gunner behavior is untouched.
- Poll jobs iterate connected territories (rows in the table) instead of the one account.
  Mirror tables gain a TerritorySlug column where they lack one.
- Registry cards flagged `RequiresGhl=1`: when the selected territory has no connected
  sub-account, the card renders a quiet "Not connected yet" empty state (kept visible so
  franchisees know the capability exists) rather than an error or a silent gap.

---

## 6. Build order within Phase 1

The one real technical obstacle: the page has **one monolithic `<script>` block (~380
lines) and one `<style>` block (~260 lines)** shared across all cards, plus a live-refresh
loop that polls `?handler=Pulse` and swaps `data-live` regions, with a `busy()` guard that
reads per-card filter globals. The four Today-row cards currently live-swap **as a unit**.

Waves, each independently shippable and verifiable:

1. **Framework** — migration + registry table, code catalog, shell render loop, error-stub
   wrapper. Seed rows matching today's layout exactly. Shared CSS primitives (`.card`,
   `.row`, badges, etc.) move to the module sheet `gunner.css`, not per-partial.
2. **Wave 1 — the 14 easy cards** (rows 1, 4, 6–7, 9–20): pure read-only lifts into
   partials + loaders. Each carve verified against the live page.
3. **Wave 2 — Inbox** (medium: search/filter globals feed `busy()`, but no write path).
4. **Wave 3 — Appointments, Needs You Now, Offers** (the entangled three: own `data-live`
   keys per card, JS encapsulated per partial while preserving the Pulse/`busy()`
   contract, shared helpers `tgl`/`dhPost`/`escapeHtml` promoted to a shared script).
5. **Verification pass** — side-by-side vs production hub: identical render, live-refresh,
   all write handlers (offer log/edit/delete, task complete/edit, appointment
   status/reschedule/delete), Mine/Everyone toggle, feature flags on/off.

Rough effort: waves 1–2 are a session or two; waves 3–4 are the bulk (est. 2–3 sessions);
framework + verification bookend at ~1 session each.

## 7. Risks / review boundaries

- **Live-refresh contract** is the main regression risk (silent breakage of `data-live`
  swaps). Mitigation: per-card `data-live` keys + explicit verification step per carved card.
- **Gunner is Ben's domain** — this refactors his pages heavily even though it changes
  nothing visually. This document exists to get his buy-in _before_ work starts. No
  platform files (`Program.cs`, shared layout) are touched.
- **CSS collisions** when FranDev cards later join Gunner slots (`.gn-page` vs `.fd-page`
  scoping) — Phase 2 problem; the shared-primitive move in the framework wave is the prep.
- **Middleware gate**: `/Gunner*` requires the Gunner permission. Fine for Phase 1 (same
  audience). Before FranDev-only users hit the shared hub (Phase 2), the consolidated hub
  needs a route/gate decision — flagged now, decided with Ben then.

## 8. What Phase 2 unlocks (context, not scope)

New cards as registry rows behind `Status='beta'`: FranDev prospects/coaching summaries
(clicking through to Journey/Pipeline pages), Ben's bottom-row "Panel 3" modules
(deployment center, construction dashboard), owner and NAH-employee hub assemblies, and
the merged Calls/Inbox/Tasks/Calendar pages reusing the same pattern. Page disposition map
and full consolidation plan are tracked in project memory (`project_panel_consolidation`).
