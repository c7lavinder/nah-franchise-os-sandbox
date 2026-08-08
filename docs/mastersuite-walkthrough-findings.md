# FranDev-in-MasterSuite — Walkthrough Findings

> Corey's page-by-page walkthrough of the FranDev record pages in MasterSuite, 2026-08-08 (session 94).
> Captured verbatim, then deduped, grouped, and checked against the code.
>
> **Nothing here is built yet.** This is the list, not the plan. Each item has an ID so we can
> point at it in a PR title or a later session without re-quoting the whole thing.

---

## Status board (session 96)

| Item                                       | State                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------- |
| **G1** performance                         | **DONE** — #673 (`/frandev` 13–16 s → 0.3–0.9 s) and **#682 MERGED**, migration 245 live.   |
| **G2** everything writable                 | **PR #686** — the 224-field Profile tab is writable on Contact + Journey. Clears J6's half. |
| **J8 · C3 · T7 · C2** button/tail removals | **Merged** — #674                                                                           |
| **D3** phone formatting                    | **Merged** — #675 → #676 (one format across MasterSuite, the existing one)                  |
| **J2 · J5** journey rename, inline save    | **Merged** — #678                                                                           |
| **G4** tab emojis                          | **CLOSED** — Corey: #676 was the thing he meant. No emoji tab names exist.                  |
| **T6** dev-mode card stages                | **Already built** — look before building (see below)                                        |
| **P2** no tasks in system                  | **Corey was right, it is not a display bug** — `frandev_task` holds **1 row**. See below.   |
| **D1** merge duplicate journeys            | **Rescoped** — only **2 real** duplicates; 2 more are legitimate and must not be merged.    |
| **D5** merge duplicate contacts            | **Rescoped** — a merge mechanism already exists and has run 28 times.                       |
| **D6** multiple phones/emails              | **Rescoped** — the email table is live with 2,765 rows. Phones are 5 flat columns.          |
| **D7** coach on the person                 | **Unblocked** — Q3 answered: derive from the territory. Covers 72 of 89 territories.        |
| **T1 · T2 · T3 · T5** territory layout     | **PR #684** — T2 was real: 26 of 35 lead types shared one colour. See below.                |
| **D1** the orphaned journeys               | **CLOSED** — all 3 repaired. Corey ruled the 2 different-name merges correct (s96).         |
| **Q1**                                     | Still a conversation Corey wants to have                                                    |
| **Q2**                                     | Still lost (two truncated lines)                                                            |
| **Q3 · Q4**                                | **Answered** — see Open questions                                                           |
| Everything else                            | Not started. See Suggested order.                                                           |

Open PRs: **#684** (territory layout + donut colours) and **#686** (the profile write layer).
Neither carries a migration. **#682 merged and deployed**; its two indexes were confirmed
present on production afterwards rather than assumed from a green deploy.

---

## Session 96 — the write layer, and what the profile data actually holds

### G2 — the Profile tab is writable, and the pencil is conditional on purpose

PR #686. `UpdateProfileField` upserts one row of `frandev_contact_profile_field` and
journals `update_profile_field`, the same mirror-first contract as `UpdateContactFields`.
The shell gains one generic `data-*`-driven inline editor so the next writable field is
markup plus a handler rather than a third copy of the script.

**Two kinds of row deliberately get an inert pencil.** Each would otherwise be an edit that
looks saved on screen and then fails forever, silently:

- **A field the catalog does not know.** The app's replay calls `setContactProfileField`,
  which validates the name and **throws** on one its registry does not hold. The write would
  save here, repaint the page, land in `frandev_native_write`, and fail on every replay.
- **A structured value.** 2,990 of 5,085 rows hold a JSON object. The page receives the
  _text_ of the object, so saving it back would store the text and lose the structure.

Verified against production rather than assumed: `JSON_QUOTE` round-trips to what the read
expects; `manual` is a real `LastUpdatedBy` (410 rows); `SourceHistory` is
`[{value, updated_at, updated_by}]`; and all **212** catalog fields exist in the app's
224-field registry, so anything the catalog renders is safe to write.

### ⚠ G3 has a second concrete target: most profile keys match no catalog field

Measured on production 2026-08-08 — **129 distinct field keys in
`frandev_contact_profile_field`, and only 53 of them match a catalog field. The other 76
all render in the "Other" bucket.**

Two of the 76 are near-miss spellings, which is the G3 pattern exactly:

| Stored in the data        | The catalog lists | Consequence                                                      |
| ------------------------- | ----------------- | ---------------------------------------------------------------- |
| `lookalike_score` (2,990) | `Lookalike Score` | the catalog row can never fill; the real values show under Other |
| `lead_source`             | `LeadSource`      | same                                                             |

Space-versus-underscore is a real difference. Each mismatched catalog row sits in its
group's denominator permanently empty while its actual data appears elsewhere on the page —
so "n of m filled" is understated for those groups. **Not fixed here** (scope discipline);
this is G3's work, alongside the `Obituary`/`Obituaries` lead-type duplicates.

The other 74 are keys the catalog never had at all — whole families of them (`first_rental_*`,
`prior_primary_home_*`, `commitment_*`). Whether those belong in the catalog, or are dead
keys from an earlier shape, is the first question G3 should answer.

---

## Session 95 — what measuring actually changed

### G1 is finished being diagnosed. Both remaining slow pages had the same cause.

`/frandev` was one 16-second query. **The Day Hub and Inventory are not.** They have a
**floor**, measured read-only against production one query at a time:

`PropertySummaries` is 977,886 rows / 481 MB, and its indexes carry two non-key columns
between them. The workspace scope selects 20,374 rows. Reading an indexed column is an
index-only scan; reading any other column is 20,374 scattered row fetches:

| Same rows, same predicate — only the column changes | Time     |
| --------------------------------------------------- | -------- |
| `COUNT(*)`                                          | 143 ms   |
| `COUNT(Status)` — in an index                       | 148 ms   |
| `COUNT(Inserted)` — in an index                     | 131 ms   |
| `COUNT(LeadCategory)` — not indexed                 | 1,353 ms |
| `COUNT(Latitude)` — not indexed                     | 1,312 ms |

- **Inventory (5.7 s)** is ONE read: `GetDataIssueBreakdown` at **4,217 ms**, while every
  other read on the page is ≤ 1,315 ms. It fills a dropdown that is **hidden until
  clicked**. PR #682 moves it off page load.
- **Day Hub (4.9 s)** has no single slow query at all. Its worst read is the funnel at
  2,341 ms (three queries run sequentially inside one method), then 1,563 / 1,105 /
  1,058 ms. ~40 reads fire at once, so the wall clock is contention over ~9 s of total
  database work.
- **`GetDayHubPulse` is 2,665 ms and runs every ~12 seconds.** Its own comment says "must
  stay cheap." Half of it is one unindexed `MAX(LastModified)`.
- **`GetAvgCycleDays` has no callers** and measures 3,418 ms — a landmine if anyone wires
  it up. `PropertyCalculations` is 4.2 GB. Left alone deliberately (scope).

⚠ **A third rewrite measured slower than the original.** Driving the funnel from the date
window instead of the scope: 1,627 ms vs the 786 ms the optimizer already picks. And four
shapes of the duplicate-address `EXISTS` were tried; the best was still 2,424 ms against
3,186 ms. After migration 243's `GROUP BY` at 19,159 ms vs 16,209 ms, that is three for
three. **Measure before optimising is not a slogan on this codebase.**

### P2 — Corey was right, and the earlier note here was wrong

The previous section guessed this was a scoping bug in the read path. It is not.
**`frandev_task` contains exactly one row.** The panel is empty because the table is empty.
Nothing to fix in the query; the question is why nothing writes tasks.

### D1 — "merge the duplicate journeys" is three different problems

Only **4 contacts hold more than one active journey**, and they are not the same kind of
thing. A tool that merged all four would destroy real data:

| Contact            | Journeys                                            | What it is                                       |
| ------------------ | --------------------------------------------------- | ------------------------------------------------ |
| **Loretta Koonce** | `Loretta Koonce` + `Loretta  Koonce` (double space) | ✅ a real duplicate — the double space caused it |
| **Jorge Villalta** | two identical names, both created the same day      | ✅ a real duplicate                              |
| **NAH System**     | Global, Kane IL, Salt Lake North, Training          | ❌ **territory journeys — must NOT be merged**   |
| **Jason Semper**   | Fresno CA East, Fort Worth West TX                  | ❌ **two territories he legitimately holds**     |

That last pair is exactly the P1 warning ("an owner can hold several territories at once")
showing up in the data. So D1 is: merge **two** journeys, and never key a merge on
"one contact = one journey".

⚠ **Jonathan Dreyer — the example in the original walkthrough — now has only ONE journey.**
Whatever was on screen is no longer duplicated.

### The orphan-journey trap is not hypothetical. It has already happened twice.

`reference_journeys_merge` warned that contact merges leave orphaned active journeys.
**Two active journeys in production point at a contact that has been merged away:**

- **Jarrod Turner** — merged 14 Jul into a _different_ Jarrod Turner contact. The winner
  has **no journey**, so the journey is stranded on the loser.
- **Courtney McDonald** — merged 15 May into **Michael Scott**, who is a different person
  and has his own active journey. ⚠ **That looks like a bad merge, not just an orphan.**

This is a live data bug and it is worth more than a new merge tool.

### T2 — the pie chart really was one colour, and the cause was in the code

`LeadTypeColor` matched **eight hard-coded keywords** and returned one pink for everything
else. The data carries **35 distinct lead types and 26 of them — 57.6% of all rows — hit that
pink.** In Nashville the 2nd, 4th, 8th, 9th and 10th biggest slices were the same colour.

Fixed in PR #684. Two designs were tried and **rejected by the data**:

- **A fixed global type → colour map** (so a type looks the same on every territory). No eight
  types cover the book — the best eight by breadth still leave territory **CLTW at 0%
  coverage**. Slots are therefore per chart.
- **Generating a 9th hue.** Past eight, the tail folds into one gray bucket. It is called
  **"Smaller types"**, not "Other", because ⚠ **"Other" is itself a real lead type** (2,006
  rows, Nashville's second-biggest slice).

⚠ The ring is **drawn in palette-slot order, never biggest-first.** The palette is validated
only for _adjacent_ pairs; across all pairs red vs orange is ΔE 7.1 to normal vision (floor 15)
and green vs orange is ΔE 3.2 to a protanope. Sorting the ring by size lets those pairs touch
and read as one wedge.

⚠ **This surfaced a G3 item:** the taxonomy has near-duplicate values — `Obituary` AND
`Obituaries`, `ProspectNow` AND `Prospect Now`, `PropStream` AND `Propstream`. Cross-page
colour stability is impossible until that is cleaned up, because it needs ≤8 canonical types.

### D1 — the orphaned journeys are fixed, and 2 of 3 are waiting on Corey

The cause was found in code, not guessed: `app/api/contacts/[contactId]/merge/route.ts`
reassigns 20+ tables and closes `journey_contacts` memberships — **but never touched
`journeys.primary_contact_id`**, the pointer that makes a journey reachable. Closing the
memberships is exactly what made the hole look handled. **3 of the route's 5 real merges
orphaned a journey.**

Fixed (new step 3b, which runs _before_ the contact is marked merged) and pinned by 4 tests.
`scripts/repair-orphaned-journey-primaries.ts` repairs existing rows and **refuses most of
them on purpose**:

| Journey             | Merged into   | Action                                               |
| ------------------- | ------------- | ---------------------------------------------------- |
| `Jarrod Turner`     | Jarrod Turner | ✅ **repaired** — same person, keeper had no journey |
| `Vince Vitale`      | jo Vitale     | ⏸ **skipped — different people**                     |
| `Courtney McDonald` | Michael Scott | ⏸ **skipped — different people, both active**        |

Repointing assumes the merge was right. For those two the fix is to **undo the merge**, not to
hand one person's journey to another — that needs Corey.

⚠ **Also found, in the same file: `POST /api/contacts/[contactId]/merge` imports
`requireAuth` and never calls it.** There is no `middleware.ts`, so nothing else gates it —
a destructive endpoint that reassigns 20+ tables is unauthenticated. Not changed (scope), and
it is a two-line fix following the pattern in `docs/security.md`.

### D5 — a contact merge mechanism already exists and has run

`frandev_contact` carries `MergedIntoContactId` and `MergedAt`, and **28 contacts are
already merged**. 61 same-name groups remain (of 3,204 contacts). **Tom Winspear — the
example in the walkthrough — now appears once.** So D5 is not "build a merge"; it is
"finish the one that exists, and make it carry journeys" (see the orphans above).

### D6 — emails are live, phones are five flat columns

`frandev_contact_email` has **2,765 rows and 84 contacts with more than one email**, so the
child table is not just present, it is in use — the record page simply doesn't read it.
Phones are five separate columns with very different fill: `Phone` 3,060,
`MarketingPhone` 31, `NexaPhone` 29, `PartnerPhone` 11, `RealEstatePhone` 5.

### D7 — deriving the coach from the territory covers most of the book

Q3 answered (derive from territory). **72 of 89 territories carry a `PrimaryCoach`.**
`frandev_coach_assignment` is confirmed **empty (0 rows)**, which is why option (b) was the
wrong bet.

---

## Read this first — four items are not what they look like

Before anything gets built, four of Corey's asks were checked against the source. The answers
change what the work is:

| Ask                                                                        | What is actually true                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **T6** — dev mode should mark cards beta / building / production / retired | **Already built, all of it.** Those exact four words are constants in `GunnerDevMode.cs:243-246`; the overlay's per-card popover already has the four buttons (`_GunnerDevMode.cshtml:1332`); the write endpoint already exists and is audited (`DevPanel.cshtml.cs:181`). The record pages were wired in **today** by migration `2026-08-08-238`. Most likely Corey could not find the control, not that it is missing. **Look before building.** |
| **P2** — "I don't think there is any tasks in system"                      | The tables and read paths exist (`frandev_task`, `gunner_task`). But the record-page query matches on `ContactId` **OR** `GhlContactId` only, and the FranDev Day Hub card is scoped to the assignee. So tasks can exist and still show as empty. **Needs one read-only production count before we conclude anything.**                                                                                                                            |
| **D6** — people need multiple phones and emails                            | **Emails: already supported.** `frandev_contact_email` is a real child table (`IsPrimary`, `Label` = personal/franchisee/work) and `frandev_contact.Email` is only a denormalised copy of the primary. **Phones: not supported.** There is no phone child table anywhere; phones are fixed single columns. So this is one job, not two: wire up the email table that exists, build the phone one that does not.                                    |
| **D7** — MasterSuite already knows each person's coach                     | **Coach is territory-scoped only.** `Territories.PrimaryCoach` is the live one. There is no coach column on `frandev_contact` or `frandev_journey`. A `frandev_coach_assignment` table exists but **nothing in the app reads it**. So "put the coach on the person" needs a decision, not just wiring — see Q3.                                                                                                                                    |

---

## Pipeline pages

- **P1 — Every pipeline lists journeys _and_ territories.** Clicking a stage or a pipeline filters
  to the journeys and territories in that stage. **Path to Ownership has no territories.**
  ⚠ The hard part: an owner can hold several territories at once. A brand-new territory sits in
  the early Runway stages while that same person's journey is already in Running. So the two lists
  are not one list filtered twice — a person can legitimately appear at two different stages at
  the same time.
- **P2 — The task panel on the right shows the property's tasks**, not a pull-down. (See the table
  above — verify there are rows before treating this as a display bug.)
- **P3 — The left slide-out sub-stage panel needs visual work**, plus a button to advance to the
  next _full_ stage.
- **P4 — Territory labels should match the Vercel site.**

## Journey pages

- **J1 — When a pipeline completes, open the next one.** Jonathan Dreyer should land with
  Onboarding already expanded.
- **J2 — The journey name must be editable by hand.**
- **J3 — The right-hand Activity panel is the wrong thing.** It is incomplete as a history, and it
  should not be a history at all — it should be an **internal team chat, like Gunner's**.
- **J4 — Each sub-stage should be individually clickable to tick off**, not only a way to move
  between stages. Font slightly bigger. **Manual for now** — automation comes later.
- **J5 — Kill the MasterSuite popup at the top of the screen on save.** Edits should be inline.
- **J6 — Profile tabs need to be editable.**
- **J7 — Hide pipelines the journey has never entered.**
- **J8 — Remove the "Open contact" button (top right).** There can be several contacts; the right
  side panel is the way in.

## Contact pages

- **C1 — Add a contacts panel on the contact.** The split: **family and friends belong to the
  person; business colleagues and workers belong to the territory.** So if Jonathan leaves the
  territory, the workers stay with the territory and the family leaves with him.
- **C2 — Remove "owner since" from the header.**
- **C3 — Remove the "Open journey" button.**

## Territory pages

- **T1 — Performance: the top 9 cards in an exact 3×3**, like the Vercel site.
- **T2 — The list-building pie chart needs a colour per lead type.** It is one colour today.
- **T3 — "Latest stage 4 offers" moves below Pipeline and Pipeline Comparison.**
- **T4 — Last stage 4, active inventory, and sold inventory: same UI _and_ same wiring as the
  Vercel site.**
- **T5 — Pipeline and Pipeline Comparison sit side by side.**
- **T6 — Dev mode: every card markable beta / building / production / retired.** _(Already built —
  see the table above.)_
- **T7 — Delete the "Open journey" button** at the top and in the owner card in panel 1.
- **T8 — EOS no longer needs mirroring.** It lives in MasterSuite now, so make it editable in a tab.

## Data

- **D1 — Merge the duplicate journeys.** Jonathan Dreyer is the example.
  ⚠ Known trap: contact merges have previously left **orphaned active journeys** behind, and
  `journeys.status` has no `merged` value (only active / archived / closed). Whatever we build has
  to say what happens to the loser's journey, or we make the duplicate problem worse.
- **D3 — Format phone numbers consistently across all of MasterSuite.**
  A canonical helper already exists (`FormatHelpers.PhoneNumberHelper`) but is used in only 5
  places, has **two copy-pasted duplicates**, and the FranDev record pages print phones **raw**.
- **D5 — Merge the duplicate contacts** (the same person existing as both franchisee and prospect).
  Tom Winspear is the example.
- **D6 — Multiple phone numbers and emails per person** (personal + business). _(Emails already
  have a table; phones do not — see above.)_
- **D7 — Show each person's / journey's coach, and put them in Team on those records.**
  _(Coach is territory-level only today — see Q3.)_

## Every page

- **G1 — Pages load extremely slowly. They need to be near-instant.** — **root cause found, PR #673.**
  Measured on production. It is **not** all pages: `/dashboard` 0.5 s, `/frandev/pipeline` 0.9 s,
  `/Gunner/Contacts` 0.9 s are all fine; `/Gunner/DayHub` 4.6 s and `/Gunner/Inventory` 6.6 s are
  slow; `/frandev` is 13–16 s. On `/frandev`, **one query is 16.2 s and every other query is
  ~0.12 s**. It filters `PropertyInventory` on `Inv_PurchaseDate`, which had no index — so it
  reads 983,166 rows to find the 229 that can match.
  ⚠ Rewriting that query was tried and **measured slower** (19.2 s). The shape was never the
  problem. Do not retry it.
  ⚠ `/Gunner/DayHub` and `/Gunner/Inventory` read the same column and _should_ improve, but that
  is **unproven** — their own queries have not been timed individually.
- **G2 — Everything on the page needs to be writable.** Writes were disabled on purpose, with
  tooltips. The parent of J2, J6 and T8 — one write layer serves all of them.
  **J2 shipped in #678; the Profile tab shipped in #686** (both record pages), which is J6's
  profile half. **Still disabled and still to do:** the territory Data tab's native fields,
  the Personal EOS add boxes (T8), the Ecosystem add/remove stakeholder controls, "Add
  contact" and "Add note" on the shared Overview, and the header Merge / Delete / Transfer /
  Retire actions. The generic `data-*` inline editor in `_RecordShell.cshtml` is the thing to
  point them at — a new field should be markup plus a handler.
- **G3 — Keep franchisees and prospects in MasterSuite, and use the MasterSuite fields that already
  exist rather than inventing new ones.** A lot of data (phones and such) is already housed —
  audit what is there first. **Two concrete targets now, both measured:** the lead-type
  near-duplicates (`Obituary`/`Obituaries`, `ProspectNow`/`Prospect Now`,
  `PropStream`/`Propstream`), and the profile-key mismatch above — **76 of 129 stored keys
  match no catalog field**, including `lookalike_score` vs `Lookalike Score` and `lead_source`
  vs `LeadSource`.
- **G4 — Remove the emojis from tab names on every page.** — **CLOSED (Corey, s95):** the
  FontAwesome icons removed from the three record pages' tabs in #676 were the thing he
  meant. Nothing further to do. The scan below stands as the record of why it looked stuck.
  There are none. Every tab on the three record pages is plain text with a FontAwesome icon:
  `Overview · Profile · Territories` (journey), `Overview · Profile · Personal EOS` (contact),
  `Overview · Ecosystem · Performance · Data · EOS` (territory). A repo-wide scan found 194
  non-ASCII glyphs across 83 files, but they are arrows in code comments and UI glyphs
  (`✓ ✕ ★ ⚙`). Real emoji exist on a few Gunner buttons (`👍 👎` on `Call.cshtml`), which is not
  a tab name either. **Which page?**

---

## Open questions — these need Corey, not code

- **Q1 — The nightly journey write per contact looks expensive. Corey wants to talk it through.**
  Flagged by Corey as a conversation, not a task. Worth having before we add anything else that
  runs per-contact per-night.
- **Q2 — Two lines in the notes were cut off:** a bare "Everything" under Data, and a trailing
  dash under Territory pages and under Pages. If those were headed somewhere, they are lost.
- **Q3 — ANSWERED (Corey, s95): derive the coach from the person's territory.**
  `Territories.PrimaryCoach`, which covers **72 of 89** territories. `frandev_coach_assignment`
  was confirmed **empty**, so option (b) would have meant populating it first. The known
  weakness is accepted: someone with no territory shows no coach, and someone with several
  (Jason Semper, NAH System — see D1 above) needs a rule for which one wins.
- **Q4 — ANSWERED (Corey, s95): the Vercel site is live** at
  `https://nah-franchise-os-sandbox.vercel.app/frandev`. ⚠ **Better than screenshots: its
  source is this very repo** (`app/(auth)/territories/[TerritorySlug]/page.tsx` and
  siblings), so T1/T4/P4 parity can be read off the actual components and queries rather
  than eyeballed off a rendered page. Read the source, not the screen.

---

## Suggested order — revised after session 96

1. ~~T6~~ · ~~G1~~ · ~~the cleanup batch~~ · ~~the orphaned journeys~~ · ~~the merge-endpoint
   hole~~ — **done** (#673, #674, #675/#676, #678, #682; sandbox `4d07340`, `42b434c`).
2. **The Vercel-parity batch: T1, T2, T3, T5, P4.** T1/T2/T3/T5 are in **#684**, awaiting
   merge. P4 (territory labels) is still open.
3. **Finish G2.** The Profile tab shipped in #686; the pattern and the generic inline editor
   now both exist, so the rest is mostly wiring. Best order by value: the **territory Data
   tab** (native `Territories` fields — note this one needs a real column allowlist, since
   unlike the EAV table a column name goes straight into the UPDATE), then **T8** (EOS add
   boxes), then the Overview "Add note".
4. **D7 (coach), then D6 (emails first — the table is already full; phones second).** Both
   now have known shapes, so neither needs discovery.
5. **G3, now that it has concrete targets.** The profile-key mismatch (76 of 129) and the
   lead-type near-duplicates. Start by deciding whether the 74 unknown keys belong in the
   catalog or are dead.
6. **D5 / D1's remaining two** (Loretta Koonce, Jorge Villalta). Never key a merge on "one
   contact = one journey" — NAH System and Jason Semper prove that shape wrong.
7. **P2 — find out why nothing writes `frandev_task`.** One row in the whole table is a
   writer problem, not a reader problem.
8. **The bigger builds: P1, P3, J1, J3, J4, J7, C1.** Each is its own session. J7 (hide
   pipelines never entered) is the cheapest of these and worth pulling forward.

## Still not started

P1, P2 (the writer question), P3, P4, J1, J3, J4, J7, C1, T4, T8, D1 (the 2 real journey
duplicates — Loretta Koonce and Jorge Villalta), D5, D6, D7, G3.
J6 and G2 are **part done** — see the G2 entry under "Every page" for exactly what is left.

## Waiting on Corey

1. **Merge #684?** (territory layout + donut colours). No migration; it deploys on merge.
2. **Merge #686?** (the profile write layer). No migration; it deploys on merge.
3. **Should merging a contact be admin-only?** The sandbox's
   `POST /api/contacts/[id]/merge` is now authenticated but open to any signed-in role,
   matching the Merge button in `LeadDetailView`, which is shown to everyone. Its sibling
   `journeys/[id]/merge` requires admin. Making contacts match would be one line — and would
   take the button away from the 9 `member` users who can use it today.

_Answered in s96: #682 merged · both different-name merges ruled correct and their journeys
repointed · the merge endpoint's auth hole closed now._

---

## Provenance

Corey's walkthrough, 2026-08-08, after PR #669 (old pages deleted) and PR #670 (workspace picker
persistence) were merged and deployed. Code checks in the "not what they look like" table were run
read-only against the working tree at `54e14e0d2`; **no production data was queried**, so every
statement there about _rows_ (tasks existing, duplicates existing) was still Corey's observation,
not a verified count.

**Session 95 closed that gap.** Every number in the "what measuring actually changed" section
above was read from **production**, read-only, over `mysql2` using the `MASTERSUITE_DB_*`
credentials in the sandbox's `.env.local` — query timings one at a time, row counts by direct
`COUNT`. Nothing in that section is a prediction or an estimate. Where something is still
unproven it says so.

⚠ Two things in this document are still **not** verified by a browser: nothing from session 94 or
95 has been clicked, because local authed MasterSuite pages cannot render on this machine
(`CookieHelper` wants a `jwt` it cannot sign). T6 in particular is asserted from source, not from
seeing the control on screen.
