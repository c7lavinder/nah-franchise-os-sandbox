# NAH Franchise Sales Pipeline

> This document defines the complete franchise sales pipeline for New Again Houses.
> It is the single source of truth for how leads move from first touch to signed franchise agreement.
> Scout uses this pipeline to guide reps, trigger automations, and enforce accountability.

---

## Pipeline Overview

The NAH franchise sales pipeline consists of **10 stages**, each with clearly defined entry/exit criteria,
time targets, Scout behaviors, and GHL automation triggers. Every lead must pass through these stages
in order. No stage may be skipped.

```
New Lead → Attempted Contact → Connected/Qualified → Discovery Call Scheduled →
Discovery Call Complete → Validation/Due Diligence → FDD Sent → In Closing →
Won (Signed) | Lost/Nurture
```

---

## Stage 1: New Lead

**Definition:** A lead has entered the system but has not yet been contacted by a rep.
This is the intake stage — the lead exists in GHL but no human outreach has occurred.

**Entry Criteria:**
- Lead captured via form submission, ad click, referral entry, or manual import
- Contact record created in GHL with at minimum: name, email or phone, and lead source

**Exit Criteria:**
- Rep has made at least one outreach attempt (call, text, or email)
- Lead moves to Attempted Contact

**Time Target:** First outreach attempt within **5 minutes** during business hours, **30 minutes** max outside business hours.

**Scout Actions:**
- Alert assigned rep immediately upon new lead arrival
- Display lead source, location, and any available context
- Suggest a first-touch message template based on lead source
- Flag if lead is not contacted within the 5-minute window

**GHL Automation Triggers:**
- Auto-assign lead to rep based on territory or round-robin rules
- Send automated speed-to-lead text/email if rep has not responded in 5 minutes
- Tag lead with source campaign and date of entry

**Accountability Rules:**
- Speed-to-lead is tracked per rep and reported weekly
- Any lead sitting in New Lead for more than 1 hour triggers a leadership alert
- Scout logs the exact time between lead entry and first outreach attempt

---

## Stage 2: Attempted Contact

**Definition:** The rep has made at least one outreach attempt, but has not yet had a live conversation
or received a qualifying response from the lead.

**Entry Criteria:**
- At least one documented outreach attempt (call, text, or email) logged in GHL
- Lead has not yet responded or engaged in a qualifying conversation

**Exit Criteria:**
- Lead responds and engages in a qualifying conversation → moves to Connected/Qualified
- Lead is unresponsive after full follow-up sequence → moves to Lost/Nurture
- Lead explicitly opts out → moves to Lost/Nurture

**Time Target:** Complete full follow-up sequence within **7 days**. Minimum **6 contact attempts**
across at least 3 channels (call, text, email).

**Scout Actions:**
- Track number of attempts and channels used
- Suggest next outreach action and optimal timing based on lead behavior
- Draft follow-up messages for rep review
- Flag leads approaching the 7-day window with no response
- Recommend stage move to Lost/Nurture if sequence is exhausted

**GHL Automation Triggers:**
- Enroll lead in multi-touch follow-up workflow (call + text + email cadence)
- Auto-log each outreach attempt with timestamp and channel
- Trigger "going cold" internal notification at day 5 with no response

**Accountability Rules:**
- Reps must complete a minimum of 6 attempts before a lead can be moved to Lost/Nurture
- Scout will block premature stage moves if attempt count is not met
- Weekly report shows each rep's attempt-to-connect ratio

---

## Stage 3: Connected/Qualified

**Definition:** The rep has had a live conversation (phone or video) with the lead and has confirmed
basic qualification criteria. The lead is a real person with genuine interest and baseline fit.

**Entry Criteria:**
- Live two-way conversation has occurred (not just a text reply)
- Rep has confirmed at minimum: the lead's interest level, general financial capacity awareness,
  and geographic preference

**Exit Criteria:**
- Discovery call is scheduled → moves to Discovery Call Scheduled
- Lead disqualified during conversation → moves to Lost/Nurture
- Lead goes unresponsive after connection → returns to Attempted Contact or Lost/Nurture

**Time Target:** Schedule a discovery call within **48 hours** of initial connection.

**Scout Actions:**
- Prompt rep to log qualification notes immediately after the call
- Auto-generate a lead summary based on rep's notes
- Suggest available discovery call time slots
- Draft a calendar invite and confirmation message for rep review
- Calculate initial lead score based on qualification data

**GHL Automation Triggers:**
- Update contact record with qualification data fields
- Tag lead as "Qualified" in GHL
- Trigger discovery call booking workflow if not scheduled within 24 hours
- Send internal Slack/email notification to leadership on new qualified lead

**Accountability Rules:**
- Rep must log qualification notes within 1 hour of the conversation
- Scout flags any Connected/Qualified lead without a scheduled discovery call after 48 hours
- Leadership receives a daily count of newly qualified leads per rep

---

## Stage 4: Discovery Call Scheduled

**Definition:** A formal discovery call has been booked on the calendar. This is the first structured
deep-dive conversation about the franchise opportunity.

**Entry Criteria:**
- Discovery call is confirmed on the calendar with date, time, and video link
- Lead has received a calendar invite and confirmation message

**Exit Criteria:**
- Discovery call is completed → moves to Discovery Call Complete
- Lead no-shows and cannot be rescheduled → moves to Lost/Nurture
- Lead cancels and reschedules → stays in this stage with updated date

**Time Target:** Discovery call should occur within **5 business days** of being scheduled.
No-shows get **2 reschedule attempts** before moving to Lost/Nurture.

**Scout Actions:**
- Send rep a pre-call prep brief 1 hour before the scheduled call
- Include lead summary, qualification notes, lead score, and suggested talking points
- Draft a reminder message to the lead for rep to send 24 hours before the call
- Draft a day-of reminder message for rep to send 1 hour before the call
- Flag upcoming no-show risk if lead has not confirmed

**GHL Automation Triggers:**
- Send automated confirmation email/text upon booking
- Send automated reminder 24 hours before the call
- Send automated reminder 1 hour before the call
- If no-show: trigger no-show follow-up workflow (call + text within 15 minutes)
- Log no-show event on contact record

**Accountability Rules:**
- Rep must conduct the call at the scheduled time — no rep-initiated reschedules without manager approval
- No-show rate is tracked per rep and per lead source
- Scout alerts leadership if any rep has more than 2 no-shows in a single week

---

## Stage 5: Discovery Call Complete

**Definition:** The discovery call has been conducted. The rep has delivered the NAH franchise overview
and assessed the lead's fit in detail. This is the critical evaluation point.

**Entry Criteria:**
- Discovery call was held and lasted a minimum of 20 minutes
- Rep has logged detailed notes covering: motivation, financial readiness, timeline,
  territory preference, and questions asked

**Exit Criteria:**
- Lead is advancing and requests or agrees to due diligence → moves to Validation/Due Diligence
- Lead needs time to think → stays in stage with a scheduled follow-up within 72 hours
- Lead is not a fit or declines → moves to Lost/Nurture

**Time Target:** Rep must log call notes within **2 hours** of call completion. Next step
must be defined within **24 hours**.

**Scout Actions:**
- Prompt rep to log discovery call notes immediately after the call
- Auto-generate a post-call summary and updated lead score
- Suggest next best action based on call outcome (advance, follow up, or nurture)
- Draft a post-call follow-up email for rep review (thank you + next steps)
- Flag if no next step is defined within 24 hours

**GHL Automation Triggers:**
- Send automated post-call thank you email (rep-approved template)
- Update contact record with discovery call data fields
- Tag lead with call outcome (advancing, thinking, declined)
- Trigger follow-up workflow if lead is in "thinking" status

**Accountability Rules:**
- Call notes are mandatory — Scout will not allow a stage move without logged notes
- Leads cannot sit in this stage for more than 7 days without a defined next step
- Leadership receives a weekly conversion rate report: Discovery Call Complete → Validation

---

## Stage 6: Validation/Due Diligence

**Definition:** The lead is actively evaluating the NAH franchise opportunity. They are reviewing
materials, asking detailed questions, and potentially speaking with existing franchisees.
This is the "convince me" stage.

**Entry Criteria:**
- Lead has expressed clear intent to continue evaluating the opportunity
- Rep has sent the franchise overview deck, territory map, or other due diligence materials

**Exit Criteria:**
- Lead is ready to receive the FDD → moves to FDD Sent
- Lead decides not to proceed → moves to Lost/Nurture
- Lead goes unresponsive for 14+ days → moves to Lost/Nurture

**Time Target:** This stage should last **7–14 days** maximum. Leads in validation for more
than 14 days are at high risk of going cold.

**Scout Actions:**
- Track which due diligence materials have been sent and opened
- Suggest validation touchpoints every 3 days (check-in calls, answer questions)
- Draft answers to common franchise questions for rep review
- Recommend connecting the lead with a current franchisee for a validation call
- Flag leads approaching the 14-day mark with no forward movement
- Update lead score based on engagement during validation

**GHL Automation Triggers:**
- Send due diligence materials package upon stage entry
- Track email/document opens and clicks
- Trigger "going stale" alert at day 10 if no rep activity logged
- Auto-schedule a franchisee validation call if lead requests one

**Accountability Rules:**
- Rep must make at least one touchpoint every 3 days during this stage
- Scout logs all material delivery and engagement metrics
- Leads in this stage for more than 14 days require a manager review before continuing or moving to Lost/Nurture

---

## Stage 7: FDD Sent

**Definition:** The Franchise Disclosure Document has been sent to the lead. This is a legally
required step — the lead must receive and acknowledge the FDD at least 14 days before signing
any franchise agreement.

**Entry Criteria:**
- FDD has been delivered to the lead with documented proof of receipt
- 14-day mandatory waiting period begins on the date of receipt

**Exit Criteria:**
- 14-day waiting period has elapsed AND lead is ready to close → moves to In Closing
- Lead decides not to proceed after reviewing FDD → moves to Lost/Nurture
- Lead goes unresponsive → moves to Lost/Nurture after follow-up sequence

**Time Target:** 14-day mandatory FDD review period (legally required — cannot be shortened).
Total time in stage should not exceed **21 days**.

**Scout Actions:**
- Track the exact FDD delivery date and calculate the 14-day window
- Display a countdown to the earliest possible close date
- Suggest check-in touchpoints during the 14-day window (day 3, day 7, day 10)
- Draft answers to FDD-related questions for rep review
- **IMPORTANT:** Scout will NEVER provide legal interpretations of the FDD
- Flag when the 14-day window has elapsed and lead is eligible to close

**GHL Automation Triggers:**
- Log FDD sent date on contact record
- Start 14-day countdown timer
- Send automated check-in emails at day 3, day 7, and day 10
- Trigger "FDD window complete" notification to rep and leadership on day 14
- Alert if lead has not engaged at all during the 14-day window

**Accountability Rules:**
- FDD delivery must be documented with proof of receipt — no exceptions
- Rep must make contact at least 3 times during the 14-day window
- Scout will block any attempt to move a lead to In Closing before the 14-day window has elapsed
- Leadership is notified of every FDD sent in real time

---

## Stage 8: In Closing

**Definition:** The lead has completed their FDD review, the 14-day waiting period has elapsed,
and both parties are actively working toward signing the franchise agreement.

**Entry Criteria:**
- 14-day FDD waiting period has elapsed
- Lead has verbally confirmed intent to sign
- Territory has been confirmed as available
- Financial requirements have been verified

**Exit Criteria:**
- Franchise agreement is signed → moves to Won (Signed)
- Lead backs out during closing → moves to Lost/Nurture
- Closing stalls for more than 14 days → requires leadership intervention

**Time Target:** Close within **14 days** of entering this stage. Total time from FDD Sent
to signed agreement should not exceed **35 days**.

**Scout Actions:**
- Generate a closing checklist: territory confirmation, financial verification, agreement prep
- Track checklist completion and flag missing items
- Draft closing-related communications for rep review
- Coordinate with legal/ops on agreement preparation
- Provide daily status updates to rep on closing progress
- Alert leadership if closing is stalling

**GHL Automation Triggers:**
- Tag lead as "In Closing" — triggers leadership visibility
- Send internal notification to ops/legal team for agreement preparation
- Track days in closing stage
- Trigger escalation alert if closing exceeds 7 days with no progress

**Accountability Rules:**
- Rep must update closing status daily
- Any lead in closing for more than 14 days requires a mandatory leadership review
- Scout escalates automatically if no activity is logged for 3 consecutive days
- All closing communications must go through the Draft → Review → Confirm pattern

---

## Stage 9: Won (Signed)

**Definition:** The franchise agreement has been fully executed. The lead is now a franchisee.
This is the successful terminal stage of the sales pipeline.

**Entry Criteria:**
- Franchise agreement is signed by both parties
- Initial franchise fee has been received
- All legal and financial requirements are met

**Exit Criteria:**
- This is a terminal stage — no further pipeline movement
- Lead is transitioned to onboarding pipeline (separate system)

**Time Target:** Transition to onboarding within **48 hours** of signing.

**Scout Actions:**
- Generate a win summary: total time in pipeline, key milestones, lead source attribution
- Draft a congratulations message to the new franchisee for rep review
- Trigger internal win notification to leadership and team
- Log final deal data for reporting and analytics
- Recommend the lead record be transitioned to the onboarding pipeline

**GHL Automation Triggers:**
- Update contact status to "Franchisee — Won"
- Send automated welcome email sequence to new franchisee
- Trigger internal celebration notification (Slack/email)
- Update pipeline reporting dashboards
- Archive the sales pipeline record and create onboarding record

**Accountability Rules:**
- Rep must log the signed agreement and fee receipt within 24 hours
- Onboarding handoff must occur within 48 hours
- Win data is used for lead source ROI analysis and rep performance tracking

---

## Stage 10: Lost/Nurture

**Definition:** The lead did not convert through the pipeline. This stage captures all leads
that are disqualified, unresponsive, or chose not to proceed — as well as leads that may
be viable in the future and should be nurtured.

**Entry Criteria:**
- Lead has been disqualified at any stage, OR
- Lead is unresponsive after completing the required follow-up sequence, OR
- Lead has explicitly declined to proceed

**Exit Criteria:**
- Lead re-engages and is moved back to the appropriate active stage
- Lead is permanently closed (marked as "Dead — Do Not Contact")

**Time Target:** Nurture sequence runs for **90 days**. After 90 days with no engagement,
lead is archived.

**Scout Actions:**
- Categorize the lost reason: unresponsive, not qualified, declined, timing, financial, other
- Recommend whether the lead should be nurtured or permanently closed
- Draft a "door open" message for rep review (for nurture-eligible leads)
- Track nurture engagement and flag leads that re-engage
- Suggest re-engagement timing based on the lost reason

**GHL Automation Triggers:**
- Tag lead with lost reason category
- Enroll nurture-eligible leads in 90-day drip campaign
- Track email opens and clicks during nurture period
- Trigger re-engagement alert if lead opens 3+ emails or clicks a link
- Auto-archive after 90 days with zero engagement

**Accountability Rules:**
- Every lost lead must have a documented lost reason — no exceptions
- Reps cannot move leads to Lost/Nurture without completing the required follow-up attempts
- Leadership receives a weekly lost lead analysis: reasons, stages, and lead sources
- Re-engaged leads are flagged as high priority and must be contacted within 24 hours

---

## Lead Scoring Model

Scout calculates a lead score from **1–100** for every lead in the pipeline. The score is
dynamic and updates as new information is gathered. The score is used to prioritize rep
activity, trigger automations, and inform leadership reporting.

### Scoring Criteria

| Factor | Weight | Description |
|--------|--------|-------------|
| **Lead Source Quality** | 20% | How the lead found NAH. Referrals and organic search score highest. Paid social scores lowest. Based on historical conversion rates by source. |
| **Capital Awareness** | 20% | Does the lead understand the financial requirements? Have they confirmed access to the required capital? Self-reported financial readiness. |
| **Territory Availability** | 15% | Is the lead's preferred territory available? Open territories score 15/15. Waitlisted or contested territories score lower. |
| **Engagement Level** | 15% | How responsive and engaged is the lead? Measures response time, email opens, calls answered, questions asked, and materials reviewed. |
| **Business Ownership Experience** | 15% | Has the lead owned or operated a business before? Prior franchise experience scores highest. No business experience scores lowest. |
| **Timeline** | 15% | How soon does the lead want to get started? "Immediately" or "within 30 days" scores highest. "Just exploring" or "12+ months" scores lowest. |

### Score Breakdown by Factor

#### Lead Source Quality (20 points max)
| Source | Points |
|--------|--------|
| Referral from existing franchisee | 20 |
| Organic search / SEO | 18 |
| Direct inquiry (website form) | 16 |
| Franchise broker | 14 |
| Franchise portal (e.g., Franchise Gator) | 12 |
| Paid search (Google Ads) | 10 |
| Paid social (Facebook/Instagram Ads) | 8 |
| Cold list / purchased lead | 4 |

#### Capital Awareness (20 points max)
| Level | Points |
|-------|--------|
| Confirmed liquid capital meets or exceeds requirements | 20 |
| Aware of requirements, believes they qualify | 15 |
| Aware of requirements, exploring financing options | 10 |
| Unaware of financial requirements | 5 |
| Declined to discuss finances | 2 |

#### Territory Availability (15 points max)
| Status | Points |
|--------|--------|
| Preferred territory is fully open | 15 |
| Preferred territory is available with minor overlap | 12 |
| Preferred territory is waitlisted — open soon | 8 |
| Preferred territory is unavailable — willing to consider alternatives | 5 |
| Preferred territory is unavailable — unwilling to relocate | 2 |

#### Engagement Level (15 points max)
| Behavior | Points |
|----------|--------|
| Responds within 1 hour, asks detailed questions, reviews all materials | 15 |
| Responds within 24 hours, moderate engagement | 12 |
| Responds within 48 hours, minimal engagement | 8 |
| Responds sporadically, low engagement | 4 |
| Unresponsive or single-response only | 1 |

#### Business Ownership Experience (15 points max)
| Experience | Points |
|------------|--------|
| Prior franchise ownership | 15 |
| Prior business ownership (non-franchise) | 12 |
| Senior management / executive experience | 9 |
| Mid-level professional experience | 6 |
| Entry-level or no business experience | 3 |

#### Timeline (15 points max)
| Timeline | Points |
|----------|--------|
| Ready to start immediately / within 30 days | 15 |
| Within 60 days | 12 |
| Within 90 days | 9 |
| Within 6 months | 6 |
| 6–12 months | 3 |
| 12+ months or "just exploring" | 1 |

### Score Tiers

| Tier | Score Range | Meaning | Scout Behavior |
|------|-------------|---------|----------------|
| **Hot** | 80–100 | High-priority lead. Strong fit across all criteria. | Scout prioritizes this lead in all rep dashboards. Recommends immediate action. Alerts leadership. |
| **Warm** | 60–79 | Good potential. Some criteria need validation. | Scout keeps this lead visible. Suggests regular follow-up cadence. Flags areas that need strengthening. |
| **Cool** | 40–59 | Moderate potential. Multiple criteria are weak or unknown. | Scout recommends qualification focus. Suggests specific questions to improve score. Lower priority in rep queue. |
| **Cold** | Below 40 | Low priority. Poor fit or insufficient information. | Scout deprioritizes but does not discard. Recommends nurture sequence. Flags if score improves over time. |

### Score Update Triggers

The lead score recalculates automatically when:
- New qualification data is entered by the rep
- Lead moves to a new pipeline stage
- Engagement activity is detected (email open, call answered, material viewed)
- Territory availability changes
- Rep logs new notes with relevant information

---

## Accountability Triggers — Summary Table

| Trigger | Condition | Action |
|---------|-----------|--------|
| **Speed-to-Lead Alert** | New lead not contacted within 5 minutes | Scout alerts rep + flags for leadership |
| **Stale Lead Alert** | Lead in New Lead stage for 1+ hour | Leadership notification |
| **Attempt Count Block** | Rep tries to move lead to Lost/Nurture with fewer than 6 attempts | Scout blocks the move |
| **Connection Follow-Up** | Connected/Qualified lead with no discovery call scheduled in 48 hours | Scout flags for rep + leadership |
| **No-Show Escalation** | Rep has 3+ no-shows in a week | Leadership alert |
| **Post-Call Notes Missing** | Discovery call completed but no notes logged within 2 hours | Scout prompts rep, blocks stage move |
| **Validation Going Stale** | Lead in Validation/Due Diligence for 10+ days with no rep activity | Scout alerts rep + leadership |
| **Validation Timeout** | Lead in Validation/Due Diligence for 14+ days | Mandatory manager review |
| **FDD Window Block** | Rep tries to move lead to In Closing before 14-day FDD window | Scout blocks the move |
| **FDD Engagement Alert** | Lead has zero engagement during 14-day FDD window | Scout alerts rep at day 7 |
| **Closing Stall** | No activity logged in In Closing for 3+ consecutive days | Scout escalates to leadership |
| **Closing Timeout** | Lead in In Closing for 14+ days | Mandatory leadership review |
| **Lost Reason Required** | Rep moves lead to Lost/Nurture without a documented reason | Scout blocks the move |
| **Nurture Re-Engagement** | Lost/Nurture lead opens 3+ emails or clicks a link | Scout alerts rep — high priority callback |
| **Nurture Archive** | Lead in Lost/Nurture for 90 days with zero engagement | Auto-archive |
| **Daily Rep Scorecard** | End of each business day | Scout generates daily activity + pipeline health summary per rep |
| **Weekly Pipeline Review** | End of each week | Scout generates full pipeline report for leadership |
