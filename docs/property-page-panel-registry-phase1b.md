# Property Page Panel Registry — Phase 1b Scope

> Second application of the panel-registry framework (see
> `docs/dayhub-panel-registry-phase1.md` for the framework itself and the
> `MasterSuiteUI_PagePanels` table design). Written 2026-07-21 from a full code
> inventory, for walkthrough with Ben. This page is also the reference
> implementation of the standard detail-page template (header strip · main
> column w/ tabbed workspace · right rail) that Journey/Contact/Territory will
> later be redesigned onto.

---

## 1. Reality check: what the page actually is

- Route: **`/Gunner/PropertyNative/{id}`** (page `GunnerPropertyAnalysis`), in
  `MasterSuite/Pages/Property/Analysis/`. Standalone HTML doc (`Layout = null`),
  Gunner-flavored, backed by `MasterSuite.Modules.Gunner`.
- Sizes: page 795 lines + **2,119-line page model**; `_GunnerTabs.cshtml`
  (Panel 2) 1,356 lines; `_GunnerRightRail.cshtml` (Panels 3+4) **1,686 lines**;
  Dispo island `_GunnerDispoWorkflow.cshtml` 3,574 lines (already extracted to
  its own page).
- Access: `/Gunner/*` middleware gate (Gunner permission). The page does **not**
  read the territory selector — it is scoped by the property id in the URL
  (correct for a detail page; the property's own TerritorySlug displays in the
  header). Admin-only: final-numbers approve/lock. NAx permission: Valuation 2.0
  - the NAx dropdown.
- **Good news:** the page is already half-carved. Most workspace tabs are
  standalone pages loaded as lazy iframes, and the tab strip machinery
  (lazy `data-src`, `?tab=` deep-links, expand button, auto-sizing) **is
  already a rudimentary panel registry — it's just hardcoded in markup instead
  of DB-driven.**

## 2. Annotated regions → code

| Region (screenshot)                   | What it is in code                                                                                                                                                                                                                                                             | State                                                                                                                                                                             |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Panel 0 A — address + status chips    | Inline header left (`GunnerPropertyAnalysis.cshtml:159-188`): stage/lead-category/lead-type/temperature/territory/strategy chips + agent chip                                                                                                                                  | Inline; easy lift                                                                                                                                                                 |
| Panel 0 B — Chiron window             | **Does not exist in the header today.** Chiron is a floating bottom-right dock (`_GunnerBugButton`-style launcher, iframe onto `/Chiron/Panel`, property-context passed as `property:{id}`)                                                                                    | **New design work**: a header Chiron panel is a build, not a carve — the iframe widget is reusable, the placement is new (matches Ben's Day Hub note wanting a Chiron window too) |
| Panel 0 C — action buttons            | Inline header right (`:189-198`): Run S2 Valuation + MasterSuite link                                                                                                                                                                                                          | Inline; easy lift                                                                                                                                                                 |
| Panel 1 — photos/map/stage bar/fields | `_GoogleStreetViewMap` partial + inline stage bar (`:237-310`, write `OnPostSaveStatus`) + native economics partials (`_ArvContainer`, `_ConstructionBudget`, `_RiskFactor`, `_Price`, `_Risks`) wrapped in `#gunner-grid-region` with a ~390-line preview-then-save JS engine | Partials exist; **the JS engine is the hard part** (see §5)                                                                                                                       |
| Panel 2 — tabbed workspace            | `_GunnerTabs.cshtml` — see tab inventory                                                                                                                                                                                                                                       | Mostly carved already                                                                                                                                                             |
| Panel 3 — KPI rail                    | `_GunnerRightRail.cshtml:305-355`: Property Details card + Deal Numbers card (Max Offer w/ editable override, ARV, Construction Budget, Risk Factor, Price)                                                                                                                    | Needs splitting out of the rail monolith                                                                                                                                          |
| Panel 4 — accordions + comms          | `_GunnerRightRail.cshtml:357-end`: Seller/contacts, Calls, Offers, Tasks, Appointments, Notes accordions + team chat / agent-instruction thread + contacts-on-deal card; ~20 write handlers on the parent page model                                                           | One monolithic partial today; each accordion should become its own registry panel                                                                                                 |

## 3. Tab inventory (Panel 2)

| Tab                            | Isolated?                                                                              | Gating today                            | Notes                                                                                                                                           |
| ------------------------------ | -------------------------------------------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview                       | ❌ inline ~510 lines in `_GunnerTabs`                                                  | always                                  | Story, final numbers (`_GunnerFinalNumbers`), Deal Setup editor, lead cascade (Angular), 9 enrichment accordions, S2 poller. Worst tab to carve |
| Acquisition                    | ✅ own page `/Gunner/AcqTab/{id}`                                                      | SystemConfig `Gunner_AcqTab` (global)   | Registry-ready                                                                                                                                  |
| Valuation                      | ✅ own page `/Gunner/ValuationTab/{id}`                                                | always                                  | Registry-ready                                                                                                                                  |
| Valuation 2.0                  | ✅ embeds `/Valuation/Property/{id}?embed=1`                                           | `Gunner_ValuationTab` flag AND NAx perm | Registry-ready                                                                                                                                  |
| Disposition                    | ✅ own page `/Gunner/DispoTab/{id}` (3,574-line island)                                | always                                  | Registry-ready; posts back to parent handlers + postMessage to header chip                                                                      |
| Data Entry                     | ❌ inline (~130 lines) rendering native DataEntry partials; Angular 1.7.7 + Handlebars | always                                  | Medium carve                                                                                                                                    |
| Inventory                      | ✅ own page `/Gunner/InventoryTab/{id}`                                                | always                                  | Registry-ready                                                                                                                                  |
| Rental Analysis                | ✅ own page `/Gunner/RentalTab/{id}`                                                   | always                                  | Registry-ready                                                                                                                                  |
| Media                          | ❌ inline (~95 lines); Dropzone 5.9.3 uploads, Fancybox lightbox                       | always                                  | Medium carve                                                                                                                                    |
| NAx dropdown (10 module panes) | ✅ each an external module page `?embed=1`                                             | NAx permission                          | Registry-ready as a group                                                                                                                       |

**Key gap vs Corey's ask:** today's tab gating is **global** on/off flags
(SystemConfig) plus permissions — there is no per-user visibility. The registry
adds exactly that: each tab becomes a `MasterSuiteUI_PagePanels` row
(`PageKey='property'`, `Slot='tab'`) with `Status live|beta|off` +
`BetaUserIds`. A new/reworked tab ships beta to named users; the three existing
SystemConfig tab flags migrate into registry rows.

## 4. Build waves (each shippable, pixel-identical rule throughout)

> Status 2026-07-22: Wave 1 BUILT (PR #293, beta to Corey, Corey-verified
> pixel-identical). Wave 2 BUILT (PR #294 stacked on #293, beta to Corey,
> smoke-verified on dev: registry rail + prefs round-trip + write/refresh
> contracts + legacy fallback). Wave 3 BUILT (PR #298 stacked on #294, beta to
> Corey, smoke-verified on dev: registry header identity+actions + legacy
> fallback + frozen contracts). **Chiron ruling (Corey 2026-07-22): the
> floating dock is the persistent cross-page assistant and ALWAYS renders —
> never replaced by a header panel. Panel 0 B is a different, future concept:
> a header window where Chiron proactively surfaces what-to-do-next on the
> deal; designed way later as its own catalog entry + row.** Chain
> #289 → #293 → #294 → #298 awaits Ben's merges.

1. **Wave 1 — DB-driven tab strip (the quick win).** Replace the hardcoded tab
   markup with registry rows; keep the existing lazy-iframe/`fitFrame`/expand
   machinery untouched. Because 7 of 10 tabs are already standalone pages, this
   wave is small — and it immediately delivers per-person beta tabs, the main
   ask. Migrate `Gunner_AcqTab`/`Gunner_ValuationTab`/NAx gating into rows.
2. **Wave 2 — right-rail split.** Break `_GunnerRightRail` into registry
   panels: the two KPI cards (`rail-kpi` slot) and each accordion + the comms
   thread (`rail-feed` slot) — Activity, Offers, Contacts, Team, Calls, Tasks,
   Notes, Appointments, Documents, Contacts-on-deal each their own row. Write
   handlers stay on the parent page model; only markup + data loaders move.
   **Rail cards get the full tab treatment (Corey 2026-07-21):** (a) per page
   type via PageKey — property/journey/contact/territory each define their own
   rail lineup; (b) versioned — simple vs. enhanced variants of a card are
   separate catalog entries, assigned per user, so users who prefer the old
   simple cards keep them; (c) **user pick-and-choose via a preference layer**:
   the registry defines the MENU of cards (and versions) a user type is
   allowed; a lightweight per-user prefs table
   (`MasterSuiteUI_PagePanelUserPrefs`: UserId, PageKey, PanelKey,
   Hidden/VersionChoice) stores each person's selections, edited from a small
   settings popover on the rail. Registry = what's possible; prefs = what that
   person picked. Prefs never override permissions — hiding allowed cards and
   choosing among offered versions only.
3. **Wave 3 — header strip.** Lift Panel 0 A / 0 C into header-slot panels.
   BUILT (PR #298): `HeaderPanels/` partials `_HeaderIdentity` /
   `_HeaderActions`, seed migration 2026-07-22-159, ids `#s2val-run` +
   `#g-strat-chip` preserved as frozen contracts. \*\*Panel 0 B ruling (Corey
   2026-07-22): the floating Chiron dock is the persistent cross-page
   assistant and always renders — it never moves into the header. The header
   Chiron window is a DIFFERENT future panel (Chiron proactively surfacing
   what-to-do-next on the deal), designed way later as its own catalog entry
   - registry row.\*\*
4. **Wave 4 — inline tabs become pages.** Extract Overview (hardest tab),
   Data Entry, Media to their own pages matching the other tabs, so every tab
   is uniform and independently versionable (`overview_v2` as a beta row).
5. ~~Wave 5 — economics grid encapsulation~~ **Resolved by design rule (Corey
   2026-07-21): the economics grid is an ATOMIC panel.** The preview-then-save
   engine + native-partial fork-shims are ONE registry row (`main` slot) that
   only ever swaps as a whole. Nothing swaps inside it; its internals are never
   refactored. It stays on property pages permanently; on other detail pages
   (Journey/Contact/Territory) the `main` slot simply holds a different panel.
   No internal encapsulation work exists in any phase.

Rough effort: Wave 1 ~1 session; Wave 2 ~1–2; Wave 3 ~1 (+ Chiron placement
decision); Wave 4 ~2–3 (Overview alone is ~1–2).

## 4b. Safety discipline (non-negotiable — this page cannot break)

1. **The carved page itself ships as a beta.** The registry-rendered version of
   the page runs behind the registry's own per-user mechanism (or an equivalent
   SystemConfig + user check): legacy markup keeps rendering for everyone;
   the registry rendering is visible only to named testers (Corey/Ben) until
   verified. Rollback = flip the flag; the legacy code path is not deleted
   until a wave is fully verified and signed off.
2. **One wave at a time, each independently shippable.** No wave starts until
   the previous one is verified in production.
3. **Atomic-panel rule for anything fragile.** If a region's internals are
   risky (the economics grid, the dispo island), it registers as one whole
   panel and its code is moved, not modified.
4. **Write-handler regression checklist per wave.** All ~30 handlers exercised
   on a test property before promotion: grid preview/apply, stage save,
   summary/stage1/deal field saves, notes/chat/agent-instruction, tasks,
   offers, appointments, contacts link/unlink, uploads (Dropzone + rail S3),
   S2 run/poll, dispo start/save/strategy/buyer/outbound, booking agent
   start/decide/stop, rail SMS.
5. **Contract preservation.** `refreshGridRegion` grid↔rail swap, the
   `window.gunner*` globals, `data-live-stat` updates, and the iframe
   postMessage bus (`gunnerDispoPrimary`, `gunnerGoTab`) are treated as frozen
   interfaces — panels may call them, never alter them.
6. **No parallel edits.** While a wave is in flight, no other session works in
   the property-page files (coordination rule, since other Gunner work runs
   concurrently).

## 5. Risks / entanglements (what the Day Hub didn't have)

- **Cross-panel JS coupling:** `refreshGridRegion()` re-fetches the page and
  swaps BOTH the economics grid (Panel 1) and every right-rail accordion
  (Panel 4) — one function couples two panels; Overview edits call
  `window.gunnerApplyCalc` (Panel 1) and update Panel 3 `data-live-stat` spans;
  the header S2 button is driven by a poller living inside the Overview tab.
  Carve rule: preserve these contracts wave by wave; encapsulate only when a
  panel is extracted.
- **postMessage bus** between tab iframes and the parent (`gunnerDispoPrimary`,
  `gunnerGoTab`, header updates) — must survive the DB-driven tab strip.
- **Fork-shims:** the page embeds MasterSuite's native economics partials
  without their JS bundle and re-implements behaviors inline (documented
  "FORK-SHIM INDEX" in the page). Fragile; reason the grid is an atomic panel
  whose internals are never touched (§4 rule 5, §4b rule 3).
- **Third-party libs** scoped to specific tabs (Angular 1.7.7 + Handlebars in
  Data Entry, Dropzone + Fancybox in Media, Google Maps in Panel 1) — each
  extracted tab-page carries its own libs, which iframe isolation already
  handles.
- **Most-used page in the company** — same discipline as Phase 1: no visual
  change on day one; every wave verified side-by-side (all ~30 write handlers:
  grid edits, stage saves, notes/chat/tasks/offers/appointments, uploads, S2,
  dispo, booking agent).
- **Ben buy-in before starting** — this is his platform's centerpiece page.

## 6. Detail-page template implications

This page defines the template slots for later Journey/Contact/Territory
redesigns: `header` (identity · Chiron · actions), `main` (visual/stage/fields),
`tab` (workspace), `rail-kpi`, `rail-feed` (accordions + comms). Journey = a
prospect's version of this page; Territory = a territory's. Detail pages scope
by the entity in the URL (as this page does), not the territory selector —
selector scoping applies to list/hub pages.
