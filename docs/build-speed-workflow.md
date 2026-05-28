# FranDev Build-Speed Workflow

Goal: make most changes validate in seconds, while keeping a robust release gate for production changes.

## Fast inner loop

Use these while actively editing:

```bash
npm run test:cleanup   # ~1s: risky cleanup-critical fixture tests
npm run check          # ~2s after env is present: env + type-check + DB drift scaffold
```

`test:cleanup` covers the currently highest-risk paths:

- call upload selected-prospect mapping/dedupe
- contact/Scout search planning
- MasterSuite sync env health without running heavy sync

## Release gate

Use before deploy or when touching production-sensitive areas:

```bash
npm run release:check
```

This runs:

1. `npm run check`
2. production-env build with Vercel env loaded
3. production smoke checks

## Full suite

Use when changing shared business logic or before larger merges:

```bash
npm test
npm run lint
npm run release:check
```

## Why this speeds up builds

Before cleanup, failures appeared late during full Next builds or production deploys. Now the common failure classes are caught earlier:

- Missing env: `npm run env:check`
- Type/schema mismatch: `npm run type-check` with regenerated Supabase types
- Risky behavior regressions: `npm run test:cleanup`
- Production route availability: `npm run smoke:prod`

This lets us iterate quickly with fast checks, then use the full release gate only when the change is ready.
