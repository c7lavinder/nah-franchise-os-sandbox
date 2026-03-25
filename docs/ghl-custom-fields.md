# GHL Custom Fields — Candidate Profile Schema

> Complete list of custom fields needed in GoHighLevel for the NAH Franchise OS.
> Native GHL fields (firstName, lastName, email, phone, source, tags, dateAdded, assignedTo) are NOT listed here.
> Only custom fields that must be created via GHL API or admin panel.
>
> Last updated: 2026-03-24

---

## Field Status Legend

| Status | Meaning |
|--------|---------|
| EXISTS | Already defined in `scripts/setup-ghl-account.ts` and may already be created in GHL |
| NEW | Must be added to the setup script and created in GHL |

---

## 1. Territory Fields

| Field Name | Type | Options | Relevant Stage | Scout Access | Status |
|-----------|------|---------|---------------|-------------|--------|
| Territory Interest | text | — | Stage 1 (New Lead) | Read + Write | EXISTS |
| Territory Status | dropdown | Available, Waitlist, Unavailable, Confirmed | Stage 3 (Qualified) | Read + Write | EXISTS |
| Territory Confirmed Date | date | — | Stage 10 (Award) | Write | NEW |
| Territory Market | text | — | Stage 3 (Qualified) | Read + Write | NEW |

**Notes:**
- Territory Interest is free text — the city/state/metro the prospect wants.
- Territory Status is updated by Chad after qualification. Scout reads it for scoring.
- Territory Confirmed Date is set when the franchise agreement reserves the territory.
- Territory Market captures the broader market area (e.g., "DFW Metro", "Atlanta North").

---

## 2. Franchise Fit Fields

| Field Name | Type | Options | Relevant Stage | Scout Access | Status |
|-----------|------|---------|---------------|-------------|--------|
| Business Ownership Experience | dropdown | Yes, No | Stage 3 (Qualified) | Read + Write | EXISTS |
| Motivation Clarity | dropdown | Strong, Moderate, Weak | Stage 3 (Qualified) | Read + Write | EXISTS |
| RE Experience | dropdown | None, Some (1-3 flips), Experienced (4-10), Expert (10+) | Stage 3 (Qualified) | Read + Write | NEW |
| Construction Knowledge | dropdown | None, Basic, Intermediate, Advanced | Stage 3 (Qualified) | Read + Write | NEW |
| Why NAH | text | — | Stage 3 (Qualified) | Read + Write | NEW |
| Primary Goal | dropdown | Full-time business, Side income, Portfolio diversification, Career change, Legacy building | Stage 3 (Qualified) | Read + Write | NEW |
| Timeline to Open | dropdown | Immediately, 1-3 months, 3-6 months, 6-12 months, 12+ months | Stage 3 (Qualified) | Read + Write | NEW |

**Notes:**
- These fields are populated during the qualification call (Stage 3). Chad logs them after the call, or Scout prompts Chad to fill them.
- RE Experience and Construction Knowledge help Matt prepare for the Discovery call.
- Why NAH captures the prospect's stated motivation in their own words.
- Primary Goal informs how Scout frames the opportunity in follow-up messages.
- Timeline to Open is distinct from Investment Timeline — this is about operational readiness, not financial readiness.

---

## 3. Financial Fields

| Field Name | Type | Options | Relevant Stage | Scout Access | Status |
|-----------|------|---------|---------------|-------------|--------|
| Capital Availability | dropdown | Confirmed, Needs Verification, Unknown | Stage 3 (Qualified) | Read + Write | EXISTS |
| Investment Timeline | dropdown | Under 6 months, 6-12 months, 12+ months | Stage 3 (Qualified) | Read + Write | EXISTS |
| Capital Source | dropdown | Cash, SBA Loan, ROBS (Retirement Rollover), Home Equity, Partner/Investor, Combination, Undecided | Stage 3 (Qualified) | Read + Write | NEW |
| Financing Pre-Qualified | dropdown | Yes, No, In Progress, Not Started | Stage 9 (Mark Call) | Read + Write | NEW |
| Financial Objection | dropdown | Investment size, Uncertain ROI, Wants to compare, Needs spouse buy-in, Needs more info, None | Stage 3+ | Read + Write | NEW |

**Notes:**
- Capital Source identifies how the prospect plans to fund the franchise. Critical for Mark Call prep.
- Financing Pre-Qualified is updated after the Mark Call when Mark confirms financial viability.
- Financial Objection captures the primary financial concern. Scout uses this to route to the right objection handling.
- Capital is the #1 deal killer — these fields give Scout the data to proactively address it.

---

## 4. Trainual Fields

| Field Name | Type | Options | Relevant Stage | Scout Access | Status |
|-----------|------|---------|---------------|-------------|--------|
| Trainual Access Sent | dropdown | Yes, No | Stage 1 (New Lead) | Read + Write | EXISTS |
| Trainual Completion Percent | number | 0-100 | Stage 1+ | Read + Write | EXISTS |
| Framing Call Logged | dropdown | Yes, No | Stage 2 (Contacted) | Read + Write | EXISTS |
| Trainual Last Opened Date | date | — | Stage 1+ | Write | NEW |
| Trainual Current Section | text | — | Stage 1+ | Write | NEW |

**Notes:**
- Trainual Access Sent must be "No" until Framing Call Logged is "Yes". This is enforced by the system — 84% of prospects never opened Trainual when it was sent cold.
- Trainual Last Opened Date comes from the Trainual API (future integration). Scout uses it to detect stalled engagement.
- Trainual Current Section tracks where the prospect stopped. Scout references this to nudge completion of specific sections.
- Trainual Completion Percent is the primary engagement signal. 75%+ = high engagement. 100% + no stage advance = urgent flag.

---

## 5. Validation Fields

| Field Name | Type | Options | Relevant Stage | Scout Access | Status |
|-----------|------|---------|---------------|-------------|--------|
| Discovery Scorecard Score | number | 0-100 | Stage 4 (Matt Call) | Read + Write | EXISTS |
| Validation Call 1 Complete | dropdown | Yes, No | Stage 6 (Sam Call) | Read + Write | EXISTS |
| Validation Call 2 Complete | dropdown | Yes, No | Stage 6 (Sam Call) | Read + Write | EXISTS |
| Validation Call 3 Complete | dropdown | Yes, No | Stage 6 (Sam Call) | Read + Write | EXISTS |
| Compliance Gate Passed | dropdown | Yes, No | Stage 6.5 (Compliance) | Read + Write | EXISTS |
| Matt Call Done | dropdown | Yes — Fit Confirmed, Yes — Concerns Flagged, No — Not Scheduled, No — No Show | Stage 4 (Matt Call) | Read + Write | NEW |
| Sam Call Done | dropdown | Yes — Positive, Yes — Concerns, No — Not Scheduled, No — No Show | Stage 6 (Sam Call) | Read + Write | NEW |
| Mark Call Done | dropdown | Yes — Financially Viable, Yes — Needs More Info, No — Not Scheduled, No — No Show | Stage 9 (Mark Call) | Read + Write | NEW |
| Franchisee Validator Name | text | — | Stage 6 (Sam Call) | Read + Write | NEW |
| FDD Issued Date | date | — | Stage 8 (FDD) | Read + Write | EXISTS |
| FDD 14-Day Unlocks | date | — | Stage 8 (FDD) | Read | EXISTS |

**Notes:**
- Matt/Sam/Mark Call Done fields capture outcome, not just completion. This gives Scout richer data for scoring and next-action recommendations.
- Franchisee Validator Name records which existing franchisee the prospect spoke with during validation. Useful for testimonial matching.
- Validation Call 1-3 were designed for multiple validation conversations. In practice, Sam handles most validation in one or two calls.
- FDD 14-Day Unlocks is auto-calculated: FDD Issued Date + 14 calendar days. Scout hard-blocks stage moves until this date passes.

---

## 6. Engagement Fields

| Field Name | Type | Options | Relevant Stage | Scout Access | Status |
|-----------|------|---------|---------------|-------------|--------|
| Loss Reason | dropdown | Not qualified financially, No available territory, Chose a competitor franchise, Completely unresponsive, Changed mind, Bad fit, Timing - moved to Nurture, Other | Any (on Lost) | Read + Write | EXISTS |
| Days in Current Stage | number | — | All stages | Write | EXISTS |
| Sequence Day Number | number | 1-30 | Stage 1-2 | Read + Write | NEW |
| Sequence Status | dropdown | Active, Paused, Completed, Exited Early | Stage 1-2 | Read + Write | NEW |
| Last Touch Date | date | — | All stages | Write | NEW |
| Last Touch Channel | dropdown | Call, SMS, Email, Trainual, In-Person | All stages | Write | NEW |
| Contact Attempt Count | number | — | Stage 2 (Contacted) | Write | NEW |

**Notes:**
- Sequence Day Number tracks where a prospect is in the 30-day new lead sequence (see docs/pipeline.md). Scout uses this to know what action is due today.
- Sequence Status allows pausing sequences during vacations or when the prospect asks for space.
- Last Touch Date and Last Touch Channel are updated automatically whenever Scout logs an interaction. Used for stale lead detection.
- Contact Attempt Count is critical for Stage 2 — after 5+ attempts with no response, Scout flags for Pipeline 2 consideration.
- Days in Current Stage is recalculated daily by the accountability engine.

---

## 7. AI Scout Fields

| Field Name | Type | Options | Relevant Stage | Scout Access | Status |
|-----------|------|---------|---------------|-------------|--------|
| Scout Lead Score | number | 0-100 | All stages | Read + Write | EXISTS |
| Score Breakdown | text | — | All stages | Write | NEW |
| Engagement Velocity | dropdown | Accelerating, Steady, Slowing, Stalled | All stages | Write | NEW |
| Sentiment Trend | dropdown | Very Positive, Positive, Neutral, Cautious, Negative | All stages | Write | NEW |
| Predicted Close Probability | number | 0-100 | Stage 3+ | Write | NEW |
| Recommended Next Action | text | — | All stages | Write | NEW |
| Auto Summary | text | — | All stages | Write | NEW |
| Lookalike Score | number | 0-100 | Stage 1+ | Write | NEW |
| Communication Style | dropdown | Direct/Fast, Analytical/Detail, Relationship/Trust, Cautious/Slow | Stage 2+ | Write | NEW |

**Notes:**
- **Scout Lead Score** uses the weighted model from pipeline.md: source quality (20%), capital (20%), territory (15%), engagement speed (15%), business experience (15%), timeline (15%).
- **Score Breakdown** is a JSON-like text field storing the component scores. Example: `"source:18/20 capital:15/20 territory:12/15 engagement:10/15 experience:15/15 timeline:8/15 = 78"`. Scout writes this on every score update.
- **Engagement Velocity** measures the rate of interactions over the last 7 days compared to previous 7 days. Scout recalculates daily.
- **Sentiment Trend** is derived from message content analysis. Scout reads the last 5 messages from the prospect and classifies overall sentiment. Updated after each inbound message.
- **Predicted Close Probability** is a machine-learned estimate combining lead score, stage position, velocity, sentiment, and historical patterns from won deals. Initially rule-based, improves with data.
- **Recommended Next Action** is Scout's suggestion for Chad's next step. Updated whenever stage, score, or engagement changes. Example: `"Schedule Mark Call — prospect confirmed financing with Guidant"`.
- **Auto Summary** is a 2-3 sentence summary of the prospect's journey so far. Updated on every stage move. Used for quick context in pre-call briefs.
- **Lookalike Score** compares the prospect's profile to the profiles of won deals. Higher score = more similar to past wins. Requires minimum 10 won deals for meaningful data.
- **Communication Style** is classified by Scout based on message patterns: response speed, message length, question frequency, formality level. Helps Scout draft messages in the right tone.

---

## 8. Compliance Fields

| Field Name | Type | Options | Relevant Stage | Scout Access | Status |
|-----------|------|---------|---------------|-------------|--------|
| NDA Status | dropdown | Not Sent, Sent, Signed | Stage 3 (Qualified) | Read + Write | EXISTS |
| Spouse Aware | dropdown | Yes, No, N/A (Single), Unknown | Stage 3 (Qualified) | Read + Write | NEW |
| OK to SMS Confirmed Date | date | — | Stage 1 (New Lead) | Read + Write | NEW |
| Earnings Claims Made | dropdown | No — Confirmed Clean, Yes — Flagged | Stage 6.5 (Compliance) | Read + Write | NEW |
| Compliance Checklist Complete | dropdown | Yes, No | Stage 6.5 (Compliance) | Read + Write | NEW |

**Notes:**
- **Spouse Aware** is important because franchise decisions are joint financial decisions. If the spouse is not aware, the deal is likely to fall through at Stage 9 or 10. Scout flags this early.
- **OK to SMS Confirmed Date** records when the prospect opted in to SMS. Required for TCPA compliance. If null, Scout blocks SMS sending.
- **Earnings Claims Made** is checked during the Compliance Gate. NAH does not make earnings claims. If "Yes — Flagged", the compliance gate cannot pass and leadership is alerted.
- **Compliance Checklist Complete** is the rollup field — "Yes" only when all compliance gate items are verified.

---

## Summary

| Category | Total Fields | Existing | New |
|---------|-------------|---------|-----|
| 1. Territory | 4 | 2 | 2 |
| 2. Franchise Fit | 7 | 2 | 5 |
| 3. Financial | 5 | 2 | 3 |
| 4. Trainual | 5 | 3 | 2 |
| 5. Validation | 11 | 7 | 4 |
| 6. Engagement | 7 | 2 | 5 |
| 7. AI Scout | 9 | 1 | 8 |
| 8. Compliance | 5 | 1 | 4 |
| **TOTAL** | **53** | **20** | **33** |

---

## GHL API Notes

### Creating Custom Fields
```
POST /locations/{locationId}/customFields
{
  "name": "Field Name",
  "dataType": "TEXT" | "SINGLE_OPTIONS" | "NUMERICAL" | "DATE",
  "model": "contact" | "opportunity",
  "options": ["Option 1", "Option 2"]  // only for SINGLE_OPTIONS
}
```

### Reading Custom Fields on a Contact
Custom fields appear in the `customFields` array on the contact object:
```json
{
  "customFields": [
    { "id": "field_abc123", "value": "78" }
  ]
}
```
The `id` is the GHL field ID, not the field name. The `ghl_custom_fields` table in Supabase maps field keys to GHL field IDs.

### Writing Custom Fields
Use the contact update endpoint with the `customFields` array:
```
PUT /contacts/{contactId}
{
  "customFields": [
    { "id": "field_abc123", "value": "82" }
  ]
}
```

### Field ID Caching
All custom field IDs are cached in the `ghl_custom_fields` Supabase table (see `supabase/migrations/005_ghl_custom_fields.sql`). The setup script populates this table when fields are created. Scout reads from this cache to avoid field ID lookups on every API call.

---

## Implementation Priority

### Phase 1 — Create immediately (needed for current features)
All 20 existing fields + these new fields:
- Sequence Day Number, Sequence Status (needed for `sequence_status` Scout tool)
- Last Touch Date, Last Touch Channel (needed for stale lead detection)
- Contact Attempt Count (needed for Stage 2 accountability)
- OK to SMS Confirmed Date (needed for compliance)

### Phase 2 — Create when building AI scoring
- Score Breakdown, Engagement Velocity, Sentiment Trend
- Predicted Close Probability, Lookalike Score
- Communication Style, Auto Summary, Recommended Next Action

### Phase 3 — Create when building full candidate profile UI
- RE Experience, Construction Knowledge, Why NAH, Primary Goal, Timeline to Open
- Capital Source, Financing Pre-Qualified, Financial Objection
- Spouse Aware, Earnings Claims Made, Compliance Checklist Complete
- Matt/Sam/Mark Call Done fields, Franchisee Validator Name
- Territory Confirmed Date, Territory Market
- Trainual Last Opened Date, Trainual Current Section
