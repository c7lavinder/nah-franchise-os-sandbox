-- KB Expansion — Growth Pillar Foundation Documents
-- Organized around 4 pillars: More Leads, Better Conversion, Faster Onboarding, More Houses
-- Plus cross-cutting: Brand, Operations, Business Planning, Governance

-- ═══════════════════════════════════════════════════
-- PILLAR 1: MORE LEADS
-- ═══════════════════════════════════════════════════

INSERT INTO knowledge_documents (title, category, content, priority, token_count, is_active) VALUES
(
  'Marketing Strategy & Lead Generation Playbook',
  'marketing',
  '# Marketing Strategy & Lead Generation Playbook

## Primary Lead Sources
- **Franchise broker networks** — largest source of qualified leads
- **Digital marketing** — Google Ads, Facebook/Instagram, LinkedIn
- **Content marketing** — SEO, blog, YouTube (house flipping education)
- **Referral program** — existing franchisees referring prospects
- **Trade shows & franchise expos** — Discovery Days, IFA events

## Target Prospect Profile
- Ages 30-55, entrepreneurial mindset
- $100K-$300K liquid capital (or access via ROBS/SBA)
- Interested in real estate but may lack experience
- Values systems and support over going solo
- Often exploring multiple franchise concepts simultaneously

## Messaging Framework
- **Lead with the model, not the brand** — "proven system for house flipping"
- **Reframe investment as asset** — not spending money, buying a business
- **Surface financing early** — ROBS, SBA, Guidant Financial, Alta Capital
- **Differentiate from solo flipping** — 80% of solo flippers fail year one
- **Territory exclusivity** — protected market, no internal competition

## Key Metrics to Track
- Cost per lead by source
- Lead-to-intro-call conversion rate
- Intro-call-to-qualification rate
- Average days from lead to signed FA
- Broker network conversion rates

_Auto-updated by Scout from call intelligence. Last manual review needed._',
  90, 700, true
),
(
  'Lead Source Performance & Insights',
  'lead_generation',
  '# Lead Source Performance & Insights

_This document is auto-maintained by Scout from call transcripts. When prospects mention how they found NAH, it gets logged here._

## How to use this document
- Review monthly to identify top-performing lead sources
- Adjust marketing spend based on conversion quality, not just volume
- Track which sources produce prospects who actually close

## Known High-Quality Sources
- Franchise broker introductions (pre-qualified, serious buyers)
- Referrals from existing franchisees (warm, trust already established)
- Google search "house flipping franchise" (high intent)

## Known Lower-Quality Sources
- Social media ads (high volume, low qualification rate)
- Generic "franchise opportunity" directories

_Scout will append new lead source insights from every call below._',
  70, 400, true
);

-- ═══════════════════════════════════════════════════
-- PILLAR 2: BETTER CONVERSION
-- ═══════════════════════════════════════════════════

INSERT INTO knowledge_documents (title, category, content, priority, token_count, is_active) VALUES
(
  'FDD Strategy — Franchise Disclosure Document Playbook',
  'fdd',
  '# FDD Strategy — Franchise Disclosure Document Playbook

## FDD Timeline
1. **FDD Sent** — after NDA signed and Matt call completed
2. **14-Day Cooling Period** — legally required minimum before signing
3. **FDD Review Call** — Chad walks through key items, addresses concerns
4. **Item 23 Receipt** — prospect signs acknowledgment of receipt
5. **Territory Call** — deep dive on specific territory after FDD review

## Common FDD Concerns (and how to handle)
- **Royalty fees seem high** → Show total cost of going solo vs. NAH ecosystem value
- **Litigation history** → Be transparent, explain context, show resolution
- **Territory restrictions** → Frame as protection — exclusive market, no cannibalization
- **Financial performance representations** → Point to Item 19, explain ranges honestly
- **Renewal terms** → Explain franchise lifecycle and renewal process

## Rules for Reps
- NEVER provide legal advice on FDD
- NEVER rush the 14-day period
- ALWAYS encourage prospect to have attorney review
- ALWAYS schedule the FDD review call within 3 days of sending
- Chad does the framing call BEFORE Trainual invite (84% never open without it)

## Key FDD Items to Emphasize
- Item 5: Initial fees and what they cover
- Item 6: Ongoing fees (royalties, marketing fund)
- Item 7: Estimated initial investment range
- Item 19: Financial performance representations
- Item 20: Territory definition and exclusivity
- Item 23: Receipt acknowledgment

_Scout auto-updates this with FDD questions and concerns extracted from calls._',
  85, 800, true
),
(
  'Conversion Playbook — Stage-by-Stage Tactics',
  'conversion_playbook',
  '# Conversion Playbook — Stage-by-Stage Tactics

## Engagement → Qualification
**Goal:** Get prospect from "interested" to "committed to evaluating"
- Chad intro call: build rapport, understand why, surface capital situation
- Trainual invite: ONLY after Chad framing call (not cold)
- PTO acceptance: prospect commits to learning the model
- **Key metric:** Intro call to PTO acceptance < 7 days

## Qualification → Discovery
**Goal:** Validate fit on both sides
- NDA signed: signals seriousness
- Matt call: ownership mindset assessment, commitment level
- Zorakle assessment: personality/work style fit
- **Key metric:** Qualification stage < 14 days

## Discovery → Compliance
**Goal:** Deep validation and financial readiness
- Sam call: MasterSuite demo, typical deal walkthrough
- PFS received: financial picture documented
- Background check: standard due diligence
- Mark call: capital strategy, financing options
- **Key metric:** Discovery stage < 21 days

## Compliance → Awarding
**Goal:** FDD reviewed, territory selected, ready to sign
- FDD sent and Item 23 receipt signed
- FDD review call with Chad
- Territory call: specific market deep dive
- FA info gathering: entity details, insurance prep
- **Key metric:** Compliance stage < 21 days

## Awarding → Closed
**Goal:** Sign the Franchise Agreement
- Matt final call: last ownership conversation
- Franchise Award Letter sent and accepted
- FA signed
- Franchise fee paid
- **Key metric:** Awarding stage < 14 days

## Top Deal Loss Reasons
1. Capital concerns (most common) — surface financing options early
2. Timing — often capital or confidence in disguise
3. Chose competitor — need better differentiation earlier
4. Territory unavailability — show adjacent options
5. Going cold — value-based nurture, surface to Chad for personal touch

_Scout auto-updates this with conversion insights from calls._',
  85, 800, true
);

-- ═══════════════════════════════════════════════════
-- PILLAR 3: FASTER ONBOARDING
-- ═══════════════════════════════════════════════════

INSERT INTO knowledge_documents (title, category, content, priority, token_count, is_active) VALUES
(
  'Franchisee Success Playbook — Setup to First Flip',
  'franchisee_playbook',
  '# Franchisee Success Playbook — Setup to First Flip

## Phase 1: Setup (Weeks 1-4)
- Entity formation (LLC/Corp) and EIN
- Business bank account
- Insurance: GL, E&O, workers comp
- Systems access: GHL, MasterSuite, Lead Launchpad
- Workstation setup: computer, phone, signage
- **Milestone:** All systems operational

## Phase 2: Training (Weeks 2-8)
- Part 1: NAH Onboarding (brand, model, expectations)
- Part 2: MasterSuite Training (deal analysis, comp running, offer generation)
- Part 3: Goals & Planning (territory strategy, first 90-day plan)
- Onboarding Test: knowledge verification
- **Milestone:** Test passed, goals documented

## Phase 3: Launch Prep (Weeks 6-12)
- Territory finalized and marketing plan set
- Marketing live (Lead Launchpad activated, direct mail started)
- First lead in pipeline
- First offer sent
- **Milestone:** Active in market with offers going out

## Phase 4: First Deals (Months 3-6)
- 10 offers sent (building deal flow muscle)
- First property under contract
- First closing
- Construction/rehab started
- **Milestone:** First property purchased and in rehab

## Critical Success Factors
- Weekly coaching calls with John (mandatory first 6 months)
- 100+ offers in first year (velocity matters more than precision)
- Build contractor network in first 60 days
- Use MasterSuite for EVERY deal analysis (no gut-feel deals)
- Attend all cohort calls and weekly franchisee meetings

## Common Failure Patterns
- Analysis paralysis: sending too few offers
- Skipping MasterSuite: doing deals on gut feel
- Contractor dependency: only having one contractor
- Isolation: not attending group calls or asking for help
- Capital mismanagement: over-improving first property

_Scout auto-updates this with onboarding insights from coaching calls._',
  85, 900, true
),
(
  'Onboarding Operations — Process & Checklists',
  'onboarding_ops',
  '# Onboarding Operations — Process & Checklists

## New Franchisee Kickoff (Day 1)
- [ ] Welcome call with Chad
- [ ] Access credentials sent (GHL, MasterSuite, Trainual, Lead Launchpad)
- [ ] Entity formation guidance document sent
- [ ] Insurance requirements checklist sent
- [ ] Onboarding pipeline entry created
- [ ] First coaching call scheduled with John

## Weekly Check-ins (First 90 Days)
- Week 1-2: Systems setup verification
- Week 3-4: Training progress check (Part 1 should be complete)
- Week 5-6: MasterSuite proficiency check
- Week 7-8: Marketing launch readiness
- Week 9-12: First offers review, deal pipeline check

## Trainual Completion Targets
- Week 2: Part 1 (Onboarding) complete
- Week 4: Part 2 (MasterSuite) complete
- Week 6: Part 3 (Goals & Planning) complete
- Week 8: Onboarding Test passed
- **Critical:** 84% of prospects never open Trainual when invited cold. Chad framing call must happen first.

## Escalation Triggers
- No Trainual activity after 7 days → Chad follow-up call
- No offers sent after 60 days → John intensive coaching session
- No property under contract after 120 days → Leadership review

_Scout auto-updates this with process insights from team and coaching calls._',
  80, 600, true
);

-- ═══════════════════════════════════════════════════
-- PILLAR 4: MORE HOUSES
-- ═══════════════════════════════════════════════════

INSERT INTO knowledge_documents (title, category, content, priority, token_count, is_active) VALUES
(
  'Deal Execution — Acquisitions, Rehabs & Sales',
  'deal_execution',
  '# Deal Execution — Acquisitions, Rehabs & Sales

## Deal Pipeline
1. **Lead** — property identified (Lead Launchpad, direct mail, MLS, wholesaler)
2. **Walkthrough** — in-person property evaluation
3. **Offer** — MasterSuite-generated offer submitted
4. **Under Contract** — offer accepted, due diligence period
5. **Closing** — purchase closed, property in inventory
6. **Rehab** — construction/renovation in progress
7. **Listed** — property on market for sale
8. **Sold** — buyer closes, profit realized

## MasterSuite Deal Analysis
- Run comps for ARV (After Repair Value)
- Calculate rehab estimate using MasterSuite scope builder
- Apply 70% rule: Purchase Price ≤ (ARV × 0.70) - Rehab Cost
- Factor holding costs: 6 months carrying at minimum
- Target minimum profit: $30K on standard flip

## Key Metrics for Franchisees
- Offers sent per month (target: 10+)
- Offer-to-contract ratio
- Average purchase price
- Average rehab cost and timeline
- Average profit per flip
- Average days from purchase to sale
- Properties in inventory at any time

## Common Deal Execution Issues
- Overpaying (not using MasterSuite comps)
- Underestimating rehab costs (scope creep)
- Contractor delays (single contractor dependency)
- Over-improving for the neighborhood
- Holding too long (carrying costs eat profit)

_Scout auto-updates this with deal intelligence from coaching and team calls._',
  80, 600, true
);

-- ═══════════════════════════════════════════════════
-- CROSS-CUTTING: BUSINESS PLANNING & GOVERNANCE
-- ═══════════════════════════════════════════════════

INSERT INTO knowledge_documents (title, category, content, priority, token_count, is_active) VALUES
(
  'Business Planning — EOS, Quarterly Rocks & Growth Targets',
  'business_planning',
  '# Business Planning — EOS, Quarterly Rocks & Growth Targets

## 2026 Growth Targets (Hyper-Growth Year)
- Scale from current franchisee count to 250+ territories
- HQ team growth from current to 15+ team members
- Four growth pillars: More leads, better conversion, faster onboarding, more houses

## EOS Framework
- **Vision:** NAH is the dominant house flipping franchise in North America
- **Traction:** Weekly L10 meetings, quarterly rocks, scorecard reviews
- **People:** Right people in right seats (GWC: Get it, Want it, Capacity)
- **Process:** Documented core processes, followed by all, measured

## Quarterly Rocks Template
Each quarter, leadership sets 3-7 rocks across the 4 pillars:
- **Pillar 1 Rock example:** "Launch 3 new lead sources generating 50+ leads/month each"
- **Pillar 2 Rock example:** "Reduce avg sales cycle from X to Y days"
- **Pillar 3 Rock example:** "Get 100% of new franchisees to first offer within 60 days"
- **Pillar 4 Rock example:** "Increase avg houses purchased per franchisee by 25%"

## Scorecard Metrics (Weekly)
- New leads this week
- Intro calls completed
- PTOs sent and accepted
- FAs signed
- Franchisees onboarded
- Total houses purchased (network-wide)
- Revenue (franchise fees + royalties)

_Scout auto-updates this with strategic decisions from team calls._',
  90, 600, true
),
(
  'Governance — Policies, Decision Authority & Pricing',
  'governance',
  '# Governance — Policies, Decision Authority & Pricing

## Decision Authority Matrix
| Decision | Authority | Approval |
|----------|-----------|----------|
| New franchise award | Matt final call + Chad | Leadership consensus |
| Territory assignment | Chad + territory analysis | Matt approval |
| Pricing exceptions | Leadership only | Documented rationale |
| Marketing spend > $5K | Marketing lead | Chad approval |
| Process changes | Proposer + leadership | L10 meeting vote |
| New team hire | Hiring manager | Chad + Matt |
| Franchisee termination | Legal review required | Leadership + legal |

## Pricing Structure (Do NOT share with prospects — internal only)
- Refer to FDD Item 5 and Item 7 for prospect-facing numbers
- All pricing discussions with prospects must go through Chad or Matt
- No discounts or exceptions without leadership approval

## Communication Protocols
- **Prospect comms:** Draft → review → confirm before sending (Scout enforces this)
- **Franchisee comms:** Direct communication allowed, escalate issues to leadership
- **Legal matters:** NEVER provide legal advice. Direct to franchise attorney.
- **FDD questions:** Answer factual questions only. "I''d recommend having your attorney review that section."

## Compliance Requirements
- 14-day FDD cooling period (no exceptions, legally required)
- State registration requirements vary — check before selling in new states
- Franchise agreement amendments require legal review
- Advertising claims must be substantiated by Item 19 data

_Scout auto-updates this with governance decisions from team calls._',
  85, 500, true
);
