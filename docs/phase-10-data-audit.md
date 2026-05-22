# Phase 10 — Pre-flight Data Audit

> Run date: 2026-05-22
> Script: `scripts/phase10-data-audit.ts`

## Gate Results

| Gate                                 | Threshold                   | Actual           | Result        |
| ------------------------------------ | --------------------------- | ---------------- | ------------- |
| 1. Converted contacts w/ profile     | >= 30                       | 30 (of 71 total) | PASS (barely) |
| 2. Lost contacts w/ profile          | >= 30                       | 0                | FAIL          |
| 3. T12 metrics per tier (>= 10 each) | >= 10 top / 10 mid / 10 low | 0 / 0 / 0        | FAIL          |

**Verdict: 2 of 3 gates failed. Pivot to rule-based scoring.**

---

## Gate 1: Converted Contacts — PASS

71 contacts flagged `is_converted_franchisee = true`. 30 have >= 5 profile fields.

**Profile completeness distribution:**

- 14 fields: 1 contact (Derk Cheetwood)
- 12 fields: 5 contacts
- 10-11 fields: 3 contacts
- 5-9 fields: ~21 contacts
- 0-4 fields: 41 contacts (sparse — many backfilled from GHL with name/phone only)

**Takeaway:** Barely passes. Profile enrichment on converted contacts would strengthen any future model. The 41 sparse converted contacts are a data quality gap worth closing.

---

## Gate 2: Lost Contacts — FAIL

**The problem:** Journeys are rarely closed with a loss reason. Only 1 closed journey exists (a `split`), and 0 closed journeys with `won` reason either — meaning the pipeline close workflow isn't being used.

**What exists instead:**

- 732 non-converted contacts with no active journey (potential "lost" pool)
- These are contacts that entered the system but never converted and aren't being actively worked
- They have no formal "lost" designation — they just went quiet

**Why it fails:**

- No structured "lost" flag or close reason on most contacts
- Journey close workflow isn't part of Chad's daily process yet
- Without a clear lost/won label, supervised learning can't distinguish outcomes

**Options to address:**

1. **Infer lost:** Contacts with no activity in 90+ days, no active journey, not converted = "lost"
2. **Backfill close reasons:** Have Chad close stale journeys with reasons in batch
3. **Use lead score decay:** Contacts whose lead score dropped to Cold tier = proxy for lost

---

## Gate 3: T12 Performance Metrics — FAIL

**The problem:** `franchisee_performance` table has 0 rows. It was created as part of the intelligence schema but never populated.

**What exists instead:**

- MasterSuite has 50K+ property records with full deal metrics (ARV, profit, stage, royalty)
- MasterSuite sync (Phase 2-6 of mastersuite-data-audit.md) hasn't shipped yet
- No manual data entry into franchisee_performance either

**Options to address:**

1. **Ship MasterSuite property sync** — this unlocks T12 aggregation per territory/franchisee
2. **Manual CSV import** — Chad exports from MasterSuite, we import quarterly metrics
3. **Defer tier analysis** — build rule-based scoring without T12, add it later when data exists

---

## Candidate Intelligence Snapshot

| Metric                | Count |
| --------------------- | ----- |
| Total rows            | 1,000 |
| With score > 0        | 867   |
| With DISC profile     | 0     |
| With Zorakle results  | 0     |
| With funding_path     | 133   |
| With net_worth_bucket | 0     |

Zorakle/DISC data hasn't been imported yet. Funding path is available for 133 contacts (likely from call extractions). Net worth bucket unpopulated.

---

## Decision: Rule-Based Scoring

Since Gates 2 and 3 fail, we pivot from predictive ML to **rule-based lookalike scoring**:

### What this means

Instead of training a model on labeled outcomes (converted vs lost), we build a weighted scoring formula based on:

1. **Profile completeness** — more fields filled = higher match quality
2. **Known success patterns** — traits common among the 71 converted franchisees
3. **Engagement signals** — call count, response times, homework completion
4. **Financial readiness** — capital, funding path, PFS status
5. **Lead score** — existing 0-100 lead score as a composite input

### What we DON'T do

- No ML model training (not enough labeled data)
- No T12 outcome weighting (no performance data yet)
- No supervised classification (no clear lost labels)

### Future upgrade path

When these conditions are met, we can upgrade to predictive models:

- [ ] 30+ contacts formally closed as "lost" with close reasons
- [ ] MasterSuite property sync live (T12 aggregation possible)
- [ ] Zorakle/DISC data imported for personality dimension
