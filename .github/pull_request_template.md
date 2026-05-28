## What this changes
<!-- One-sentence summary -->

## Why
<!-- Link to issue, ADR, or master-plan section -->

## Type
- [ ] feat (new functionality)
- [ ] fix (bug fix)
- [ ] refactor (no functional change)
- [ ] docs (documentation only)
- [ ] chore (tooling, deps, etc.)

## Pre-merge checklist
- [ ] `npm run type-check` passes
- [ ] `npm run test:cleanup` passes when Scout/calls/search/MasterSuite sync behavior changed
- [ ] `npm test` passes when practical
- [ ] `npm run lint` passes or warning-only debt is documented
- [ ] `npm run smoke:prod` passes after deploy for production-affecting changes
- [ ] If schema changed: migration applied and `types/supabase.ts` regenerated
- [ ] If architectural decision: ADR added or referenced
- [ ] Updated docs/master-plan.md if state changed

## Notes for reviewer
<!-- Anything surprising, parked, or worth flagging -->
