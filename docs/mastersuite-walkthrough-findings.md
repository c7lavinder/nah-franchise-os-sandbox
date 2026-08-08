# FranDev-in-MasterSuite — Walkthrough Findings

> Corey's page-by-page walkthrough of the FranDev record pages in MasterSuite, 2026-08-08 (session 94).
> Captured verbatim, then deduped, grouped, and checked against the code.
>
> **Nothing here is built yet.** This is the list, not the plan. Each item has an ID so we can
> point at it in a PR title or a later session without re-quoting the whole thing.

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

- **G1 — Pages load extremely slowly. They need to be near-instant.**
- **G2 — Everything on the page needs to be writable.** Writes are currently disabled on purpose,
  with tooltips. This is the parent of J2, J6 and T8 — one write layer serves all of them.
- **G3 — Keep franchisees and prospects in MasterSuite, and use the MasterSuite fields that already
  exist rather than inventing new ones.** A lot of data (phones and such) is already housed —
  audit what is there first.
- **G4 — Remove the emojis from tab names on every page.**

---

## Open questions — these need Corey, not code

- **Q1 — The nightly journey write per contact looks expensive. Corey wants to talk it through.**
  Flagged by Corey as a conversation, not a task. Worth having before we add anything else that
  runs per-contact per-night.
- **Q2 — Two lines in the notes were cut off:** a bare "Everything" under Data, and a trailing
  dash under Territory pages and under Pages. If those were headed somewhere, they are lost.
- **Q3 — Where does "coach" live?** Options: (a) derive it from the person's territory
  (`Territories.PrimaryCoach`, works today, but wrong for anyone with no territory or several);
  (b) start using the empty `frandev_coach_assignment` table; (c) put a coach directly on the
  contact. This decides D7.
- **Q4 — "Same wiring as the Vercel site" (T4) needs a source of truth.** The Vercel app is the
  reference for T1, T4 and P4. Confirm it is still deployed and reachable, or those three are
  guesswork.

---

## Suggested order

Not a commitment — a recommendation, to be argued with.

1. **Look at T6 in the browser first.** It costs minutes and may delete an item from the list.
2. **G1 (slow pages).** It taxes every other item on this list and every demo. **Measure before
   changing anything** — the fix is worthless if we guess wrong about the cause.
3. **The delete/cleanup batch: J8, C2, C3, T7, G4.** Small, safe, visible, and they make the pages
   read the way Corey wants while the bigger work is underway.
4. **G2 (the write layer).** Unlocks J2, J6, T8 and much of J4 in one go. Biggest single unlock.
5. **G3 (the field audit), then D3 → D6 → D7.** The audit has to come first; standardising phone
   formatting before knowing which columns we are standardising on is wasted work.
6. **D1 / D5 (the merges).** Last of the data items, because a merge tool that gets it wrong is
   worse than duplicates — and the orphaned-journey trap is real.
7. **The Vercel-parity batch: T1–T5, P4.** Needs Q4 answered first.
8. **The bigger builds: P1, P3, J1, J3, J4, J7, C1.** Each is its own session.

---

## Provenance

Corey's walkthrough, 2026-08-08, after PR #669 (old pages deleted) and PR #670 (workspace picker
persistence) were merged and deployed. Code checks in the "not what they look like" table were run
read-only against the working tree at `54e14e0d2`; **no production data was queried**, so every
statement here about _rows_ (tasks existing, duplicates existing) is still Corey's observation, not
a verified count.
