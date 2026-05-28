# FranDev Lint Debt Snapshot

Captured: 2026-05-28

Command:

```bash
npm run lint
```

Result: passes with warnings only. No blocking lint errors.

## Warning categories

### React hook dependency warnings

- `app/(auth)/daily-hq/page.tsx` — unnecessary `user.id` dependency in `useCallback`.
- `components/calls/CallOverrideControls.tsx` — `mappedPrimaries` array should be memoized before use in `useMemo` deps.
- `components/contact/ContactEmailsPanel.tsx` — missing `load` dependency in `useEffect`.
- `components/leads/tabs/JourneyEosTab.tsx` — `effectiveMembers` conditional should be memoized before use in `useEffect` deps.
- `components/pipeline/LeadList.tsx` — missing `visible` dependency in `useEffect`.
- `components/pipeline/PipelineLeadList.tsx` — unnecessary `refreshKey` dependency in `useCallback`.

### Next.js image/font warnings

- `app/layout.tsx` — custom fonts warning from Next.
- `components/layout/Sidebar.tsx` — two `<img>` warnings; consider `next/image`.
- `components/ui/FileDropZone.tsx` — `<img>` warning; consider `next/image`.

## Cleanup recommendation

Treat lint as non-blocking for urgent fixes because it currently passes. Burn warnings down in small UI-safe batches:

1. Hook dependency/memo cleanup.
2. Image/font warnings.
3. Re-run `npm run lint && npm run type-check && npm run smoke:prod`.
