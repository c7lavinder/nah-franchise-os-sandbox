# Session Handoff — 2026-05-11 — Session 35

## Status

Phase: Territory Alignment + PTO Prospect Sync / Health: Green / Duration: full session

## What Was Built This Session

### Territory Slug Alignment with MasterSuite

- Audited all 88 MasterSuite territories vs 99 Supabase territories
- Migrated 3 mismatched slugs: KISSMEE→KSSMEE, NORVM→NORVMI, RALNHC→RALHNC
- Moved JPS rows, territory_owners, call_territories to correct slugs
- Deactivated 3 old slugs (now inactive)
- Created territory_owners records for 5 new territories (ALCHUA, MONMTH, NOWTNJ, SASOTA, WICHTA)
- Assigned territories to journeys for 4 new franchise owners
- Added SASOTA to Erik Spersrud's journey (new territory, retiring INDYNW)

### Territory Details Tab

- `components/territories/tabs/DetailsTab.tsx` — new tab on territory page
- 6 sections: Owner & Contact, Address, Business, Key Dates, Marketing, Compliance & Accounts
- Displays all MasterSuite-synced fields (PersonalName, FranchiseEmail, phone, coach, legal entity, marketing info, Nexa/Vonage accounts, compliance score, etc.)
- No extra API call — uses existing territory data already returned by the API

### PTO Prospect Import (Backfill)

- Imported 231 prospects from MasterSuite `PathToOwnershipEntries` into Supabase
- Each gets: contact record (with full PTO info), journey, journey_contacts, JPS in Follow-up → Nurture
- Spam/bot filtering: blocks placeholder names (Alice/John), random character gibberish, do-not-respond emails, iPhone scam submissions
- Generated `pto_<id>_<random>` placeholder GHL IDs for contacts without GHL records

### PTO Prospect Sync (Ongoing)

- `lib/mastersuite/sync-pto-prospects.ts` — sync module with spam filtering, email dedup, incremental by date
- `app/api/cron/sync-ms-prospects/route.ts` — cron endpoint, checks last 7 days of PTO entries
- New prospects go into Path to Ownership → Engagement stage
- Registered in `vercel.json` (every 15 minutes) and cron settings panel

### Territory Cards Default Fix

- `app/api/pipeline/territory-cards/route.ts` — default to active-only (was showing all 99, now shows 64 matching MasterSuite)

### Property Data Verification

- Full audit: all 4 property tables match exactly (49,966 properties, 49,965 calculations, 49,957 inventory, 117,308 status history)
- Contact info audit: 97% PersonalName coverage, 98% FranchiseEmail, 94% phone — all gaps match MasterSuite source

## What Is Confirmed Working

- `npx tsc --noEmit` passes clean (0 errors)
- 129 tests passing
- All territory slugs aligned with MasterSuite (0 mismatches, 0 missing)
- All 64 active territories have owner records (except ALTA/GLOBAL/TRAIN — admin accounts)
- Property data 100% synced across all 4 tables
- 231 PTO prospects imported with full contact info
- Territory Details tab renders all MasterSuite fields
- Territory cards default to 64 active (matches MasterSuite Active=1 count)

## What Is Broken or Incomplete

- 4 territories missing address/phone in MasterSuite source (MYTBCH, OAKRTN, RALHNC, WICHTA) — needs MS data entry — Low
- MarketingEmailAddress only 47% populated across territories — needs MS data entry — Low
- PTO prospects have placeholder GHL IDs (`pto_*`) — need real GHL contact creation or GHL sync — Medium

## Decisions Made

- Old slugs (KISSMEE, NORVM, RALNHC) deactivated, not deleted — Corey
- Existing PTO backfill → Nurture stage; new incoming PTO → Engagement stage — Corey
- Prospect sync every 15 minutes — Corey
- ALTA/GLOBAL/TRAIN are admin accounts, no owner record needed — Corey
- SASOTA is Erik Spersrud's new territory (retiring INDYNW, moved to FL) — Corey

## Files Created

- `components/territories/tabs/DetailsTab.tsx`
- `lib/mastersuite/sync-pto-prospects.ts`
- `app/api/cron/sync-ms-prospects/route.ts`
- `scripts/audit-territories.ts`
- `scripts/audit-territories-phase2.ts`
- `scripts/audit-territory-properties.ts`
- `scripts/fix-territory-alignment.ts`
- `scripts/import-pto-prospects.ts`

## Files Modified

- `app/(auth)/territories/[TerritorySlug]/page.tsx`
- `app/api/pipeline/territory-cards/route.ts`
- `app/api/settings/cron-jobs/route.ts`
- `vercel.json`

## Files Deleted

- None

## Open Issues Carried Forward

- PTO prospects need real GHL contact creation or sync — Medium
- Wire Scout to query ms\_\* tables for coaching intelligence — Medium
- Phase 3 supporting table sync (mortgages, comparables, royalty, etc.) — Medium
- Remove debug-performance endpoint — Low
- Scorecard actuals trailing-3-month filtering — Medium
- pgvector embeddings need backfill for RAG — Medium (from session 31)
- Rate limiter needs Redis for durability at scale — Low (from session 31)

## Exact Next Step

Wire Scout to query ms_properties and performance data so it can coach franchisees with real territory context, or create real GHL contacts for the 231 PTO prospects so they flow into the full pipeline.

## Copy This To Start Next Session In Claude.ai

---

Read this file then tell me: current status, last session summary, open issues, what we build today.
GitHub: https://github.com/c7lavinder/nah-franchise-os-sandbox/blob/main/SESSION_START.md
Then: Wire Scout to query ms_properties and performance data so it can coach franchisees with real territory context, or create real GHL contacts for the 231 PTO prospects so they flow into the full pipeline.

---
