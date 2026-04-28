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

---

## Phase 2 — Git History Findings

**Date:** 2026-04-27
**Method:** `git log --all --diff-filter=A`, blob size analysis, per-branch tree scan

### Key result: No .env or credential files ever committed

- Only `.env.local.example` (with placeholder values) was ever committed.
- No `.env`, `.env.local`, `.env.production` ever tracked.
- No `sk-ant-*`, `sk-proj-*`, or real API keys found in any committed source file.
- Seed SQL migrations contain no real secrets — only config values and schema DDL.

**No credential rotation needed.** This is a significant positive finding.

### Files in history but not in current tree

| File | First committed | Deleted in | Size in history | PII risk |
|---|---|---|---|---|
| `CT Contact Master - Sheet1.csv` | `186d19e` (2026-03-25) | `3bb15a1` (2026-03-25) | 565 KB | CRITICAL — 1,389 real contacts with names, emails, phones, addresses |

Committed and deleted on the same day. Gitignored via `CT Contact Master*` afterward. But the 565 KB blob is permanently in git history.

### Files in history AND current tree (PII-heavy)

| File | First committed | Total commits | Size | PII risk |
|---|---|---|---|---|
| `FT Updated 4.7 - Sheet1.csv` | `6e89005` (2026-04-07) | 1 | 567 KB | CRITICAL — 1,397 prospects: names, emails, phones, addresses, deal sizes |
| `data/owner-master-index-full.csv` | `4589ca1` (2026-04-09) | 1 | 3.6 KB | MEDIUM — 80 territory owners, 10 with real email addresses |
| `data/zorakle-master-final.json` | `4589ca1` (2026-04-09) | 1 | 35 KB | LOW — personality assessment scores, no direct PII |
| `data/.import-progress.json` | committed | 1 | 22 KB | LOW — CRM IDs only |
| `data/.creation-date-progress.json` | committed | 1 | 15 KB | LOW — CRM IDs only |

### Branches containing sensitive files

| Branch | Sensitive files |
|---|---|
| `main` | `FT Updated 4.7 - Sheet1.csv`, `data/owner-master-index-full.csv` |
| `origin/main` | same |
| `origin/feat/call-mapping-v2` (stale) | same |
| `chore/data-privacy-audit` (current) | same |

### Largest blobs in repo history

The **two largest objects** in the entire git repository are customer data files:
1. `FT Updated 4.7 - Sheet1.csv` — 567 KB
2. `CT Contact Master - Sheet1.csv` — 565 KB

Everything else is `package-lock.json` (expected).

---

## Recommended History Scrub

### Verdict: YES — scrub recommended

**Reasoning:**
- Two customer data files totaling 1,132 KB with 2,786 real prospect records (names, emails, phones, addresses) are permanently in git history.
- Even after `git rm` from the working tree, anyone who clones the repo or has a local copy can recover the full files from history.
- The repo is on GitHub (private, but shared with future contributors).
- No credential rotation needed (no secrets were ever committed), so the scrub scope is limited to data files only.

### Tool recommendation: `git filter-repo`

`git filter-repo` (modern, maintained, recommended by Git project) over BFG Repo-Cleaner (legacy, unmaintained). Install: `pip install git-filter-repo` or `brew install git-filter-repo`.

### Scope — files to scrub

```
CT Contact Master - Sheet1.csv
FT Updated 4.7 - Sheet1.csv
data/owner-master-index-full.csv
data/.import-progress.json
data/.creation-date-progress.json
data/zorakle-master-final.json
```

### Estimated effort

- **Scrub execution:** ~5 minutes (small repo, few objects)
- **Coordination:** Force-push to GitHub. Only Corey has a clone, so no team coordination needed.
- **Post-scrub:** Everyone (just Corey) must `rm -rf` their local clone and re-clone fresh. Existing local branches will be orphaned.

### Steps (will execute only with Corey approval)

1. Install `git-filter-repo` if not present
2. Run `git filter-repo --invert-paths --path "CT Contact Master - Sheet1.csv" --path "FT Updated 4.7 - Sheet1.csv" --path "data/owner-master-index-full.csv" --path "data/.import-progress.json" --path "data/.creation-date-progress.json" --path "data/zorakle-master-final.json"`
3. Force-push all branches: `git push origin --force --all`
4. Delete stale remote branches: `origin/feat/call-mapping-v2`, `origin/phase-a-housekeeping`, `origin/sprint-0-bug-fixes`, `origin/sprint-1-supabase-schema`
5. GitHub: Settings → Actions → delete any cached artifacts
6. Verify: `git rev-list --objects --all | git cat-file --batch-check` — confirm blobs are gone
7. Re-clone fresh locally

### What does NOT need scrubbing

- No `.env` files were ever committed — no credential rotation needed
- SQL migrations are schema-only (no customer data)
- `data/corey-zorakle-integration-spec.md` — internal spec, not PII (can delete from working tree in Phase 3 without history scrub)
- `migration/pipeline-update-log.md` — dev notes, not PII (same)

---

---

## Phase 2.5 — History Scrub (executed)

**Date:** 2026-04-27
**Tool:** `git-filter-repo` (a40bce548d2c)
**Backup:** `/Users/coreylavinder/nah-franchise-os-sandbox-PRESCRUB-BACKUP-20260427`

### Files scrubbed from all history

| File | Pre-scrub size | Result |
|---|---|---|
| `CT Contact Master - Sheet1.csv` | 565 KB | 0 commits — gone |
| `FT Updated 4.7 - Sheet1.csv` | 567 KB | 0 commits — gone |
| `data/owner-master-index-full.csv` | 3.6 KB | 0 commits — gone |
| `data/.import-progress.json` | 22 KB | 0 commits — gone |
| `data/.creation-date-progress.json` | 15 KB | 0 commits — gone |
| `data/zorakle-master-final.json` | 35 KB | 0 commits — gone |

### Post-scrub verification

- Zero CSV files in any commit: confirmed
- Largest blobs are now `package-lock.json` (326 KB) — expected
- All commit SHAs rewritten (542 commits reprocessed in 0.65s)
- Force-pushed to GitHub: `50a8091...346b1ff main -> main`
- Stale remote branches deleted: `feat/call-mapping-v2`, `phase-a-housekeeping`, `sprint-0-bug-fixes`, `sprint-1-supabase-schema`

### GitHub cache caveat

Old commit SHAs may remain accessible via GitHub's API cache for up to 90 days. This is a GitHub platform limitation. Mitigation:
- New commits will naturally roll the cache
- Contact GitHub Support to expedite if needed
- The repo is private, limiting exposure

---

## Phase 3 — Working Tree Cleanup (executed)

**Date:** 2026-04-27

### Actions taken

| Action | File | Result |
|---|---|---|
| Deleted from disk | `CT Contact Master - Sheet1.csv` | Was gitignored but still on disk. Removed. |
| git rm | `data/corey-zorakle-integration-spec.md` | Obsolete internal spec |
| git rm | `migration/pipeline-update-log.md` | Superseded by `supabase/migrations/` |
| .gitignore | Added `*.csv`, `*.xlsx`, `*.xls`, `data/`, `exports/`, `secrets/` | Wildcard protection |

### Customer data import NOT needed

The CT Contact Master and FT Updated CSVs were CRM exports used as import reference data. The actual contact data already lives in Supabase (`contacts` table, synced via GHL integration). No re-import required.

---

## Phase 4 — Verification (passed)

| Check | Result |
|---|---|
| `git ls-files \| grep -iE "\.(csv\|xlsx\|env)$"` | Clean — zero matches |
| `git log --all --name-only \| grep -iE "\.(csv\|xlsx)$"` | Clean — zero matches |
| `npx tsc --noEmit` | Clean — zero new errors |
| `.gitignore` covers `*.csv`, `data/`, `.env*` | Verified via `git check-ignore -v` |

---

## Phase 5 — Policy (documented)

Data handling policy added to `docs/security.md`:
- Never commit customer data, credentials, or personal info
- .gitignore wildcard protection is non-negotiable
- New team member onboarding: out-of-band credential sharing only
- Leak response procedure: stop, don't delete, coordinate scrub, rotate

---

## TIER 0c COMPLETE

All existential data privacy risks addressed:
- 2,786 customer records scrubbed from git history
- Zero hardcoded secrets (no rotation needed)
- .gitignore tightened with wildcard protection
- Orphaned data directories cleaned
- Data handling policy documented
