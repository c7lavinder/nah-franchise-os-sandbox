-- KB Elite Content — Fill the 5 empty categories that block elite coaching
-- ideal_candidate, competitors, territory, training, operations

-- ═══════════════════════════════════════════════════
-- IDEAL CANDIDATE PROFILE
-- ═══════════════════════════════════════════════════

INSERT INTO knowledge_documents (title, category, content, priority, token_count, is_active) VALUES
(
  'Ideal Franchise Candidate Profile',
  'ideal_candidate',
  '# Ideal Franchise Candidate Profile

## The NAH Sweet Spot
The ideal NAH franchisee is NOT a seasoned real estate investor. They are an entrepreneurial operator who wants a proven system.

## Must-Have Traits
- **Capital**: $100K-$300K liquid (or access via ROBS/SBA/Guidant). Cash buyers ramp faster but SBA works.
- **Mindset**: Coachable. Follows the system. Not a "I know better" personality.
- **Time**: Willing to commit 40+ hours/week (full-time operators outperform part-time 3:1).
- **Grit**: House flipping has hard days. Construction delays, deals falling through, capital tied up.
- **Local market knowledge**: Lives in or near their territory. Understands the neighborhoods.

## Strong Signals (Score Boosters)
- Prior business ownership (any industry) — understands P&L, hiring, accountability
- Construction or project management background — understands rehab timelines
- Real estate license or interest — can save on agent commissions
- Spouse/partner fully supportive — critical for the first year grind
- Responds quickly to communications — engagement speed predicts success
- Completes Trainual modules proactively — self-starters outperform

## Red Flags (Score Reducers)
- "I just want passive income" — this is NOT passive
- Cannot articulate WHY they want this specific business
- Spouse/partner unaware or unsupportive
- Liquid capital below $75K with no clear funding path
- Timeline longer than 12 months — urgency correlates with close rate
- Cannot commit to full-time — part-time franchisees rarely reach high performer
- Prior franchise failures without self-awareness about what went wrong

## Scoring Framework
Use the 4-quadrant intelligence score:
- Financial Readiness (0-25): Capital + funding path + PFS
- Operational Fit (0-25): Experience + motivation + time commitment
- Engagement Quality (0-25): Response speed + Trainual progress + call attendance
- Pipeline Momentum (0-25): Stage velocity + call outcomes + objection resolution

80+ = Hot — priority follow-up, likely to close
60-79 = Warm — active pipeline, needs nurturing
40-59 = Cool — timeline or capital issues, maintain contact
Below 40 = Cold — likely not a fit, move to nurture or disqualify

## What High-Performing Franchisees Have in Common
Based on 10 years of data across 64+ territories:
- Full-time operators (not part-time)
- Followed the system in year 1 before customizing
- Attended all coaching calls consistently
- Built a local team (contractor, agent, bookkeeper) in first 90 days
- Hit 10+ purchases within 18 months of launch',
  95, 1000, true
);

-- ═══════════════════════════════════════════════════
-- COMPETITORS
-- ═══════════════════════════════════════════════════

INSERT INTO knowledge_documents (title, category, content, priority, token_count, is_active) VALUES
(
  'Competitive Landscape & NAH Differentiation',
  'competitors',
  '# Competitive Landscape & NAH Differentiation

## NAH vs. Solo Flipping
This is the #1 competitor — the prospect thinking "why pay royalties when I can do it myself?"
- **80% of solo flippers fail in year 1** — no systems, no support, no buying power
- NAH provides: deal evaluation tools (MasterSuite), contractor network, financing relationships, coaching
- Solo flippers learn by losing money. NAH franchisees learn from 10 years of data across 64+ territories
- Territory protection — solo flippers compete with everyone including other NAH franchisees? No. Exclusive territory.

## NAH vs. Other House Flipping Franchises
- **HomeVestors ("We Buy Ugly Houses")**: Larger brand, higher entry cost ($50K-$400K), more rigid system. NAH is more entrepreneurial with more territory flexibility.
- **New Western Acquisitions**: Wholesale model (not full flip). Different business — they find deals for investors, not flip themselves. Apples to oranges.
- **Property management franchises**: Not competitors — different business model entirely. If prospect mentions this, they may want passive income (red flag).

## NAH Differentiators (Use in Sales Conversations)
1. **MasterSuite**: Proprietary software with 10 years of property data. No competitor has this.
2. **Proven unit economics**: Real profit data from 64+ active territories. We can show actual numbers.
3. **Coaching model**: Weekly/bi-weekly coaching calls with experienced coaches. Not just "here is a manual."
4. **Territory exclusivity**: Protected market with defined counties/zips. No internal competition.
5. **Multiple revenue paths**: Flip, rent, wholesale, assign — franchisees are not locked into one strategy.
6. **EOS operating system**: Every territory runs on EOS (Entrepreneurial Operating System) — goals, rocks, scorecards, habits.
7. **Lower entry point**: Compared to HomeVestors and similar, NAH is more accessible for first-time business owners.

## Handling "Why Not Do It Alone?"
- "You could learn to flip houses on your own. Some people do. But would you rather learn by losing $50K on bad deals, or learn from a network that has done 90,000+ property evaluations?"
- "The royalty pays for itself in one avoided bad deal per year."
- "Ask any solo flipper what they wish they had — it is always systems, data, and someone to call when things go sideways."

## NEVER Do
- Never badmouth competitors by name in writing
- Never make earnings claims or guarantee ROI
- Never compare franchise fees directly (legal risk)
- Always redirect to "what does the data show" rather than "we are better than X"',
  90, 900, true
);

-- ═══════════════════════════════════════════════════
-- TERRITORY ANALYSIS
-- ═══════════════════════════════════════════════════

INSERT INTO knowledge_documents (title, category, content, priority, token_count, is_active) VALUES
(
  'Territory Analysis & Market Evaluation Framework',
  'territory',
  '# Territory Analysis & Market Evaluation Framework

## What Makes a Good NAH Territory
- **Population**: 200K-500K metro area sweet spot. Too small = not enough deals. Too large = too much competition.
- **Median home price**: $150K-$400K range. Below $150K = margins too thin. Above $400K = capital requirements too high.
- **Housing stock age**: Older homes (pre-1990) = more rehab opportunities
- **Distressed property ratio**: Higher foreclosure/vacancy rates = more deal flow
- **Investor activity**: Some competition is healthy (validates market). Too much = compressed margins.
- **Contractor availability**: Critical — no contractors = no flips regardless of deal flow

## Territory Assignment Process
1. Prospect expresses territory interest during qualification
2. Check availability in territories table (status = "available" or no active owner)
3. Evaluate prospect fit for that specific market
4. Present territory data: population, housing stats, existing NAH activity nearby
5. Reserve territory at application stage
6. Formally assign at franchise agreement signing

## Key Metrics for Territory Evaluation (Use territory_performance tool)
- **Leads Entered**: How many properties entering the funnel per quarter?
- **S1 to S4 Conversion**: What % of leads convert to offers? (Network avg ~20%)
- **Purchase Volume**: Properties acquired per quarter (High performer = 10+ per year)
- **Cycle Time**: Purchase-to-sell days (Faster = more flips/year = more profit)
- **Avg Profit Per Flip**: Network benchmark available via network_benchmarks tool
- **Active Inventory**: How many properties currently in progress?

## Territory Health Indicators
### Green (Healthy)
- 10+ purchases T12 (high performer)
- S1-S4 conversion above 15%
- Cycle time under 150 days
- EOS habits mostly A-B grades
- Diverse lead sources (3+ channels active)

### Yellow (Watch)
- 5-9 purchases T12
- Conversion 10-15%
- Cycle time 150-200 days
- Mixed EOS habits (C grades)
- Single-channel dependent

### Red (Intervention Needed)
- Under 5 purchases T12
- Conversion below 10%
- Cycle time over 200 days
- EOS habits D-F
- Properties stuck in inventory 200+ days

## Multi-Territory Expansion
Some franchisees expand to 2-3 territories. Criteria:
- Current territory at high performer status (10+ T12)
- Demonstrated systems and team in place
- Adjacent market preferred (shared contractors, knowledge)
- Additional capital for second territory operations',
  85, 900, true
);

-- ═══════════════════════════════════════════════════
-- TRAINING / TRAINUAL
-- ═══════════════════════════════════════════════════

INSERT INTO knowledge_documents (title, category, content, priority, token_count, is_active) VALUES
(
  'Trainual & Onboarding Training Guide',
  'training',
  '# Trainual & Onboarding Training Guide

## Trainual in the Sales Pipeline
Trainual is the prospect training platform. Access is gated by pipeline stage:

### Stage 1-2 (Engagement/Contacted): No access yet
Prospect is unqualified. Do not invite to Trainual.

### Stage 3 (Qualification): First 7 sections unlocked
- Our Story — NAH founding, mission, values
- Testimonials — franchisee success stories
- NAH TV — video content, virtual tours
- FRB (Franchise Review Board) — what it is, how it works
- Discovery process overview

### Stage 4-5 (Matt Call): 8 more sections unlocked
- Our Model — how the house flipping business works
- FDD Overview — what to expect in the disclosure document
- Lead Launchpad — how MasterSuite generates and scores leads
- MasterSuite Demo — walkthrough of the property management platform
- Support Systems — coaching, community, corporate support
- Coaching overview — what weekly/bi-weekly coaching looks like

### Stage 8 (FDD Issued): Financing content unlocked
- Alta Capital partnership
- Guidant Financial (ROBS) overview
- Strategic Business Plan template
- Growth Plan framework

## Trainual Completion as a Signal
- **0-25% completion**: Not engaged. May need a nudge or re-qualification.
- **25-50%**: Moderate interest. Check if they have questions or blockers.
- **50-75%**: Seriously evaluating. Good sign for conversion.
- **75-100%**: Highly engaged. Priority prospect — likely to close.
- Completion % is tracked in candidate_intelligence.trainual_completion_pct

## Nudge Logic
Scout checks trainual_status to determine if a nudge is needed:
- If framing call NOT completed → nudge to schedule framing call first
- If framing call completed + invite sent + completion < 50% + last activity > 7 days → nudge
- If completion > 75% → congratulate and push toward next pipeline stage

## Post-Award Training (Onboarding Pipeline)
Once franchise agreement is signed, Trainual switches to operator training:
- Part 1: Business Onboarding (entity setup, banking, insurance)
- Part 2: MasterSuite Mastery (property evaluation, deal analysis)
- Part 3: Goals & Planning (EOS setup, quarterly rocks, budgets)
- Onboarding Test: Must pass to advance to Launch Prep stage',
  80, 800, true
);

-- ═══════════════════════════════════════════════════
-- OPERATIONS
-- ═══════════════════════════════════════════════════

INSERT INTO knowledge_documents (title, category, content, priority, token_count, is_active) VALUES
(
  'NAH Internal Operations & Team Processes',
  'operations',
  '# NAH Internal Operations & Team Processes

## Team Roles & Responsibilities
- **Chad (Franchise Development Rep)**: Primary sales contact. Manages prospect pipeline from lead to close. Uses Scout daily for lead management, follow-ups, and coaching prep.
- **Matt (Founder)**: Conducts discovery calls (Matt Call). Final authority on franchise awards. Sets vision and strategy.
- **Sam (VP Operations)**: Conducts validation calls (Sam Call). Oversees franchisee operations post-award. Manages coaching program.
- **Mark (Lending Partner)**: Conducts capital/lending calls (Mark Call). Helps prospects navigate financing (SBA, ROBS, cash, combination).
- **Coaches**: Assigned per territory. Weekly/bi-weekly coaching calls. Track EOS habits, scorecard metrics, rocks.

## Decision Authority
- **Chad can**: Move prospects through stages, send messages, schedule calls, update profiles, log sub-tasks
- **Chad cannot**: Issue FDD (requires leadership), award franchise (requires Matt), modify pipeline stages
- **Leadership can**: All of the above plus award franchises, issue FDDs, modify pipeline, approve KB docs
- **Scout can**: Draft any action for review. Never executes without human confirmation.

## Daily Workflow (Chad)
1. Check Scout daily briefing — alerts, stale leads, upcoming calls
2. Review pipeline — who needs follow-up today?
3. Make outreach attempts on Engagement/Contacted stage leads
4. Prep for scheduled calls using Scout pre-call briefs
5. Log call outcomes and update profiles
6. Draft and send follow-up messages
7. End of day: review tomorrow schedule

## Escalation Path
- Stale lead (7+ days no touch) → Scout flags with inactivity alert
- Capital objection unresolvable → Escalate to Mark for dedicated lending call
- Prospect requests specific territory info → Use territory_performance tool or escalate to Sam
- Legal/FDD question → NEVER answer directly. Route to leadership.
- Prospect complaints → Route to Sam immediately

## Key Metrics Chad is Measured On
- Leads contacted within 5 minutes of entry
- Pipeline velocity (avg days per stage)
- Follow-up consistency (no lead goes 7+ days without touch)
- Conversion rate (leads → qualified → closed)
- Trainual nudge completion rate
- Call coaching scores (average across all calls)',
  75, 700, true
);
