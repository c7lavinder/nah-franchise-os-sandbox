# ADR-0011: Two Scoring Systems (Lead Score + Intelligence Score)

**Status:** Accepted
**Date:** 2026-04-30
**Context:** Tier 1 #7 — Scoring consolidation audit

## Decision

Keep the two scoring systems as separate, distinct tools. Do not merge.

## Context

The codebase has two parallel scoring systems that appeared to overlap:

1. **Lead Scoring** (`lib/profile/lead-scoring.ts`) — 0-100, weighted average of 6 factors
2. **Intelligence Scoring** (`lib/intelligence/scoring.ts`) — 0-100, four 25-point dimensions

After a full audit, they serve different purposes, use different data, and target different audiences.

## Comparison

| Aspect            | Lead Score                                 | Intelligence Score                      |
| ----------------- | ------------------------------------------ | --------------------------------------- |
| Question answered | "Is this a hot lead?"                      | "Can this person succeed?"              |
| Audience          | Sales reps (Chad)                          | Leadership (Matt, Corey)                |
| Pipeline stage    | Engagement → Discovery                     | Discovery → Awarding                    |
| Inputs            | Source, capital, territory, response speed | Zorakle, PFS, Trainual, DISC, call logs |
| Storage           | GHL custom fields                          | candidate_intelligence + score_history  |
| Audit trail       | None                                       | Full (every change logged)              |
| Triggers          | Manual / bulk cron                         | Event-driven + nightly cron             |

## Consequences

- Both files now have header comments explaining their distinct purpose and cross-referencing the other
- No code was merged or deleted
- Future: lead scores should be persisted in Supabase (currently GHL-only)
- Future: when a lead enters intelligence profiling, seed the intelligence score from the lead score
