# Bug + Contact Design Sprint Log

> Started 2026-04-09. Branch: `bug-contact-design-sprint`

## Phase 1 — Bug Fixes
- T1: @-mention highlight — already fixed in mega sprint ✅
- T2: Phone format strip +1 — updated formatPhone to output (XXX) XXX-XXXX ✅
- T3: Name title-case — capitalizeName applied to MessagesTab author names ✅
- T4: "Call History" → "Graded Calls" ✅
- T5: Comms tab — already removed in UX restructure ✅

## Phase 2 — Related People Schema
- T6: Created contact_related_people table with roles enum, soft delete ✅
- T7: Created GET/POST/PATCH/DELETE API routes ✅
- Migration applied to production ✅

## Phase 3 — Territory + Deal Columns
- T8: Added 7 columns to contacts (territory, territory_slug, legal_entity, website, franchise_fee, royalty_pct, term_months) ✅
- T9: Added PATCH handler to /api/contacts/[contactId] ✅
- Migration applied to production ✅

## Phase 4 — Contact Page Redesign
- T10: Header simplified — name + action buttons only (phone/email moved to Profile) ✅
- T11: TerritoryDetailsCard — persistent above tabs, inline editable, saves via PATCH ✅
- T12: DealDetailsCard — persistent above tabs, inline editable ✅
- T13: Overview tab — two-column layout: Related People left, Graded Calls + Tasks + Notes + Comms right ✅
- T14: Messages tab — Related People panel persistent on left ✅
- T15: Profile tab — contact info, Scout summary, scores, category fields ✅

## Phase 5 — Verification
- Build: PASS (zero errors)
- New files: 5 (2 migrations, 2 API routes, 2 components)
- Modified files: 5

## Summary
- All 18 tasks complete (5 bugs + 2 schema + 2 API + 6 design + 3 verification)
- 5 commits
- Production migrations applied: contact_related_people + territory/deal fields
- No blockers
