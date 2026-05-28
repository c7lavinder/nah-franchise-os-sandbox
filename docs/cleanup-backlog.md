# FranDev Cleanup Backlog

This backlog turns the cleanup plan into execution-sized tasks. Keep changes small and shippable.

## Now / quick wins

1. **One-command validation** — done via `npm run check` and `npm run release:check`.
2. **Runtime pinning** — done via `.nvmrc` and `package.json` engines.
3. **Production smoke checks** — done via `npm run smoke:prod`.
4. **Domain ownership map** — done via `docs/domain-map.md`.
5. **DB workflow doc/drift checker** — done via `docs/db-schema-workflow.md` and CLI-based `npm run db:drift`.

## Completed DB workflow cleanup

6. **Supabase project linking** — done
   - Project ref: `llnrvophuvrqcqducgrr`.
   - Local CLI link completed.
   - Acceptance: type generation works from this repo.

7. **Regenerate Supabase types** — done
   - `types/supabase.ts` regenerated from production on 2026-05-28.
   - `npm run type-check` passes against refreshed types.
   - Future type fallout should be captured as domain-specific tasks instead of mixed with feature work.

## Next cleanup batch

8. **Call upload fixture test** — done
   - `lib/calls/upload-mapping.test.ts` covers selected prospect mapping and participant dedupe.
   - Upload route now delegates selected-contact/dedupe logic to `lib/calls/upload-mapping.ts`.

9. **Scout/contact search fixture test** — done
   - `lib/contacts/search-planner.test.ts` covers normalized, forward, reversed, multi-word, and deduped search planning.
   - Contact search route now delegates query planning to `lib/contacts/search-planner.ts`.

10. **MasterSuite sync smoke health** — done
   - `lib/mastersuite/health.test.ts` covers required env checks without running heavy sync.
   - `lib/mastersuite/health.ts` provides reusable non-heavy health helpers.

11. **Read-only DB smoke checks** — done
   - `scripts/db-smoke.ts` checks contact search, journey lookup, call participant mapping, active KB docs, and MasterSuite sync history.
   - `npm run db:smoke` is wired into `npm run release:check`.

## Medium refactors

12. **Typed env module** — done
   - `lib/env.ts` is now the canonical env contract and powers `scripts/check-env.ts`, Supabase server env access, and MasterSuite DB client env access.

13. **Gradual typed Supabase helper** — done
   - `createTypedServerClient()` is available for new/refactored modules while legacy `createServerClient()` remains untyped until stale-column debt is burned down.

14. **MasterSuite cron concurrency lock** — done
   - `withCronLogging` now skips overlapping active runs after stale-running cleanup.
   - `lib/mastersuite/cron-lock.test.ts` covers lock timing.

15. **Route-level API coverage** — done
   - Added contacts search, call upload validation, and admin sync-status route tests.

16. **CI release gate alignment** — done
   - CI now runs env contract check with safe dummy env, type-check, cleanup tests, lint, full tests, and secret-backed DB drift when available.

## Remaining medium refactors

17. **Call domain consolidation**
   - Keep participant matching, call classification, AI generation, and review-package rules under `lib/calls`.
   - Reduce duplicated route-level logic.

18. **Scout domain split**
   - Separate prompt/context loading, tool schemas, tool execution, and client loop with clearer file names and tests.

19. **MasterSuite sync boundary** — done
   - `docs/mastersuite-sync-boundaries.md` maps each MasterSuite sync entry point, source tables, destination tables, and idempotency/conflict key.
   - Sync routes now have a documented boundary: authenticate/window/record metadata only; transformation and mapping stay under `lib/mastersuite`.

20. **Lint debt burn-down** — done
   - `npm run lint` now returns no warnings or errors.
   - Snapshot captured in `docs/lint-debt-snapshot.md`.
   - Future warnings should be fixed or intentionally documented immediately.

## Backburner

22. **`mastersuiteapp.com/frandev` proxy/deploy map**
   - Parked because original URL/login works and Ben is not needed for normal FranDev builds.
   - Revisit only when the domain/proxy becomes a product requirement.
