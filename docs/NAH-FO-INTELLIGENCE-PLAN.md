# NAH FO Intelligence Plan
> Last updated: 2026-03-25
> Owner: Corey
> Status: Phase 2b complete. Phase 3 starts now.

---

## THE NORTH STAR

> Build a franchise intelligence engine that learns from every candidate interaction —
> wins, losses, calls, behavior, personality, and post-close performance —
> so NAH can predict which franchisees will actually buy houses,
> and get dramatically better at finding more of them.

This is a 10-year data asset. Not a feature. Every decision in this build plan
serves that north star.

---

## CURRENT STATE (as of 2026-03-25)

### What Works
- App runs at localhost:3000, all pages 200
- Login: corey@newagainhouses.com / Gunner147
- 26 active leads in pipeline, 1,101 in Nurture
- Pipeline board, Leadership Dashboard, Contact detail slide-out
- Scout chat responds with live GHL data
- Stage move via app (tested live)
- CRM migration complete: 1,389 contacts from Client Tether → GHL

### Known Bugs (must fix before Phase 3)
| # | Bug | Priority | Impact |
|---|-----|----------|--------|
| 1 | GHL sync broken | CRITICAL | Everything depends on this |
| 2 | Pipeline stages don't match actual 18 stages | HIGH | Wrong prompts, wrong score |
| 3 | Spanish strings in UI ("Modo demostración") | HIGH | Trust issue with CEO |
| 4 | 44% of leads showing Unknown lead source | HIGH | Score uses source signal |
| 5 | PTO completion not a hard gate | HIGH | Biggest process control missing |
| 6 | Mack Wright stuck in Active (GHL 400 error) | LOW | Single record |
| 7 | Time period selector cosmetic only | LOW | Dashboard accuracy |

---

## THE INTELLIGENCE ARCHITECTURE

### Three Layers That Feed Each Other

```
Layer 3 — PREDICTION ENGINE
  Scout reasons across ALL candidate data
  Surfaces flags, predicts fit, coaches team
         ↑ learns from patterns over time
Layer 2 — INTELLIGENCE STORE
  Supabase: structured, timestamped, never deleted
  Everything scored, logged, and explained
         ↑ structured data flows up
Layer 1 — DATA COLLECTION
  AI-assisted, team confirms
  Calls, candidates, outcomes, performance
```

### Layer 1 — Data Collection Philosophy
- Scout auto-pulls everything possible (transcripts, GHL, Zorakle, signals)
- Team reviews and confirms — never blind auto-fill
- This ensures data gets collected vs relying on human discipline
- AI-assist is the key — it lowers friction to near zero

### Layer 2 — Data Home Base
- Supabase is source of truth
- Push summaries to GHL custom fields so GHL stays in sync
- NOTHING gets deleted. Everything is timestamped.
- Score changes are logged with the reason. Always.
- Design the schema NOW even for data we aren't collecting yet

### Layer 3 — What This Becomes
In 2-3 years with enough outcomes:
> "Based on 47 closed franchisees, candidates with this financial profile,
> Zorakle score, and motivation type average 31 houses in year 3.
> Candidates who raised royalty objection at Stage 5 unresolved close at 12%.
> Recommend: Matt addresses capital structure before moving forward."

That is the competitive moat nobody else will have.

---

## PHASE OVERVIEW

| Phase | Name | Status | Sprint |
|-------|------|--------|--------|
| 0 | Foundation | ✅ Complete | — |
| 1a | Scout AI | ✅ Complete | — |
| 1b | Daily HQ | ✅ Complete | — |
| 1c | Accountability Engine | ✅ Complete | — |
| 2a | Pipeline Board | ✅ Complete | — |
| 2b | Leadership Dashboard + Lead Profile | ✅ Complete | — |
| **3a** | **Bug Fixes + DB Schema** | **🔲 Next** | **Sprint 1** |
| **3b** | **Candidate Intelligence Layer** | **🔲 Next** | **Sprint 2** |
| **3c** | **Explainable Score** | **🔲 Next** | **Sprint 2** |
| **4** | **Onboarding + Coaching Pipeline** | **🔲 Soon** | **Sprint 3** |
| **5** | **Franchisee Performance Integration** | **🔲 Planned** | **Sprint 4** |
| **6** | **Prediction Engine** | **🔲 Future** | **Sprint 5+** |

---

## PHASE 3a — BUG FIXES + DATABASE SCHEMA
> Goal: Fix what's broken. Extend the database to hold everything we will ever need.
> Nothing new gets built until the foundation is solid.

### Bug Fixes (do in this order)
1. Fix GHL sync — diagnose root cause, verify contacts push/pull correctly
2. Map all 18 pipeline stages to correct GHL stage names (see pipeline.md)
3. Remove all Spanish strings — audit full codebase for i18n issues
4. Fix lead source attribution — ensure source passes through GHL sync
5. Make PTO completion a hard gate — block stage moves without completion

### New Database Tables (build all now, populate over time)

#### candidate_intelligence
Stores the growing intelligence profile per candidate.
One row per contact. Updated throughout the pipeline.

```sql
candidate_intelligence (
  id uuid PRIMARY KEY,
  contact_id varchar NOT NULL UNIQUE,  -- GHL contact ID
  ghl_location_id varchar NOT NULL,

  -- Financial profile
  net_worth_bucket varchar,            -- under_100k / 100_250k / 250_500k / 500k_plus
  liquid_capital int,                  -- in dollars
  illiquid_capital int,
  funding_path varchar,                -- cash / guidant / sba / combination / unknown
  pfs_received boolean DEFAULT false,
  pfs_uploaded_url varchar,            -- stored doc reference
  outstanding_liabilities text,
  financial_red_flags jsonb,           -- array of auto-surfaced flags

  -- Personality profile
  zorakle_completed boolean DEFAULT false,
  zorakle_results jsonb,               -- raw results object
  disc_profile varchar,                -- D / I / S / C
  risk_tolerance_score int,            -- 0-100
  personality_flags jsonb,             -- array of Scout-generated flags

  -- Candidate profile
  stated_motivation varchar,           -- buy_job / wealth / escape_corporate / other
  prior_business_owner boolean,
  prior_business_type text,
  construction_comfort varchar,        -- hands_on / oversight_only / no_experience
  spouse_supportive varchar,           -- yes / no / unknown
  urgency varchar,                     -- ready_now / 3_6_months / exploring

  -- Engagement signals
  trainual_completion_pct int DEFAULT 0,
  trainual_last_activity timestamptz,
  avg_response_time_hours float,
  homework_completion_rate float,      -- % of assigned homework completed

  -- Computed
  current_score int DEFAULT 0,
  score_financial int DEFAULT 0,       -- 0-25
  score_operational int DEFAULT 0,     -- 0-25
  score_engagement int DEFAULT 0,      -- 0-25
  score_momentum int DEFAULT 0,        -- 0-25
  active_flags jsonb,                  -- current flags array

  -- Meta
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)
```

#### call_logs
Structured post-call data. One row per call. Never edited, only added.

```sql
call_logs (
  id uuid PRIMARY KEY,
  contact_id varchar NOT NULL,
  call_type varchar NOT NULL,          -- intro / matt / sam / mark
  logged_by varchar NOT NULL,          -- user id of who logged it
  called_at timestamptz,               -- when the call happened
  logged_at timestamptz DEFAULT now(),

  -- Structured fields (JSONB — flexible by call type)
  fields jsonb NOT NULL,               -- call-type specific structured answers

  -- AI assist
  transcript_url varchar,              -- Google Meet transcript if available
  ai_prefilled boolean DEFAULT false,  -- did Scout pre-fill from transcript?
  human_confirmed boolean DEFAULT false,

  -- Rep gut read
  rep_confidence varchar,              -- high / medium / low
  red_flags_raised text,
  notes text,                          -- free-form after structured fields

  created_at timestamptz DEFAULT now()
)
```

#### candidate_score_history
Every score change, timestamped with reason. Never deleted.

```sql
candidate_score_history (
  id uuid PRIMARY KEY,
  contact_id varchar NOT NULL,
  triggered_by varchar NOT NULL,       -- call_log / stage_move / trainual / manual
  trigger_id uuid,                     -- reference to the thing that triggered it

  score_before int,
  score_after int,
  financial_before int,
  financial_after int,
  operational_before int,
  operational_after int,
  engagement_before int,
  engagement_after int,
  momentum_before int,
  momentum_after int,

  changes_explained jsonb,             -- array: [{field, delta, reason}]
  created_at timestamptz DEFAULT now()
)
```

#### objection_registry
Every objection raised, per candidate, per stage. The learning layer.

```sql
objection_registry (
  id uuid PRIMARY KEY,
  contact_id varchar NOT NULL,
  stage_at_time varchar NOT NULL,
  call_log_id uuid,

  objection_type varchar NOT NULL,     -- capital / value / timing / territory / going_cold / royalty / other
  objection_detail text,
  resolved boolean DEFAULT false,
  resolution_notes text,
  resolved_at timestamptz,

  score_impact int,                    -- negative number
  created_at timestamptz DEFAULT now()
)
```

#### franchisee_performance
Post-close performance data. The most important table we will ever have.
Populated via franchise software integration + manual quarterly input.

```sql
franchisee_performance (
  id uuid PRIMARY KEY,
  contact_id varchar NOT NULL,
  franchisee_name varchar NOT NULL,
  territory varchar,

  -- Deal close data
  signed_at timestamptz,
  funds_received_at timestamptz,
  franchise_agreement_signed boolean DEFAULT false,

  -- Performance metrics (updated quarterly)
  houses_purchased_year1 int,
  houses_purchased_year2 int,
  houses_purchased_year3 int,
  houses_purchased_total int,
  revenue_year1 int,
  revenue_year2 int,
  revenue_year3 int,
  time_to_first_flip_days int,
  staff_hired int,
  royalty_payment_consistent boolean,
  territory_utilization_pct int,
  nps_score int,
  support_calls_year1 int,
  active_status varchar,               -- active / churned / paused

  -- Source of data
  franchise_software_id varchar,       -- ID in FO management system
  last_synced_at timestamptz,
  data_source varchar,                 -- automated / manual / partial

  -- Meta
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)
```

#### market_signals
Industry and territory signals. Log now, query later.

```sql
market_signals (
  id uuid PRIMARY KEY,
  signal_type varchar NOT NULL,        -- territory / lead_source / objection_trend / industry
  signal_key varchar NOT NULL,         -- e.g. territory name, lead source name
  signal_value jsonb NOT NULL,         -- flexible data payload
  observed_at timestamptz DEFAULT now(),
  source varchar                       -- manual / automated / api
)
```

### Definition of Done — Phase 3a
- All 5 bugs fixed and verified
- All 5 new tables created with indexes and RLS
- GHL custom fields created for key intelligence data points
- npx tsc --noEmit returns 0 errors
- GHL sync verified end-to-end

---

## PHASE 3b — CANDIDATE INTELLIGENCE LAYER
> Goal: Build the structured call log system and candidate intelligence profile.
> AI-assisted, human-confirmed. No blank fields left in people's heads.

### Call Log System

#### Intro Call Log (Chad fills out after every intro call)
Fields to capture:
- Stated motivation: buy_job / wealth_building / escape_corporate / other
- Prior business owner: yes / no — if yes, what type (text)
- Construction comfort: hands_on / project_oversight / no_experience
- Liquid capital (soft screen): under_50k / 50_75k / 75_100k / 100k_plus
- Funding path: cash / guidant / sba / unknown
- Spouse supportive: yes / no / unknown
- Urgency: ready_now / 3_6_months / exploring
- Red flags raised: yes (describe) / none
- Chad's gut read: strong / moderate / weak

#### Matt Call Log (Matt fills out after every discovery call)
Fields to capture:
- Homework done (watched training, read materials): yes / partially / no
- Capital concern surfaced: yes / no — if yes, describe (text)
- Royalty objection raised: yes / no
- Alta Capital questions: yes / no — comfort level after (text)
- DISC impression: D / I / S / C (if not yet Zorakle'd)
- Financial situation read: strong / adequate / concerning
- Deal-breaker flags: territory / undercapitalized / wrong_profile / none
- Matt's close confidence: high / medium / low

#### Sam Call Log (Sam fills out after every validation call)
Fields to capture:
- Market analysis quality: thorough / partial / not_done
- Capital structure understood: yes / no
- Wholesaling comfort: yes / willing_to_learn / resistant
- Construction management realism: realistic / overconfident / underconfident
- Sam's read: move_forward / needs_more_work / flag_for_review

#### Mark Call Log (Mark fills out after every lending call)
Fields to capture:
- PFS complete: yes / incomplete / not_submitted
- Alta Capital terms understood and accepted: yes / no / negotiating
- Funding path confirmed: yes / no
- Capital gap identified: yes (amount in dollars) / no
- Mark's recommendation: proceed / hold / decline

### AI-Assist Flow (Scout pre-fills from transcript)
```
Google Meet records call
  → Gemini generates notes to Google Drive (automatic)
  → Scout pulls transcript via Drive API
  → Scout reads transcript + extracts structured field answers
  → Scout pre-fills call log form
  → Rep reviews each field (quick confirm or edit)
  → Rep submits → saves to call_logs table
  → Score updates automatically
  → Flags generated and surfaced on candidate profile
```
Human confirmation is REQUIRED. Scout never saves without rep approval.
Even without AI transcript, structured fields alone are a massive improvement.

### Zorakle Integration
- Chad inputs results after candidate completes assessment
- Form on candidate profile: "Log Zorakle Results"
- Fields: DISC type, risk tolerance score, key flags (text)
- Scout reads Zorakle data + surfaces personality flags
- Score operational bucket updates automatically
- Future: investigate Zorakle API for direct pull

### Candidate Profile — Intelligence Tab
Add new "Intelligence" tab to existing contact detail slide-out:
- Score breakdown: 4 buckets × 25 points, each explained
- Financial profile card
- Personality profile card (Zorakle + DISC)
- Call log history (all 4 call types, chronological)
- Active flags (Scout-generated, specific to NAH model)
- Objection history

### Automated Flags (Scout generates these)
NAH-specific flags, not generic stall alerts:
- "D personality — watch for analysis paralysis at offer stage"
- "PTO not started — 84% of candidates who don't start within 5 days never complete it"
- "Funding path unclear — PFS shows insufficient liquid capital for escrow"
- "FDD cooling period expires in 3 days — no signed FA"
- "Sam call not scheduled — candidate at Matt Call stage for X days"
- "Capital concern raised on call — not resolved"
- "Royalty objection surfaced — not addressed in subsequent call"
- "Candidate has not responded in 3 days — surface to Chad for personal touch"

### Definition of Done — Phase 3b
- All 4 call log forms built and tested (Chad, Matt, Sam, Mark)
- AI pre-fill from transcript working (with human confirmation gate)
- Zorakle input form live on candidate profile
- Intelligence tab on contact detail populated with real data
- All automated flags generating correctly
- Score updates on call log submission

---

## PHASE 3c — EXPLAINABLE SCORE
> Goal: Nobody trusts a black box. Every point change must be explained.
> Matt opens a profile and immediately knows why the score is what it is.

### Score Architecture (100 points total)

#### Financial Readiness (0-25)
| Signal | Points |
|--------|--------|
| Liquid capital 100k+ | +10 |
| Liquid capital 75-100k | +7 |
| Liquid capital 50-75k | +4 |
| Liquid capital under 50k | +0 |
| Funding path confirmed | +8 |
| Funding path identified not confirmed | +4 |
| Funding path unknown | +0 |
| PFS received and reviewed | +5 |
| PFS not received | +0 |
| High debt load flagged | -3 |
| Undercapitalized for territory | -5 |

#### Operational Fit (0-25)
| Signal | Points |
|--------|--------|
| Prior business owner | +5 |
| Construction comfort: hands-on | +6 |
| Construction comfort: project oversight | +4 |
| Construction comfort: none | +0 |
| Zorakle completed | +4 |
| Strong Zorakle fit profile | +6 |
| D personality flagged (analysis paralysis risk) | -5 |
| High I personality (oversell risk) | -3 |
| Mark's recommendation: proceed | +4 |
| Mark's recommendation: hold | -3 |
| Mark's recommendation: decline | -8 |

#### Engagement Quality (0-25)
| Signal | Points |
|--------|--------|
| PTO completion 100% | +10 |
| PTO completion 50-99% | +5 |
| PTO not started after 5 days | -15 |
| Homework done on Matt call | +5 |
| All calls attended on time | +5 |
| Response time under 4 hours | +5 |
| Capital concern raised AND resolved | +3 |
| Capital concern raised AND unresolved | -10 |

#### Pipeline Momentum (0-25)
| Signal | Points |
|--------|--------|
| Progressing on pace (within stage benchmarks) | +15 |
| Slightly behind pace | +8 |
| Stall alert active (1 active) | -5 |
| Multiple stall alerts | -10 |
| Speed-to-lead under 5 min | +5 |
| Repeated non-response (3+ days) | -5 |
| Re-engaged from Nurture | +5 |

### Score Display
Every score shows:
1. Total (e.g. 71/100)
2. Four bucket bars with point breakdown
3. Last 3 changes with timestamp and reason
4. Active flags that are suppressing the score
5. "What would move this score" — Scout recommendation

### Definition of Done — Phase 3c
- Score breakdown visible on candidate profile
- Every point change logged in candidate_score_history
- Score explanation text generated by Scout
- Active flags linked to score impact
- Leadership can filter pipeline by score tier

---

## PHASE 4 — ONBOARDING + COACHING PIPELINE
> Goal: The sales pipeline ends at Funds Received. The franchisee pipeline starts there.
> This is where we collect the post-close data that feeds the prediction engine.
> NOTE: This is the NEXT sprint after Phase 3. Not a future phase. Build it soon.

### Why This Matters
The most valuable data we will ever have is what separates a franchisee who buys
50 houses in 5 years from one who buys 5. Right now that data lives nowhere.
This pipeline captures it from day one of franchisee life.

### Two New Pipelines to Build in GHL

#### Onboarding Pipeline (first 90 days post-close)
Stages:
1. Welcome & Setup — credentials, systems access, intro call scheduled
2. Initial Training — Trainual onboarding track completion
3. Territory Orientation — territory walkthrough, first market analysis
4. First Deal Preparation — sourcing strategy, offer criteria, funding ready
5. First Offer Made — candidate has made their first offer
6. First House Acquired — first flip property under contract
7. Onboarding Complete — 90-day milestone hit

Data to capture at each stage:
- Days to complete each stage
- Support calls required
- Obstacles flagged
- Trainual completion %
- Mentor call notes (structured)

#### Coaching Pipeline (ongoing, quarterly)
Stages:
1. Q1 Check-in — 30/60/90 day review
2. Active Coaching — regular cadence
3. Performance Review — quarterly numbers
4. Milestone Recognition — hits goals
5. Intervention Required — behind pace, needs support
6. Graduate — hitting targets, minimal support needed

Data to capture each quarter:
- Houses purchased this quarter
- Revenue generated
- Open deals in progress
- Support issues
- NPS score
- Key wins and challenges (structured)

### Franchisee Performance Integration
Connect to FO management software (franchise operations software FOs use):
- Identify API or export capability
- Pull: inventory, deals closed, revenue, activity
- Map to franchisee_performance table
- Update quarterly (automated where possible, manual fallback)
- Show performance data on franchisee profile in app

### 1,300 Record Backfill Task
⚠️ ACTION REQUIRED: Get list of converted franchisees from Chad/Matt
Converted = signed franchise agreement OR funds received OR currently active franchisee

For each converted record:
- Tag in GHL with franchisee status
- Create franchisee_performance row with whatever data exists
- Link candidate_intelligence row (their sales journey data)
- Note: this is manual work, needs a dedicated sprint day

### Definition of Done — Phase 4
- Onboarding pipeline live in GHL with correct stages
- Coaching pipeline live in GHL with correct stages
- Both pipelines visible in app
- Franchisee performance data flowing from FO software (or manual entry fallback)
- franchisee_performance table populated for all active franchisees
- 1,300 record backfill complete

---

## PHASE 5 — FRANCHISEE PERFORMANCE INTEGRATION
> Goal: Automate the performance data collection so it doesn't depend on humans.

### What We Need From Matt (surface this when Phase 4 is scoped)
⚠️ CLAUDE CODE REMINDER: When starting Phase 4 sprint, surface these questions to Corey:

1. What is the name of the FO management software franchisees use?
2. Does it have an API or data export?
3. What data fields does it track? (deals, revenue, inventory, activity)
4. Who manages the FO software access — Matt's team or ops?
5. Is franchisee performance data currently reported anywhere (spreadsheet, report)?
6. What is the definition of a "successful" franchisee in Matt's words?
7. What's the minimum number of houses in year 1 that indicates a franchisee is on track?

These answers unlock the prediction engine. Do not skip them.

### Integration Architecture
```
FO Management Software
  → API pull or scheduled export
  → transform to franchisee_performance schema
  → update Supabase quarterly
  → Scout reads performance data
  → correlate with candidate_intelligence (pre-close signals)
  → pattern library grows
```

---

## PHASE 6 — PREDICTION ENGINE (the 10-year asset)
> Goal: Scout learns from historical outcomes and predicts future performance.
> This is where MiroFish-style agent memory and GraphRAG patterns apply.

### What Gets Built
- Pattern library: correlations between pre-close signals and post-close performance
- Candidate fit score based on historical winners
- Lead source quality ranking (which sources produce best franchisees)
- Territory performance modeling
- "Looks like" matching: "This candidate's profile is closest to franchisee X who averaged 28 houses/year"

### Data Requirements Before This Can Work
- Minimum 30 closed franchisees with performance data (likely have this now or soon)
- Minimum 100 call logs with structured data (takes ~3 months to accumulate)
- Minimum 1 year of quarterly performance updates

### Market Signals Layer (Layer 1C)
Log now, build later:
- Territory economic indicators
- Local real estate market trends (median price, days on market, inventory)
- Competitor franchise activity
- Lead source quality trends over time
- Objection frequency trends (what's changing in the market)

All logged to market_signals table. Scout queries it when available.

---

## MATT'S ASKS — TRACKING LOG
> Items Matt raised in his feedback emails. Surface to Corey at the right phase.

### Fix Now (Phase 3a)
- [ ] GHL sync broken
- [ ] Pipeline stages need to match 18 actual stages
- [ ] Spanish language strings ("Modo demostración", "Crear tu cuenta real")
- [ ] Lead source attribution: 44% Unknown
- [ ] PTO completion as hard gate

### Phase 3b
- [ ] Financial profile (PFS parsed, liquid vs illiquid, funding path)
- [ ] Personality profile (Zorakle pulled in, DISC flags visible on profile)
- [ ] Call summaries attached to every call type
- [ ] Running candidate score — visible and explained
- [ ] Specific automated flags (not generic stall alerts)

### Phase 3c
- [ ] Score breakdown: 4 buckets × 25, each explained
- [ ] Score visible to Chad, Sam, Mark, Matt with explanation
- [ ] "What would move this score" recommendation

### Phase 4
- [ ] Trainual completion = hard gate (enforce at system level)
- [ ] Google Meet transcript integration (Gemini notes → Scout)

### Questions for Matt (surface in Phase 4 sprint kickoff)
- [ ] What is the FO management software name?
- [ ] Does it have an API or export?
- [ ] What data fields does it track?
- [ ] What's the definition of a "successful" franchisee?
- [ ] Minimum houses in year 1 to be considered on track?
- [ ] Is there existing franchisee performance data anywhere (even a spreadsheet)?

---

## WORKING WITH CLAUDE CODE

### Session Starter
Read SESSION_START.md from GitHub, then read handoff.md.
Tell Corey: current phase, last session, open issues, what we build today.

### 4-Step Self-Audit (every function, every component)
1. Write — initial version
2. Question — edge cases? TypeScript strict? GHL through /lib/ghl only? Scout has confirm step?
3. Improve — apply fixes
4. Validate — matches spec? CLAUDE.md rules? 0 TypeScript errors?

### Non-Negotiable Rules
- TypeScript strict — 0 errors before any push
- No any types
- No hardcoded secrets
- ALL GHL calls through /lib/ghl/client.ts only
- Scout NEVER acts without human confirmation
- Never push directly to main

### Doc Reading Before Building
| Building... | Read first |
|------------|-----------|
| Call log system | This doc + docs/pipeline.md |
| Score engine | This doc (score architecture section) |
| GHL sync fix | ghl-masterclass/knowledge/ghl-connection-map.md |
| Candidate profile | This doc + docs/design.md |
| Franchisee pipeline | This doc (Phase 4) + docs/pipeline.md |

---

## OPEN ISSUES CARRIED FORWARD
- Mack Wright stuck in Active (GHL 400 error on move) — Low
- Time period selector cosmetic only — Low
- Action buttons need e2e testing before go-live — Medium
- Old "New Franchise" pipeline (1,336 opps) hidden from app but still in GHL — Low
