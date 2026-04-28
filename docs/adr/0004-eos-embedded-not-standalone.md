# ADR 0004: EOS embedded, not standalone

## Status
Accepted

## Context
New Again Houses uses the Entrepreneurial Operating System (EOS). The question was whether to build a standalone EOS module or embed EOS concepts into existing views.

## Decision
EOS is embedded into existing UI. Contact pages have EOS tabs (goals, habits, issues, todos), territory pages have EOS sections (rocks, scorecard, lead channels). No standalone EOS app.

## Consequences
- EOS data lives in purpose-built tables (eos_contact_*, eos_territory_*)
- EOS UI is tabs/sections within existing pages
- Scout can read and draft EOS updates via draft_eos_update tool
- Future L10 meeting view may warrant its own page, but data model stays the same
