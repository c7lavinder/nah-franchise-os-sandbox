# New Again Houses — Claude Code Build Package

Build specs for rebuilding the internal app (franchise sales + coaching). One file per page. The **visual source of truth** is the working prototype `New Again Houses App.dc.html` at the project root — open it to read exact layout, spacing, copy, and sample values. These `.md` files describe structure and behavior so you can implement in the real stack.

## How to use with Claude Code (Opus / VS Code)

For each page, reference its spec + the prototype:

> Implement `handoff/03-calls.md`. Match the layout in `New Again Houses App.dc.html` (the Calls screen + call detail). Use our existing components, design tokens, colors, and fonts. Map to our real data models. Do not invent fields or endpoints beyond what's described.

## Ground rules (tell Claude Code every time)

- **Match our codebase** for colors, fonts, spacing tokens, and shared components. The prototype's palette (blue `#1583cf`, gradient KPI cards, urgency greens/oranges/reds) is an approximation — swap in real tokens.
- **Design/layout only.** Wire to real data models; the specs list the fields/labels that appear on screen, not new schema.
- **Sample data** (names, counts, dates, dollar amounts) is illustrative — from the prototype. Bind to real data.
- **Reuse before rebuild** — KPI card, prospect card, person tag, field-group accordion, grade bar, and the entity-extraction row all repeat across pages; build them once.

## Pages

| File                      | Page                                                                                     | Entry point                    |
| ------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------ |
| `00-app-shell.md`         | Sidebar, Ask Scout bar, KPI cards, background                                            | Wraps every page               |
| `01-scout-ai.md`          | Scout AI assistant home                                                                  | Sidebar → Scout AI             |
| `02-daily-hq.md`          | Daily HQ dashboard + conversation thread                                                 | Sidebar → Daily HQ             |
| `03-calls.md`             | Calls list + **call detail** (summary, grade, transcript, entity-intelligence tabs)      | Sidebar → Calls → click a call |
| `04-pipeline.md`          | Pipeline summary + expandable kanban (drag & drop)                                       | Sidebar → Pipeline             |
| `05-contacts-journeys.md` | Journeys/Territories list (stage-chip filters) + **journey detail** + **contact detail** | Sidebar → Contacts             |
| `06-territory-detail.md`  | Territory detail (Ecosystem / Performance / Data / EOS tabs)                             | Territory Network row          |
| `07-l10.md`               | L10 metrics (Franchise Sales + Coaching board)                                           | Sidebar → L10                  |

## Domain model (context, not new fields)

A **Journey** is the through-line from first form fill to franchise ownership. It links the **Contacts** involved and the **Territories** that journey goes on to own — a triangle. Path-to-Ownership journeys have no territory yet; Onboarding/Runway/Territories/Long-Term journeys have both contacts and territories. A **Contact** can appear in multiple journeys. A **Territory** has an owner (a contact), operations metrics, and a Personal/Construction EOS.
