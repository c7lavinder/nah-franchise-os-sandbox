# Property Page — Phase 1b Wave 4: Inline Tabs → Standalone Pages

> Scope doc for the fourth (final) property-page wave (parent:
> `docs/property-page-panel-registry-phase1b.md` §4 wave 4). Written 2026-07-22
> from a full code inventory of `_GunnerTabs.cshtml` (1,356 lines). Goal: the
> three tabs still rendered INLINE — Overview, Data Entry, Media — become
> standalone lazy-iframe pages like the other seven, so every tab is uniform
> and independently versionable per user.

---

## 1. Why (and why now)

- 7 of 10 tabs are already standalone pages (`/Gunner/AcqTab/{id}`,
  `/Gunner/ValuationTab`, `/Gunner/DispoTab`, `/Gunner/InventoryTab`,
  `/Gunner/RentalTab`, Valuation 2.0, the NAx group). The three inline
  holdouts keep `_GunnerTabs` at 1,356 lines and force the MAIN page to carry
  their weight: Angular 1.7.7 + Handlebars + jQuery-zip-lookup (Data Entry),
  Dropzone 5.9.3 (Media), and ~250 lines of Overview edit/cascade JS load on
  EVERY property-page open today, used or not.
- **The versioning payoff:** with a tab as its own page, a rebuilt version is
  just a second page + a registry row (`overview_v2`, beta to named users) —
  the concrete mechanism Corey asked for. While a tab is inline, versioning it
  means forking hundreds of lines inside the monolith.
- This is the LAST structural wave. After it, `_GunnerTabs` is a thin strip +
  pane shell, and the property page is fully registry-shaped for the FranDev
  consolidation cards.

## 2. The extraction template (established, proven 5×)

From `GunnerRentalTab.cshtml` (49 lines) — the smallest complete example:

1. **Page**: `@page "/Gunner/XxxTab/{id:int}"`, `Layout = null`, own
   `<head>` with whatever resource bundle the content needs (iframe isolation
   = no collisions with the parent).
2. **`.gzoom { zoom: 0.82 }` wrapper** matching the parent canvas scale — on a
   wrapper, NOT body (a zoomed body reports inflated scrollHeight and the
   parent's `fitFrame` balloons the frame).
3. **`html, body { height: auto !important }`** so `fitFrame` can measure
   content height.
4. **`.gt-native` card chrome** copied in (same visual as the inline pane).
5. **Writes stay on the parent page model** — two proven styles:
   - Form POST `action="/Gunner/PropertyNative/{id}?handler=X" target="_top"`
     (Rental/Data-Entry style: full round-trip, browser lands back on the
     parent with the right `?tab=`).
   - `fetch()` to a `postBase` pointing at the parent page (Dispo style: SPA
     feel, parent owns all handlers).
6. **Parent pane** becomes 3 lines: `<div class="gt-pane" data-pane="xxx">
   <iframe class="gt-frame" data-src="..."/></div>`. Lazy `data-src`,
   `fitFrame` auto-sizing, expand button, `?tab=` deep links all already work.

## 3. Beta gating — the registry versioning story, first real use

The strip keys (`overview`, `data`, `media`) already exist as registry rows;
no strip or migration-table changes are needed. Gate the PANE IMPLEMENTATION
with version rows, per the §4-wave-2 versioning design:

- New catalog entries `overview_v2` / `data_v2` / `media_v2` (same Title —
  the strip button label doesn't change; the row is invisible to users).
- Pane markup forks: `overview_v2` granted → lazy-iframe pane; not granted →
  today's inline pane, verbatim. Same fork pattern as Waves 1–3.
- Seed rows `Status='beta'`, `BetaUserIds='corey@newagainhouses.com'`.
  Promotion/rollback = data flips, no deploy. Inline markup is deleted only
  after sign-off (§4b rule 1).

## 4. Per-tab scope (build order: easiest → hardest, one at a time)

### 4a. Media → `/Gunner/MediaTab/{id}` (~0.5 session)

What it is today (`_GunnerTabs.cshtml:1036-1128`, ~95 lines): category
list-group (construction/before/after/documents + counts), Dropzone upload pad
with antiforgery token, thumbnail gallery (Fancybox attrs for images, download
links for documents, YouTube thumbs for video).

- Reads to move to the new page model: `Media` list, `MediaCategory`, the four
  category counts (`GunnerTabsVm.Media*` slims accordingly).
- Dropzone already POSTs to the NATIVE media upload page
  (`/property/media/{id}/{slug}?handler=Upload`) — cross-page today, unchanged.
- **Two link retargets:** the category links and the `queuecomplete` redirect
  currently navigate the PARENT (`/Gunner/PropertyNative/{id}?tab=media&mediaCat=x`).
  Extracted, they navigate the tab page itself (`?mediaCat=x`); the parent
  deep link `?tab=media` keeps working via the strip.
- Dropzone/Fancybox libs move into the standalone page → off the main page.
- Risk: LOW. No parent-DOM coupling, no shared JS globals.

### 4b. Data Entry → `/Gunner/DataTab/{id}` (~1 session)

What it is today (`_GunnerTabs.cshtml:739-992`, ~250 lines): TWO stacked
things —

1. **Native Data Entry form**: 10 native `_DataEntry*` partials fed by
   `Model.DataEntryForm` (a real `DataEntry.IndexModel`), form-POST to the
   parent's `SaveDataEntry` (merge + recalc + redirect). Needs Angular 1.7.7 +
   Handlebars + the jQuery zip→city/state lookup — all currently loaded on the
   MAIN page.
2. **Gunner Enrichment**: Deal Signals card + 9 read-only `dataSections`
   accordions + the **S2 Valuation Engine results accordion**.

Extraction:

- Form keeps the Rental pattern verbatim: POST to the parent handler,
  `target="_top"`, round-trip back to `?tab=data`. Angular/Handlebars/jQuery
  load inside the iframe — the main page finally sheds them.
- `DataEntryForm` + `Enrichment` + the `dataSections`/`dealSignals` Razor
  builders move to the new page model; `GunnerTabsVm` slims.
- **THE entanglement — the S2 poller** (`_GunnerTabs:888-989`): it lives in
  the Data pane's script today but is parent-business end to end: it drives
  the HEADER button `#s2val-run`, calls the parent's `RunS2Valuation` /
  `S2ValuationStatus` handlers, and stages results into the parent grid via
  `window.gunnerStageGridValues` / `gunnerStageIntangibles`. **Move the
  poller to the parent page** (it belongs with the button and the grid).
  The `[data-s2=*]` display spans live on in the extracted Data page,
  server-rendered; the parent poller forwards live updates into the iframe
  with a `postMessage({gunnerS2Update: v})` the Data page listens for —
  an ADDITIVE message, existing bus contracts untouched (§4b rule 5).
- Risk: MEDIUM. The poller move must be regression-checked (run-button
  states, poll-fill, grid staging with the staged-once localStorage guard).

### 4c. Overview → `/Gunner/OverviewTab/{id}` (~1–1.5 sessions, hardest)

What it is today (`_GunnerTabs.cshtml:481-737`, ~510 lines incl. helpers):
Story card, `_GunnerFinalNumbers` partial (issue #259 approval chain), Deal
Setup editor (4 columns: Marketing / Property Details / Follow Up / Timeline),
plus ~250 lines of edit JS (per-field save, lead category→type cascade fetch,
temperature + follow-up-bucket pill menus).

Extraction:

- Reads to the new page model: `FinalNumbers` + `FinalNumbersCanApprove`,
  Deal, DealTempStatus, LeadTemperature, OwnerSource/SubSource option feeds,
  Territories (for the selector), StatusHistory timeline rows.
- Writes: all field saves keep POSTing to the parent's handlers
  (`SaveSummaryField` / `SaveStage1Field` / `SaveDealField`, Dispo `postBase`
  style) — handlers do not move. `_GunnerFinalNumbers` posts
  `FinalRec/FinalApprove/FinalLock/FinalNewChain` the same way.
- **Two parent-DOM couplings need a postMessage bridge** (additive messages,
  existing contracts frozen):
  1. Summary/stage1 saves return `j.calc` which today feeds
     `window.gunnerApplyCalc` (grid) — iframe posts
     `{gunnerOvCalc: calc}` up; parent listener applies.
  2. Saved fields mirror live into the rail's `[data-live-stat]` spans —
     iframe posts `{gunnerOvStat: {field, value}}` up.
- **Perf note (the one real trade-off):** Overview is the DEFAULT tab, so the
  iframe loads on every page open — one extra request. Mitigation: the
  Overview page model reads ONLY its own data (a fraction of the parent's
  ~20-read fan-out), and the parent stops building `DataEntryForm` +
  FinalNumbers on page open. Net main-page work goes DOWN; verify wall-clock
  on dev before promotion.
- Audit item found while scoping: the parent's bottom-of-file dispo JS
  (`gpStartDispo`/`gpSaveDispo`/`gpSaveArtifacts`/strategy fns,
  `_GunnerTabs:1320+`) predates the Dispo island extraction — identify its
  remaining callers during this wave; if dead, it's a Wave-4 cleanup, if
  live (island postMessage), leave frozen.
- Risk: MEDIUM-HIGH (most-used tab). Ships beta behind `overview_v2` with the
  inline pane as instant rollback.

## 5. What Wave 4 does NOT touch

- The tab strip, `fitFrame`/expand/deep-link machinery, and the seven already-
  standalone tab pages — zero changes.
- All write handlers stay on `GunnerPropertyAnalysis.cshtml.cs` (the parent
  owns writes; extracted pages are render + post-back shells).
- The economics grid (atomic panel, §4 rule 5), right rail, header — untouched.
- Frozen contracts (§4b rule 5): `refreshGridRegion`, `window.gunner*`,
  `gunnerDispoPrimary`/`gunnerGoTab` bus, `#s2val-run`, `data-live-stat`.
  Wave 4 ADDS messages (`gunnerS2Update`, `gunnerOvCalc`, `gunnerOvStat`)
  and never alters existing ones.

## 6. Regression checklist per extraction (§4b rule 4 subset)

- **Media**: upload each category, category switch, Fancybox lightbox,
  document download, empty states, expand button, `?tab=media&mediaCat=` deep
  link.
- **Data Entry**: native form save round-trip (recalc lands), zip→city/state,
  Angular lead cascade, enrichment accordions, S2: run button states + poll
  fill + grid staging (+ staged-once guard), `?tab=data` deep link.
- **Overview**: every Deal Setup field saves (summary/stage1/deal), calc
  pushes to grid + rail live-stat mirror (the two new bridges), temp/bucket
  pills, cascade, FinalNumbers rec/approve/lock/new-chain, Timeline renders,
  default-tab load time vs today.

## 7. Sequencing + effort

| Step | What                                                                    | Effort          |
| ---- | ----------------------------------------------------------------------- | --------------- |
| 1    | Media extraction (`media_v2` beta)                                      | ~0.5 session    |
| 2    | Data Entry extraction + S2 poller relocation (`data_v2` beta)           | ~1 session      |
| 3    | Overview extraction + postMessage bridges (`overview_v2` beta)          | ~1–1.5 sessions |
| 4    | Regression + Corey eyeball per step; delete inline panes after sign-off | ongoing         |

Total ≈ 2.5–3 sessions, matching the §4 estimate. Each step independently
shippable; one at a time (§4b rule 2).

**Discipline note:** §4b rule 2 says a wave starts after the previous one is
verified in production. Waves 1–3 are dev-verified but unmerged (chain
#289 → #293 → #294 → #298 on Ben). Building Wave 4 stacked on the chain is
possible (same worktree pattern), but starting AFTER the chain merges is the
by-the-book path — Corey/Ben's call.
