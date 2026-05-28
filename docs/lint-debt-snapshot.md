# FranDev Lint Debt Snapshot

Captured: 2026-05-28

Command:

```bash
npm run lint
```

Result: clean.

```bash
✔ No ESLint warnings or errors
```

## What was cleaned up

- React hook dependency warnings in Daily HQ, contact emails, call override controls, Journey EOS, and pipeline lists.
- Next.js font warning by moving Google fonts to `next/font/google`.
- Next.js image warnings by replacing remaining low-risk `<img>` usage with `next/image`.

## Standard

Lint should stay clean. If a future warning cannot be safely fixed immediately, document the reason in this file and keep the warning count intentional, not accidental.
