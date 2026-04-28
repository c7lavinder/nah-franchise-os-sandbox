# Privacy & Data Audit — Tier 0c

**Date:** 2026-04-27
**Branch:** `chore/data-privacy-audit`
**Scope:** Every file in the working tree (tracked + ignored visible on disk)

---

## Phase 1 — Working Tree Findings

### Customer data files

| File | Size | Records | Tracked by git? | Notes |
|---|---|---|---|---|
| `CT Contact Master - Sheet1.csv` | 579 KB | 1,389 | NO (gitignored via `CT Contact Master*`) | CRM export — names, emails, phones, addresses, deal sizes. Exists on disk only. |
| `FT Updated 4.7 - Sheet1.csv` | ~180 KB | 1,397 | **YES — TRACKED** | FranTrac CRM export — names, emails, phones, addresses, zip codes, deal sizes, assigned reps. Full PII. **CRITICAL: must remove from tracking.** |
| `data/owner-master-index-full.csv` | 3.6 KB | 80 | **YES — TRACKED** | Territory owner data — names, 10 email addresses, Eclipse drive IDs. Internal business data. |

### Private business info

| File | What it contains | Sensitivity | Tracked? |
|---|---|---|---|
| `data/zorakle-master-final.json` | 83 Zorakle assessment records — personality scores, values types, sales scores. No emails/phones but linked to territory slugs. | Medium — franchise assessment data | YES |
| `data/corey-zorakle-integration-spec.md` | Internal spec for Zorakle integration | Low — technical spec, no PII | YES |
| `data/.import-progress.json` | CRM client IDs used during data import | Low — IDs only, no PII | YES |
| `data/.creation-date-progress.json` | CRM client IDs for creation date import | Low — IDs only, no PII | YES |
| `migration/pipeline-update-log.md` | Changelog of pipeline schema changes | Low — internal dev notes | YES |

### Credentials / secrets in source code

| Location | Type | Action needed |
|---|---|---|
| `.env.local` | Real API keys (Supabase, Anthropic, GHL, OpenAI) | SAFE — gitignored via `.env*.local` |
| `.env.local.example` | Placeholder values only | SAFE — correctly tracked with dummy values |
| `tests/critical-paths/api-fetch.test.ts` | `eyJhbGciOiJFUzI1NiJ9.test` | SAFE — mock test token, not a real key |
| Source code (`*.ts`, `*.tsx`) | Scanned for `sk-ant-`, `sk-proj-`, hardcoded API keys | CLEAN — no hardcoded secrets found |

**No hardcoded credentials found in any source code file.** All real secrets are in `.env.local` (gitignored).

### Orphaned data directories

**`data/` (5 files, all tracked):**
- `owner-master-index-full.csv` — 80 territory owner records with 10 real email addresses. **Should be in Supabase, not repo.**
- `zorakle-master-final.json` — 83 Zorakle assessment records. Already imported to Supabase (`zorakle_profiles` table). **Candidate for deletion.**
- `corey-zorakle-integration-spec.md` — Internal spec. Could move to `docs/` or delete (obsoleted by working code).
- `.import-progress.json` — One-time import tracking. **Safe to delete.**
- `.creation-date-progress.json` — One-time import tracking. **Safe to delete.**

**`migration/` (1 file, tracked):**
- `pipeline-update-log.md` — Dev notes about pipeline schema changes. Superseded by `supabase/migrations/`. **Safe to delete.**

### .gitignore gaps

Current `.gitignore` has:
- `CT Contact Master*` — covers the known CSV
- `.env*.local` — covers real env files
- Standard Next.js / Node patterns

**Missing:**
- No wildcard for `*.csv` at repo root or in `data/`
- No coverage for `*.xlsx`, `*.xls`
- `data/` directory not gitignored
- `FT Updated 4.7 - Sheet1.csv` not covered by any rule
- No `exports/` or `dumps/` protection

---

## Phase 1 Summary

### CRITICAL (must fix)

1. **`FT Updated 4.7 - Sheet1.csv` is tracked by git** — 1,397 real prospect records with full PII (names, emails, phones, addresses, deal sizes). This is in the git history and visible to anyone with repo access.

2. **`data/owner-master-index-full.csv` is tracked by git** — 80 territory owner records with 10 real email addresses.

### HIGH (should fix)

3. **`.gitignore` has no wildcard CSV protection** — only covers `CT Contact Master*` specifically. Any new CSV export dropped at repo root would be tracked.

4. **`data/` directory is fully tracked** — import artifacts, assessment data, and business specs all in git history.

### LOW (cleanup)

5. **`migration/` orphaned** — 1 file, superseded by `supabase/migrations/`.
6. **`data/` import progress files** — one-time artifacts, safe to delete.

### CLEAN

- No hardcoded secrets in source code
- `.env.local` properly gitignored
- `.env.local.example` has placeholders only
- No customer call transcripts in flat files (they're in Supabase `call_transcripts` table)

---

**STOP — awaiting Corey approval before Phase 2 (git history scan) and Phase 3 (execution).**
