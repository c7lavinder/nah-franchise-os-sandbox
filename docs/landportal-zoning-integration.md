# LandPortal + Zoning Codes Integration Plan

> Status: Phase 1 shipped 2026-07-14 (this branch). Owner: acquisition tooling.
> Origin: LandPortal launch meeting 2026-07-14 — LandPortal supplies land-lead
> lists (vacant lots, tear-downs, subdividable parcels) but explicitly does NOT
> model zoning setbacks or jurisdictional restrictions. This plan closes that gap.

## The pipeline, end to end

```
LandPortal export (CSV, pre-skip-traced, 8¢/lead)
        │
        ▼
MasterSuite bulk import  ── LandPortal lead type + land columns ──▶ PostcardMania mail
        │                                                            (existing rails)
        ▼
Zoning pre-screen (this repo)
  parcel zoning code (REAPI) → jurisdiction → district rules → pass/fail/unknown
        │
        ▼
Only "pass" (and reviewed "unknown") leads get marketing spend
```

## Phase 1 — shipped

### MasterSuite (repo: mastersuite, same branch)

- `LandPortal` added to `DataSources` and `PropertyLeadTypes` (+ seeded into the
  `LeadTypes` table under the Lists category via migration
  `2026-07-15-122_LandPortalLandFields.sql`).
- Bulk import CSV accepts five optional land columns — `LotSizeAcres`,
  `BuildabilityPercent`, `FloodZonePercent`, `WetlandPercent`, `LandPortalUrl`
  (the per-property hyperlink the team uses to tag properties for dispo).
  Values land on `Stage0[MANUAL].LotSizeAcres` and new `PropertyDataEntry`
  columns. Columns are optional, so existing vendor CSVs are untouched.

### This repo

- Migration `20260714120000_zoning_codes_foundation.sql`:
  - `jurisdictions` — municipalities/counties under a territory (a territory
    spans several; parcels must match the right one).
  - `zoning_documents` — stored ordinance/plan docs with `effective_date`
    (staleness tracking) and `extracted_text` (extraction + future RAG).
  - `zoning_districts` — the structured rule table (min lot size, setbacks,
    frontage, min dwelling sqft, ADU/septic…), with an
    `extraction_status: ai_extracted → verified` review workflow.
- `lib/zoning/`:
  - `types.ts` — district rules, parcel facts, pre-screen results.
  - `extract-districts.ts` — Claude extraction of district rule tables from
    ordinance text (reuses `lib/documents/extract.ts` text-extraction; rows are
    `ai_extracted` until a human verifies — DRC applies).
  - `prescreen.ts` — pure rule-check: min lot size, road frontage, buildable
    envelope (LandPortal buildable acreage minus setbacks vs planned
    footprint), district use category. Unit-tested.

## Phase 2 — next

1. **API routes + admin UI** (`app/api/zoning/*`): CRUD for jurisdictions and
   districts, ordinance upload (Supabase storage → `extractText` →
   `extractZoningDistricts` → review queue), verify/reject flow.
2. **Batch pre-screen endpoint**: accept a LandPortal export (or MasterSuite
   batch id), join parcels to district rules via the REAPI `zoning` field, and
   return per-parcel verdicts — run BEFORE skip-trace/mail spend.
3. **Regenerate `types/supabase.ts`** (needs supabase CLI against the project)
   so the new tables are typed.
4. **Seed core markets**: 5–15 districts per market where NAH actually buys
   (R-1/R-2/R-3 equivalents), starting with TN/NC/SC territories.

## Phase 3 — later

- **RAG over ordinance text**: extend the existing embeddings pipeline
  (`lib/rag/`) with a territory/jurisdiction scope so Scout can answer
  "what are the side setbacks in R-2 in Kingsport?" with citations. Deferred to
  keep this change out of the contact-scoped `embeddings` table.
- **Land-residual valuation**: S2 quick-valuation (`POST /api/v1/quick-valuation`)
  for the as-completed new build → max lot offer = ARV − build cost − margin.
  S2 cannot value raw land, but it can price the finished product.
- **Planning-doc layer**: comprehensive plans / future land-use maps to guide
  which lists to pull next, not just which parcels pass today.

## Ground rules

- **Jurisdiction matching matters.** A parcel in unincorporated county land is
  governed by the county ordinance, not the nearest city's. Verify city limits
  (LandPortal overlays help) before trusting a match.
- **Staleness.** Every answer carries the document's `effective_date`.
  Quarterly re-check cadence per jurisdiction.
- **AI-extracted rows never gate spend.** Only `verified` districts should be
  used for automated pre-screening; `ai_extracted` rows surface in a review
  queue first.
- **Not legal advice.** The pre-screen kills obviously-dead leads before money
  is spent; deal-critical zoning questions still go to the planning office.
