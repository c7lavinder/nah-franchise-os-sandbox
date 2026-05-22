# Retrieval Brain — Phase 7+ Sprint Plan (Revised)

> **Purpose:** Close every remaining gap from `docs/retrieval-brain-gaps.md` + 5 structural additions identified in audit. Ship in sequenced phases.
> **Extends:** the 7-phase build completed in Sessions 50-52.
> **Format:** one phase = one Claude Code session (a few phases need two).
> **Revised:** Incorporates data gates, conditional phases, and scope corrections from plan review.

---

## 0. Pre-flight (read first, before any code)

Before Phase 7, read in order:

1. `docs/master-plan.md`
2. `docs/retrieval-brain-tracker.md`
3. `docs/retrieval-brain-gaps.md`
4. `docs/retrieval-brain-summary.md`
5. `handoff.md`

Report back to Corey:

- What was built last (Phases 0-6 summary)
- What gaps are open
- Phase 7 scope and any blockers

**Wait for explicit approval before writing any code.**

---

## 1. Phase 7 — Stabilization (1 session)

**Goal:** fix every critical gap + the fast significant gaps from the gaps doc. Plumbing fixes only — no brief system changes.

### Scope

- [ ] **Gap #1** — Wire `embedExternalResearch()` into `app/api/journeys/[journeyId]/documents/route.ts` after upload + text extraction.
- [ ] **Gap #2** — Add delete-before-embed step to `embedTranscript()` matching the `embedKBDoc()` pattern.
- [ ] **Gap #3** — Embedding health check: compare `call_transcripts` count to `embeddings WHERE content_type = 'transcript'`. Surface delta in admin dashboard. Add `repair-embeddings` admin endpoint.
- [ ] **Gap #5** — Pass `pageContext.contactId` into `prefetchContext()` and scope transcript/document searches when available.
- [ ] **Gap #7** — Add `contextualizeJournalChunk()`. Prepend contact name + journal date.
- [ ] **Gap #8** — Expand `embedExternalResearch()` to accept and prepend contextual metadata (contact name, document title, document type).
- [ ] **Gap #9** — Single `hybridSearch` call with rerank in `prefetchContext`. Remove the double-rerank path.

### Moved to Phase 8

- **Gap #6** (embed briefs) and **Gap #14** (on-demand brief regen) — both touch the brief system and affect retrieval quality. Better to ship these right before the eval baseline so the baseline reflects the improved briefs.

### Verification

- `npx tsc --noEmit` clean
- `npx next build` clean (ESLint gate — this is the real Vercel gate)
- `npx vitest run` clean
- Manual: upload a test document, verify it embeds and surfaces in `search_documents`
- Manual: re-embed a transcript, verify old chunks deleted first

### Commit pattern

One commit per gap, prefix `fix(retrieval):` — e.g. `fix(retrieval): embed uploaded documents on upload (gap #1)`.

---

## 2. Phase 8 — Trust & Measurement (1 session)

**Goal:** improve brief freshness, embed brief content, then lock the eval baseline. Everything after this phase is measured against it.

### Scope

- [ ] **Gap #6** — Embed brief summaries as `profile_summary` content type. Re-embed on regeneration.
- [ ] **Gap #14** — Detect stale brief in `get_entity` and regenerate inline (1-2s).
- [ ] **Source attribution** — Pass `source_id` from chunk metadata through to Scout's response. Render as clickable citations: `[1]` linking to transcript or KB doc URL. Apply to all three search tools (`search_knowledge`, `search_transcripts`, `search_documents`).
- [ ] **Eval framework** — Build held-out eval set. Start with **20 Q&A pairs** across the 9 question types (2-3 per type). Each pair: question text, expected entities, expected content types, gold-standard answer key, expected citation source IDs. Run as `npm run eval:retrieval`. Output: scores per question type.
  - Write initial answers from real data in the system.
  - **Corey validates** the 20 gold answers before locking as baseline.
  - Expand to 50 over time as edge cases emerge — do NOT block Phase 9 on 50.
- [ ] **Gap #17** — Add `model_version` column to embeddings table. Populate on insert. Enables selective re-embedding when models change.

### Verification

- Run eval set, log baseline scores per question type — lock these as Phase 8 baseline
- Generate Scout response with citations, verify each `[N]` link resolves
- `npx tsc --noEmit` + `npx next build` + `npx vitest run` clean

### Why this phase before predictive work

Every phase after this is guesswork without eval. Don't ship Phases 9-13 without this measurement layer.

---

## 3. Phase 9 — Cross-call & Cross-rep Intelligence (1-2 sessions)

**Goal:** turn the call corpus into memory that knows what was promised, what changed, and what other reps saw.

### Scope

- [ ] **Commitment tracker**
  - Add `commitments_made` as a category in the post-call extraction agent
  - New `commitments` table: `contact_id`, `made_by_user_id`, `commitment_text`, `due_date`, `status` (pending/fulfilled/overdue), `source_call_id`
  - Migration follows existing convention: `supabase/migrations/YYYYMMDDHHMMSS_create_commitments.sql`
  - Extract from each new transcript automatically
  - Backfill from existing 70 transcripts — **use Haiku** for extraction, structured JSON output, budget ~$2
  - Surface in `get_next_action` recommendations
- [ ] **Cross-call analytics** — Add to `get_entity(contact)` response:
  - Call-over-call grade trend (improving/flat/declining)
  - Recurring objection detection (same type across 2+ calls)
  - Response time trend (between scheduled and completed)
  - Total call time invested in this prospect
- [ ] **Cross-rep signal** — When a call extraction creates a yellow/red flag, surface in the NEXT pre-call brief for ANY rep about the same contact. (Matt finds it -> appears in Sam's brief.)

### Pre-flight

- Confirm `schema_migrations` table is current and all prior migrations are tracked
- Verify existing post-call extraction agent output format before adding `commitments_made` category

### Verification

- Manual: log a commitment with a 3-day due date on a test contact, fast-forward 5 days, verify it shows as overdue in `get_next_action`
- Eval framework: run with new pre-fetch chain, verify call-prep scores improve
- `npx tsc --noEmit` + `npx next build` + `npx vitest run` clean

---

## 4. Phase 10 — Predictive Lookalike Models (1-2 sessions)

**Goal:** ship predictive models trained on the franchisee dataset (sales-side + MasterSuite performance data). **Conditional on data sufficiency.**

### Pre-flight data audit (GATE — do this BEFORE writing any model code)

- [ ] Count converted contacts with full enough profiles to be useful features. **Need >= 30.**
- [ ] Count lost contacts (excluding Nurture and Re-engaged). **Need >= 30.**
- [ ] Count franchisees with T12 metrics for performance tiering. Check distribution across tiers — **each tier needs >= 10.**
- [ ] Document counts in `docs/phase-10-data-audit.md`.

**If either gate fails:** skip the ML model for that use case. Build a rule-based scoring system instead (weighted feature checklist). Still useful, much more robust with small data. Document the decision in an ADR.

### Session 1 — Shared foundation + sales model (if gate passes)

- [ ] Build `lib/predictive/feature-pipeline.ts` — pulls profile + call + MasterSuite features into a single feature vector per contact. Normalize, handle missing fields.
- [ ] Build `lib/predictive/training.ts` — logistic regression in pure TS. No ML infra. Outputs probabilities + feature importances.
- [ ] **Train sales model:** positives = converted franchisees' pre-conversion profiles; negatives = lost prospects.
- [ ] Output: `close_probability` (0-1) + `top_3_drivers` per contact.
- [ ] Store in `candidate_intelligence` table.
- [ ] Wire into pre-call brief Section 7 (Prediction snapshot).

### Session 2 — Performance model + wire-up (if gate passes)

- [ ] **Train performance model:** tier franchisees by T12 metrics (top/middle/struggling). Train on profile + EOS + early-90-day signals.
- [ ] Output: `performance_tier_prediction` + `gap_to_top_performer` feature vector.
- [ ] Store in new `territory_intelligence` table.
- [ ] Wire into territory briefs + coaching briefs.
- [ ] Surface "what top performers do that this franchisee doesn't" in coaching recommendations.

### Verification

- Cross-validation: hold out 20% of franchisees, predict, compare to actuals. Log accuracy.
- Eval framework: run with predictions in context, verify prediction-related question scores improve.
- `npx tsc --noEmit` + `npx next build` + `npx vitest run` clean

### Note

This is a logistic regression, not a deep model. Don't over-engineer. Pure TS, runs in Supabase functions or post-call agent. No new infra.

---

## 5. Phase 11 — Graph Layer (CONDITIONAL — 1-2 sessions)

**Goal:** build Layer 3 of the hybrid model — typed relationship edges. **Only if Phase 10 eval shows vector-only lookalikes are insufficient.**

### Gate

After Phase 10 ships, run the eval framework. Test: "Which prospects look like our top converted franchisees?" and similar lookalike queries.

- **If vector-only relevance scores >= 75%:** defer graph layer. Vector similarity is sufficient with this data size. Revisit when contact count exceeds 500.
- **If vector-only relevance scores < 75%:** build the graph layer as specified below.

### Scope (only if gate triggers build)

- [ ] Create `relationships` table:
  ```sql
  CREATE TABLE relationships (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id uuid NOT NULL,
    source_type text NOT NULL,
    target_id uuid NOT NULL,
    target_type text NOT NULL,
    relation_type text NOT NULL,
    confidence numeric(3,2),
    source_call_id uuid,
    metadata jsonb,
    created_at timestamptz DEFAULT now()
  );
  CREATE INDEX idx_rel_source ON relationships(source_id, source_type);
  CREATE INDEX idx_rel_target ON relationships(target_id, target_type);
  CREATE INDEX idx_rel_type ON relationships(relation_type);
  ```
- [ ] Edge types (initial): `mentioned`, `matched_to`, `lookalike_of`, `rejected`, `converted_after`, `compared_to`, `referred_by`.
- [ ] Build `lib/graph/edge-generator.ts` — extracts typed edges from existing call transcripts via LLM extraction (Haiku).
- [ ] Build `lib/graph/lookalike.ts` — multi-hop traversal: given a contact, return top N lookalikes ranked by `(edge_weight x vector_similarity)`.
- [ ] Wire into Scout: new tool `find_lookalikes(contact_id, limit, edge_filter?)`.
- [ ] Backfill edges from 70 existing transcripts.

### Verification

- Query: "Which prospects look like our top converted franchisees?" returns a ranked list with reasoning.
- Eval: graph-based lookalike beats pure vector baseline by >= 10% on relevance scoring.
- `npx tsc --noEmit` + `npx next build` + `npx vitest run` clean.

---

## 6. Phase 12 — External Enrichment (1 session, plus vendor signup)

**Goal:** build the Researcher role — Scout knows things about prospects beyond what was typed.

### Prerequisites (Corey action)

- [ ] **Corey signs up for Clay.com** ($149/mo Starter). Apollo as fallback if cost-sensitive.
- [ ] **API key added to environment variables.**

### Scope

- [ ] Build `lib/enrichment/clay-client.ts` — wraps Clay REST API.
- [ ] **Trigger enrichment from NAH OS contact creation route** (`app/api/contacts/create`), NOT from a GHL webhook. GHL webhooks are not active and adding that dependency is unnecessary — NAH OS controls contact creation.
- [ ] Map enriched fields to existing 199 profile fields (LinkedIn role, work history, estimated net worth signals, social presence, public business records).
- [ ] Add new source type: `enrichment` (alongside `manual` / `api` / `ai` / `ai-auto`).
- [ ] Background re-enrichment cron: weekly refresh on active prospects only (Sales pipeline, not Nurture).
- [ ] Surface enriched fields in pre-call brief Section 1 (Who is this person).

### Verification

- Manual: create a test contact via NAH OS, verify profile fills with enriched data within 30 minutes.
- Eval: run prospect questions, verify Scout references enriched data.
- `npx tsc --noEmit` + `npx next build` + `npx vitest run` clean.

---

## 7. Phase 13 — Refinement (1 session)

**Goal:** close remaining moderate/low gaps. Pure cleanup — no new features.

### Scope

- [ ] **Gap #4** — Replace regex classifier with Haiku-powered classifier (~50ms, structured JSON output, multi-intent support).
- [ ] **Gap #10** — Add `territory_slug` parameter to `search_transcripts`.
- [ ] **Gap #11** — Adaptive chunking (split on speaker turns for transcripts, on `##` headers for KB docs).
- [ ] **Gap #12** — Custom Postgres text-search dictionary for NAH terms (FDD, ARV, NDA, EOS, PFS, Trainual, MasterSuite, Zorakle, ROBS, FA, FF, PTO).
- [ ] **Gap #15** — Replace 4-chars-per-token heuristic with proper tokenizer (tiktoken or Anthropic token counter).
- [ ] **Gap #18** — System-prompt token budget cap; auto-reduce pre-fetch when total > 50K.
- [ ] **Gap #19** — Smart re-embed by `model_version` (built in Phase 8). No more all-or-nothing.

### Verification

- Eval framework: full run, compare to Phase 8 baseline.
- `npx tsc --noEmit` + `npx next build` + `npx vitest run` clean.

---

## 8. Phase 14 — Daily HQ (2 sessions)

**Goal:** build the proactive Daily HQ — Chad's morning operating screen. This is a full feature, not a refinement.

### Session 1 — Data aggregation + API

- [ ] Build `lib/daily-hq/aggregator.ts` — pulls and merges:
  - Today's calls with auto-generated pre-call briefs
  - Overdue commitments (from Phase 9)
  - Escalating risk flags (from cross-call detection)
  - Territory alerts (from Phase 10 performance model, or rule-based if Phase 10 went rule-based)
  - Predicted close probability changes since last week
- [ ] API route: `app/api/daily-hq/route.ts` — returns the full daily brief as JSON
- [ ] All wired from existing data — no new infra

### Session 2 — UI + KB automation

- [ ] Daily HQ page at `/daily-hq` — one screen, 5+ actionable signals
- [ ] **Auto-generated KB from A-graded calls** — When a call grades A on a rubric criterion, extract the approach via LLM, draft as `suggested` KB entry, queue for admin review before publishing.
- [ ] **KB freshness monitor** — Flag KB docs >90 days old with zero retrievals in `scout_retrieval_logs`.
- [ ] **Gap #20 finalization** — Source attribution inline-link rendering polish (core attribution shipped in Phase 8).

### Verification

- Eval framework: full run, expect >= 20% improvement vs Phase 8 baseline across all question types.
- Manual: Chad opens Daily HQ, sees >= 5 actionable signals.
- `npx tsc --noEmit` + `npx next build` + `npx vitest run` clean.

---

## 9. Gaps explicitly deferred

| Gap                           | Reason                                                                                                                                                                  | Revisit when                                                               |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| #13 — Retrieval feedback loop | Large effort, requires post-response analysis comparing Scout's answer text to pre-fetched chunks. Value is real but depends on having enough retrieval log data first. | After 500+ `scout_retrieval_logs` entries exist. Could be a Phase 15 item. |
| #16 — Multi-language support  | NAH operates in English. Zero current need.                                                                                                                             | If franchise expands internationally.                                      |

---

## 10. Cross-cutting guardrails (every phase, no exceptions)

- **Read-only audit FIRST** — Commit a `phase-N-audit.md` to `docs/` before any code is written.
- **One commit per logical change.**
- **`npx tsc --noEmit` clean before each commit.**
- **`npx next build` clean before each commit.** (ESLint errors block Vercel — this is the real gate.)
- **`npx vitest run` clean before each commit.**
- **Dry-run all migrations** before executing on production.
- **Follow migration naming convention:** `supabase/migrations/YYYYMMDDHHMMSS_*.sql`
- **Confirm `schema_migrations` is current** at the start of any phase that creates new tables (Phases 9, 10, 11, 14).
- **No push to main without explicit Corey approval.**
- **Update `docs/retrieval-brain-tracker.md`** at end of every session.
- **Update `handoff.md`** at end of every session.
- **Never delete code without auditing it's truly dead** (recall the 13/30 GHL functions lesson).

---

## 11. Definition of done (entire Phase 7-14 plan)

- All 20 gaps from `docs/retrieval-brain-gaps.md` resolved or explicitly deferred with documented reason
- All 5 structural additions shipped (eval framework, source attribution, predictive models, enrichment, Daily HQ)
- Graph layer shipped OR explicitly deferred based on Phase 10 eval gate
- Eval framework scores >= 20% above Phase 8 baseline
- Daily HQ proactively surfaces >= 5 actionable signals per day for Chad
- Scout response includes citations on every factual claim
- `docs/master-plan.md` updated to reflect post-Phase-14 state

---

## 12. Estimated scope

- **8 phases** (7-14), with Phase 11 conditional
- **9-12 Claude Code sessions** (fewer if Phase 11 is skipped)
- **6-8 weeks** at 1-2 sessions per week
- **Biggest:** Phase 10 (predictive, 2 sessions) + Phase 14 (Daily HQ, 2 sessions)
- **Cheapest:** Phase 7 (stabilization, all plumbing fixes in 1 session)
- **Could be skipped:** Phase 11 (graph layer, conditional on eval gate)
- **Vendor cost added:** Clay.com ~$149/mo from Phase 12 forward

---

## 13. Phase order is intentional — don't reorder

| Phase                    | Why this order                                                |
| ------------------------ | ------------------------------------------------------------- |
| 7 — Stabilize            | Fix broken plumbing before building new floors                |
| 8 — Trust & Measurement  | Need eval + better briefs before measuring later phases       |
| 9 — Memory               | Cross-call/cross-rep enriches predictive features in Phase 10 |
| 10 — Predict             | Uses Phase 9 features + MasterSuite + Phase 8 eval            |
| 11 — Graph (conditional) | Only if Phase 10 lookalikes need typed edges to improve       |
| 12 — Enrich              | Adds external fields that retroactively improve everything    |
| 13 — Refine              | Close moderate gaps with all prior infrastructure in place    |
| 14 — Daily HQ            | Final feature — proactive wiring on top of all above          |

---

## 14. Next session kickoff prompt (copy this verbatim to Claude Code)

```
Read docs/master-plan.md, docs/retrieval-brain-tracker.md,
docs/retrieval-brain-gaps.md, docs/retrieval-brain-summary.md,
then handoff.md. Then read docs/retrieval-brain-phase-7-plan.md.

Tell me:
- What was built in Phases 0-6
- Which gaps are open
- Phase 7 scope (Stabilization)
- Any blockers or concerns before starting

We are starting Phase 7 — Stabilization. Goal: close all critical
and significant plumbing gaps in one session.

Wait for explicit approval before writing any code.
```

---

**END OF PHASE 7+ PLAN (REVISED)**
