# FranDev Cleanup Backlog

This backlog turns the cleanup plan into execution-sized tasks. Keep changes small and shippable.

## Now / quick wins

1. **One-command validation** — done via `npm run check` and `npm run release:check`.
2. **Runtime pinning** — done via `.nvmrc` and `package.json` engines.
3. **Production smoke checks** — done via `npm run smoke:prod`.
4. **Domain ownership map** — done via `docs/domain-map.md`.
5. **DB workflow doc/drift scaffold** — done via `docs/db-schema-workflow.md` and `npm run db:drift`.

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

8. **Call upload fixture test**
   - Fixture: transcript + selected prospect.
   - Assert call maps to selected contact/journey and dedupes participants.

9. **Scout search fixture test**
   - Fixture: reordered/imperfect name query.
   - Assert route/tool returns likely prospect/journey link.

10. **MasterSuite sync smoke health**
   - Add a non-heavy health/status endpoint or script that checks env/connectivity without running full sync.

## Medium refactors

11. **Typed env module**
   - Move direct `process.env` reads behind a small validated env helper.
   - Start with Supabase, MasterSuite, auth, and cron env.

12. **Call domain consolidation**
   - Keep participant matching, call classification, AI generation, and review-package rules under `lib/calls`.
   - Reduce duplicated route-level logic.

13. **Scout domain split**
   - Separate prompt/context loading, tool schemas, tool execution, and client loop with clearer file names and tests.

14. **MasterSuite sync boundary**
   - Ensure sync routes only orchestrate; transformation/mapping lives under `lib/mastersuite`.
   - Add per-sync docs for source tables and destination tables.

15. **Lint debt snapshot** — done
   - `npm run lint` passes with warnings only.
   - Snapshot captured in `docs/lint-debt-snapshot.md`.
   - Burn down warnings in small batches without blocking urgent production deploys.

## Backburner

16. **`mastersuiteapp.com/frandev` proxy/deploy map**
   - Parked because original URL/login works and Ben is not needed for normal FranDev builds.
   - Revisit only when the domain/proxy becomes a product requirement.
