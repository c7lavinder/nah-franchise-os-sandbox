# pipeline.md — NAH Franchise Sales Pipeline (v2)

> Last updated: 2026-03-24
> This is the upgraded pipeline based on top franchisor best practices.
> 11 active stages + 4 exit stages across 3 pipelines.
> Scout knows every stage, every Trainual section, every automation trigger.
> Chad is the orchestrator of the entire journey — he never fully hands off.

---

## Pipeline Philosophy

This is a mutual vetting process — not a traditional sales funnel.
NAH is vetting the prospect as much as the prospect is vetting NAH.
Multiple team members touch prospects at specific stages.
Chad owns the full journey but orchestrates team member involvement.

Three core principles:
1. Emotional buy-in BEFORE legal docs (Trainual does this)
2. Legal compliance DURING FDD (compliance gate enforces this)
3. Financial commitment BEFORE closing (application stage creates this)

---

## Product Goal

The goal of NAH Franchise OS is to keep all team members OUT of GHL.
Nobody should need to open GHL directly. Scout is the interface.
Chad, Matt, Sam, and Mark interact with prospects through Scout and the OS —
Scout reads from GHL, writes to GHL, and surfaces everything the team needs.
GHL is the backend database. The OS is the frontend.

## Chad's Role — Orchestrator

Chad is the orchestrator and relationship owner throughout the entire prospect journey. He never fully hands off. Other team members (Matt, Sam, Mark) run specific calls at specific stages, but Chad is always the one who:
- Schedules the right call with the right person
- Follows up to ensure calls are completed
- Logs outcomes after each call
- Moves the prospect to the next stage
- Scout helps Chad know who needs what and when

## Automation Philosophy

Chad splits time between coaching franchisees and guiding prospects.
Every stage must have maximum automation so Chad focuses only on calls.

Scout handles automatically:
- Drafting all outreach messages (Chad confirms and sends)
- Scheduling team member intro calls
- Tracking Trainual section completion
- Firing GHL automations on stage moves
- Flagging stalled leads before they fall through cracks
- Building pre-call briefs for Chad (and for Matt/Sam/Mark before their calls)
- Logging all outcomes and updating lead scores

Chad handles only:
- Scheduling and coordinating calls
- Logging call notes (minimum one sentence)
- Confirming Scout's drafted actions
- Moving leads through stages after key milestones

---

## Three Pipelines

| Pipeline | Stages | Purpose |
|---------|--------|---------|
| Pipeline 1 — Active | Stages 1–11 | Prospects actively moving toward becoming franchisees |
| Pipeline 2 — Long-term | Follow-up, Nurture, Re-engaged | Prospects not ready now but have future potential |
| Pipeline 3 — Closed | Won, Lost | Final outcomes — no active work needed |

Moving between pipelines preserves full history.
Re-engaged leads from Pipeline 2 return to Pipeline 1 at the appropriate stage.
Full Trainual progress and all contact history travels with the lead always.

---

## PIPELINE 1 — ACTIVE STAGES

---

### Stage 1 — New Lead

**Definition:** A prospect has expressed interest for the first time.

**Entry:** Form fill, paid ad, referral, organic inquiry
**Exit:** First contact attempt made within 5 minutes

**Trainual unlocked:** Welcome · What We Want · What We Do · How It Works · Our Expectations · Success · NDA

**Chad's job:** Confirm assignment. Scout handles first outreach.

**Scout actions (automatic):**
- Score lead based on source, form data, territory availability
- Draft first outreach text for Chad to review and confirm
- Create task: "Call [Name] within 5 minutes"
- Notify Chad via in-app alert immediately

**GHL automation:** Trigger "New Lead Welcome" sequence — automated intro text fires while Chad is dialing

**Accountability:**
- No contact attempt in 24hr → alert Chad + leadership
- 5-minute contact rule: Scout creates urgent task immediately on lead entry

---

### Stage 2 — Contacted

**Definition:** Chad has made at least one contact attempt. Not yet connected.

**Entry:** At least one outbound call, text, or email logged
**Exit:** Live conversation with prospect achieved

**Trainual:** None yet — prospect has not been qualified

**Chad's job:** Keep attempting contact across channels.

**Scout actions (automatic):**
- Draft multi-touch follow-up sequence variations (text, email, voicemail)
- Recommend next best contact channel based on lead source
- Track attempt count — flag if 5+ attempts with no response
- Surface any email opens or link clicks from GHL tracking

**GHL automation:** Trigger "Active Follow-up" sequence — day 1, 3, 5, 7 touches

**Accountability:**
- No connection after 7 days → flag as at-risk, suggest Pipeline 2 move
- All attempts must be logged — Scout reminds Chad after each attempt

---

### Stage 3 — Qualified

**Definition:** Chad has spoken with the prospect and confirmed basic fit.

**Entry criteria (all required):**
- Live conversation completed
- Capital awareness confirmed (knows investment range)
- Territory interest confirmed (available territory near them)
- Genuine interest in business ownership expressed
- NDA sent or signed

**Exit:** Discovery call scheduled
**Time target:** Discovery call booked within 48 hours of qualification

**Trainual unlocked:** Our Story · Our Franchise Owners · Franchise Owner Testimonials · What Franchise Owners and NAH Do Together · NAH TV · Franchise Business Review · What We Are Not · Schedule Call With Guidant Financial

**Chad's job:** Run qualification framework, log scorecard, book discovery call.

**Scout qualification scorecard (Chad logs after call):**
- Capital availability: Confirmed / Needs verification / Unknown
- Timeline: Under 6 months / 6–12 months / 12+ months
- Business ownership experience: Yes / No
- Territory: Available / Waitlist / Unavailable
- Motivation clarity: Strong / Moderate / Weak
- Overall fit score: Scout calculates 1–100 based on above

**Scout actions:**
- Surface qualification scorecard for Chad to complete
- Suggest discovery call talking points based on scorecard
- Draft "thanks for connecting" message with discovery call booking link
- Flag weak fits with score below 40 — suggest nurture vs active

**GHL automation:** Trigger "Qualified Lead" sequence — prospect receives Trainual section access

**Accountability:**
- Discovery call not booked in 72hr → task created for Chad

---

### Stage 4/5 — Matt Call (Discovery)

**GHL stage name:** "Matt Call"

**Definition:** The Matt Call is the Discovery call. Prospect meets the franchisor.
This is the most important call in the pipeline. Matt is the founder — this is where
the prospect decides whether they believe in NAH and whether NAH believes in them.

**Entry:** Appointment created in GHL with confirmed date and time
**Exit:** Call completed, notes logged, Chad confirms prospect is a fit → moves to Sam Call

**Trainual unlocked:** Our Model · FDD Overview · Foundational Systems · Flip Simulator · Lead Launchpad · MasterSuite · Support Hubs · Coaching

**Who runs the call:** Matt (Franchisor)
**Who schedules:** Chad (Scout drafts the scheduling message, Chad confirms and sends)
**Who follows up:** Chad (logs outcome, scores the lead, moves to next stage)

**What Matt covers on the call:**
- Why NAH exists — the vision and mission
- What NAH culture looks like — who succeeds and why
- What Matt looks for in franchisees
- Whether this prospect has what it takes
- Honest assessment of fit from the franchisor's perspective

**Chad's job:** Schedule the Matt Call. Send Matt the pre-call brief. After the call, log Matt's outcome notes, update Scout, and move the prospect forward.

**Scout actions:**
- Build pre-call brief for Chad to send to Matt: who is this person, what do we know, Trainual progress, lead score, key talking points
- Draft 24-hour reminder message to prospect (Chad confirms)
- Draft 1-hour reminder message to prospect (Chad confirms)
- After call: prompt Chad to log outcome and complete discovery scorecard
- Based on notes, draft recap email to prospect with next steps (Chad confirms)
- Update lead score based on call outcome
- If fit confirmed → suggest Sam Call stage move
- If weak fit → flag for leadership review before continuing

**GHL automation:** Send automated reminder sequence (24hr + 1hr before call)

**Accountability:**
- No-show with no reschedule in 24hr → auto-task for Chad to reschedule
- No notes logged within 2 hours of call → reminder to Chad

---

### Stage 6 — Sam Call (Validation)

**GHL stage name:** "Sam Call"

**Definition:** The Sam Call is the Validation call. Prospect vets the business
operations with the VP. Sam gives honest, detailed answers about what running
a NAH franchise actually looks like day-to-day.

**Entry:** Strong discovery scorecard from Matt Call + Chad confirms fit
**Exit:** Sam Call completed + Chad logs outcome → moves to Mark Call

**Trainual unlocked:** New Again Ecosystem · New Again Ecosystem Visual · Lowe's · The Business You Will Build · Building Your Construction Capacity · Our Construction Onboarding Strategy · Building the Real Estate Agent Partnership

**Who runs the call:** Sam (VP)
**Who schedules:** Chad (Scout drafts the scheduling message and a briefing note for Sam)
**Who follows up:** Chad (logs outcome, moves to Mark Call stage)

**What Sam covers on the call:**
- Day-to-day operations — what running a NAH franchise actually looks like
- Support systems — what NAH provides and how it works in practice
- What success looks like — real examples and realistic expectations
- Honest answers to hard questions — Sam does not sugarcoat

**Chad's job:** Schedule the Sam Call. Send Sam the briefing note (Scout drafts it). After the call, log Sam's outcome notes and move the prospect to the Mark Call stage.

**Scout actions:**
- Draft scheduling message to prospect for Chad to confirm and send
- Draft briefing note to Sam with prospect context, Matt Call outcome, key concerns
- After call: prompt Chad to log outcome
- Build validation summary based on Sam's feedback
- Flag any red flags surfaced during the call
- If positive → suggest Mark Call stage move
- If concerns → flag for leadership review

**GHL automation:** Trigger "Validation" sequence — prospect receives ecosystem Trainual content

**Accountability:**
- Sam Call not scheduled within 5 days → task for Chad
- Outcome not logged within 2 hours of call → reminder to Chad

---

### Stage 6.5 — Compliance Gate

**Definition:** A mandatory checkpoint before any legal documents are issued.
This stage protects NAH legally and ensures the prospect is serious before FDD.

**Entry:** All three validation calls completed
**Exit:** Compliance checklist 100% complete — Scout enforces, cannot be bypassed

**Chad's job:** Complete the compliance checklist with Scout. This is not optional.

**Compliance checklist (all must be checked before stage move allowed):**
- [ ] No earnings claims were made at any point in the sales process
- [ ] Prospect has not been shown projected income, ROI, or profit figures outside of Item 19 (NAH does not make earnings claims)
- [ ] All conversations have used legal-safe language about the opportunity
- [ ] Prospect has been clearly told FDD contains all material information
- [ ] Prospect is confirmed serious — has had all three validation calls
- [ ] Territory is confirmed available for this prospect
- [ ] Chad has leadership sign-off to proceed to FDD

**Scout actions:**
- Present compliance checklist to Chad — must check every box
- Stage move to FDD Issued is HARD BLOCKED until all boxes checked
- Log compliance completion with timestamp and Chad's user ID
- Alert leadership that FDD is being issued

**Note:** NAH does not make earnings claims. This compliance gate confirms that no earnings claims were made during the sales process and that all conversations have been legally safe.

---

### Stage 7 — Application + Approval

**Definition:** Prospect formally applies to become a NAH franchisee.
Financial commitment separates serious candidates from tire kickers.

**Entry:** Compliance gate passed
**Exit:** Application approved by leadership + territory formally reserved

**⚠️ PENDING ATTORNEY REVIEW**
The specific requirements for this stage (application fee amount, background check process, financial verification method, territory reservation deposit amount) must be confirmed with NAH's franchise attorney before being built into the software.

**Placeholder structure (to be confirmed):**
- Formal written application submitted
- Background check initiated
- Financial verification completed
- Territory formally reserved
- Application reviewed and approved by leadership
- Application fee paid (amount TBD — attorney to confirm)
- Territory reservation deposit (amount TBD — attorney to confirm)

**Scout actions:**
- Present application checklist to prospect via Chad
- Track each checklist item completion
- Alert leadership when application is ready for review
- Stage move to FDD Issued blocked until leadership marks approved
- Log all financial commitments (not amounts — just confirmation received)

**Accountability:**
- Application not submitted within 5 days → task for Chad
- Leadership review pending more than 3 days → alert leadership

---

### Stage 8 — FDD Issued

**Definition:** The Franchise Disclosure Document has been formally delivered.
The 14-day legal clock starts the moment FDD is delivered.

**Entry:** Application approved + FDD formally delivered to prospect
**Exit:** 14 calendar days after FDD delivery (legal minimum)

**Trainual unlocked:** Financing and Growth · Capital · Alta Capital · Strategic Business Plan · Growth Plan · Additional Testimonials

**Chad's job:** Legal-safe check-ins only during the 14-day window. No pressure.

**Scout actions (automatic):**
- Start 14-day countdown timer — visible on lead card
- Hard block on moving to Stage 9 until day 14 passes
- Draft legal-safe check-in messages for days 3, 7, 10 (Chad confirms each)
- Answer prospect FDD questions through Chad — Scout provides legal-safe talking points only
- Always append: "For legal questions, please consult your attorney"
- Alert Chad on day 14 that closing window is open

**GHL automation:** Trigger "FDD Nurture" sequence — educational content during wait period (not sales content)

**Accountability:**
- Chad must not pressure prospect during 14 days — Scout will flag urgency language in notes

---

### Stage 9 — Mark Call (Capital/Lending Conversation)

**GHL stage name:** "Mark Call"

**Definition:** The Mark Call is a dedicated lending and capital conversation.
Capital is the #1 objection in franchise sales. Mark walks the prospect through
every funding option so they know exactly how to pay for it before the final decision.
Mark deserves dedicated pipeline visibility because removing the capital blocker
is the single highest-leverage conversation in the process.

**Entry:** 14 days since FDD delivery confirmed by Scout
**Exit:** Mark confirms financial viability → moves to Award + Agreement, or declines → Lost/Nurture

**Trainual:** Traits of High Performing Owner · Contact Current Franchise Owners

**Who runs the call:** Mark (Lending Partner)
**Who schedules:** Chad (Scout drafts the scheduling message)
**Who follows up:** Chad (logs outcome, confirms financial viability, moves to next stage)

**What Mark covers on the call:**
- Cash funding — paying out of pocket
- SBA loans — process, timeline, and qualification
- ROBS (Rollover for Business Startups) — using retirement funds without early withdrawal penalties
- Alta Capital and Guidant Financial — specific partner options
- What financial qualification looks like — realistic picture
- Whether this prospect can actually fund the franchise

**Why this is its own stage:**
Capital is the #1 objection. Getting Mark on a dedicated call builds confidence
and removes the biggest blocker. Previously this was buried inside Validation —
now it has its own pipeline stage so Chad and Scout can see exactly where
prospects are in the capital conversation.

**Chad's job:** Schedule the Mark Call. After the call, log Mark's financial assessment. If capital is confirmed viable, move to Award + Agreement. If not viable, move to Nurture or Lost.

**Scout actions:**
- Draft scheduling message for Chad to confirm
- Build pre-call brief with full prospect history from Stage 1 to now
- After call: prompt Chad to log outcome and financial viability confirmation
- If financially viable → suggest Award + Agreement stage move, notify leadership
- If hesitating on capital → suggest specific financing objection handling
- If not viable → suggest Lost or Nurture with reason

**Accountability:**
- Chad must log outcome within 2 hours of call
- No Mark Call scheduled within 5 days of FDD day 14 → alert leadership

---

### Stage 10 — Award + Agreement

**Definition:** Prospect has committed. Franchise agreement is being executed.

**Entry:** Verbal commitment from Stage 9 call
**Exit:** Franchise agreement signed by both parties

**Trainual unlocked:** Territories and Review · Territory Definition · Submit Info to Request Franchise Agreement · Franchise Agreement and Final Steps · Award

**Chad's job:** Coordinate agreement execution. Scout manages the checklist.

**Scout actions:**
- Generate signing checklist and assign tasks to relevant team members
- Draft congratulations + next steps message to prospect (Chad confirms)
- Notify all team members: construction coach, lending partner, leadership
- Track document execution status
- Alert leadership when agreement is fully executed

**GHL automation:** Trigger "Agreement Execution" sequence

**Accountability:**
- Agreement not executed within 10 business days → alert leadership

---

### Stage 11 — Funds Received / Closed Won

**Definition:** Franchise fee received. Prospect is officially a NAH franchisee.

**Entry:** Wire fee received and confirmed
**Exit:** None — this is the finish line for Pipeline 1

**Trainual:** Sign · Wire Fee · Full onboarding sequence begins

**Scout actions (automatic):**
- Generate complete onboarding task list in GHL (assigned to relevant team members)
- Draft welcome message from Chad to new franchisee (Chad confirms)
- Log win data: territory, lead source, time-to-close, stage durations, rep
- Update lead score model with win signal for future scoring improvement
- Notify entire team: we have a new franchisee

**GHL automation:** Trigger "New Franchisee Onboarding" sequence immediately

---

## PIPELINE 2 — LONG-TERM STAGES

---

### Stage: Follow-up

**Definition:** Still warm. Chad is actively working them at a slower cadence.
Interest exists but no next step is locked in.

**Entry:** From any active stage when prospect is interested but not ready to move quickly
**Exit:** Prospect re-engages → Chad moves back to appropriate Pipeline 1 stage

**Touch cadence:** Every 7–14 days minimum
**Owner:** Chad

**Scout actions:**
- Alert Chad at 7 days with no touch
- Draft next follow-up message based on last conversation (Chad confirms)
- Score and surface highest-value follow-up leads at top of Chad's daily view
- Suggest best angle for each follow-up based on conversation history

**GHL automation:** "Active Follow-up" sequence — value-based content every 7 days

**Accountability:** No touch in 14 days → task for Chad + leadership alert

---

### Stage: Nurture

**Definition:** Not ready now but has genuine future potential.
Timing is the reason — not lack of interest or fit.

**Entry:** From any stage when timing is the primary obstacle
- Timeline is 6+ months out
- Needs to save more capital
- In a life transition (job, move, family)
- Loss reason was "timing" not "no"

**Exit:** Prospect re-engages → moves to Re-engaged stage
**Touch cadence:** Monthly personal touch from Chad + continuous automated content
**Owner:** Marketing handles automation. Chad does monthly personal check-in.

**Scout actions:**
- Surface to Chad once per month for personal touch
- Draft monthly check-in message tailored to each lead (Chad confirms)
- Flag any engagement with automated content (opens, clicks) → possible re-engage signal
- Suggest re-engagement timing based on what prospect said their timeline was

**GHL automation:** "Long-term Nurture" sequence:
- Monthly: Scout-drafted personal check-in (Chad sends)
- Bi-weekly: automated content (market insights, franchisee spotlights, house flipping education, NAH news)
- Quarterly: "Has anything changed?" re-engagement message

**Accountability:** Chad not personally touched nurture lead in 45 days → reminder

---

### Stage: Re-engaged

**Definition:** A previously cold lead has come back with renewed interest.
Treat as urgent — they already know NAH and chose to return.

**Entry:**
- Prospect responds to nurture automation
- Prospect reaches out directly
- Chad identifies a life change making them viable again
- Meaningful content engagement (not just an open)

**Exit:** Qualified → moves back to Pipeline 1 at appropriate stage
**Time target:** Chad contacts within 2 hours — no exceptions

**Scout actions (immediate on entry):**
- Alert Chad immediately — this is high priority
- Pull full history of all previous interactions — build instant brief for Chad
- Draft re-engagement opening message acknowledging the history (Chad confirms)
- Re-score the lead with current context
- Suggest which Pipeline 1 stage to move them to

**GHL automation:** Trigger "Re-engagement" — urgent priority flag

**Accountability:** No Chad contact within 2 hours → urgent alert to Chad AND leadership

---

## PIPELINE 3 — CLOSED STAGES

---

### Stage: Lost

**Definition:** Prospect has formally passed. Hard no. Do not re-engage without a major change.

**Entry:** Chad marks as lost — loss reason REQUIRED before stage move is allowed

**Required loss reasons (Scout blocks move until one is selected):**
- Not qualified financially
- No available territory
- Chose a competitor franchise
- Completely unresponsive — exhausted all attempts
- Changed mind — no longer interested in business ownership
- Bad fit — cultural or operational mismatch
- Timing — move to Nurture instead if there is future potential
- Other — Chad must type specific reason

**Scout actions:**
- Block stage move until loss reason is selected
- Based on loss reason, suggest: Lost vs Nurture
- Draft respectful "door is always open" closing message (Chad confirms)
- Log loss data for pattern analysis

**Accountability:** No re-engagement automation. Chad manually re-opens if warranted.

---

## Lead Scoring Model

Scout scores every lead 1–100. Updates automatically on every stage move, note, and engagement.

| Factor | Weight |
|--------|--------|
| Lead source quality (referral > organic > paid) | 20% |
| Capital awareness and availability | 20% |
| Territory availability | 15% |
| Engagement and response speed | 15% |
| Business ownership experience | 15% |
| Timeline (under 6 months vs 12+) | 15% |

**Score tiers:**
- 80–100: Hot — priority in Chad's daily view
- 60–79: Warm — active follow-up
- 40–59: Cool — standard cadence
- Below 40: Cold — nurture or disqualify

---

## Full Accountability Trigger Table

| Situation | Action | Who notified |
|-----------|--------|-------------|
| New lead — no contact attempt in 24hr | Task created | Chad + Leadership |
| No activity on active lead for 3 days | At-risk flag + task | Chad + Leadership |
| Discovery call no-show — no reschedule in 24hr | Task created | Chad |
| Discovery notes not logged within 2hr of call | Reminder | Chad only |
| Validation call not scheduled within 5 days | Task created | Chad |
| Compliance gate not completed within 3 days of validation | Alert | Chad + Leadership |
| Application not submitted within 5 days of compliance gate | Task | Chad |
| Leadership approval pending over 3 days | Alert | Leadership |
| FDD issued — stage move attempted before day 14 | Hard block | System (no override) |
| Decision call not scheduled within 5 days of FDD day 14 | Alert | Leadership |
| Agreement not executed within 10 business days | Alert | Leadership |
| Follow-up lead — no touch in 14 days | Task | Chad + Leadership |
| Nurture lead — no personal touch in 45 days | Reminder | Chad only |
| Re-engaged lead — no contact in 2 hours | Urgent alert | Chad + Leadership |
| Lost stage move without loss reason | Hard block | System (no override) |
| Nurture lead engages with content | Flag for re-engage | Chad only |

---

## Team Members

| Person | Title | When they touch prospect | What they do |
|--------|-------|--------------------------|--------------|
| Chad | Orchestrator | Every stage — always | Schedules calls, follows up, moves pipeline, owns relationship |
| Matt | Franchisor | Matt Call stage — Discovery | Prospect meets the founder. Vision, culture, why NAH exists |
| Sam | VP | Sam Call stage — Validation | Prospect vets operations, day-to-day, what running NAH looks like |
| Mark | Lending Partner | Mark Call stage — Capital | Prospect understands funding options and financial viability |

## Team Member Involvement by Stage

| Stage | Chad | Matt | Sam | Mark | Leadership |
|-------|------|------|-----|------|-----------|
| 1 New Lead | Primary — first outreach | — | — | — | Notified on flags |
| 2 Contacted | Primary — keeps attempting | — | — | — | Notified on flags |
| 3 Qualified | Runs qualification, books Matt Call | — | — | — | Notified on flags |
| 4/5 Matt Call | Schedules, sends brief, logs outcome | **Runs the call** | — | — | — |
| 6 Sam Call | Schedules, sends brief, logs outcome | — | **Runs the call** | — | — |
| 6.5 Compliance | Completes checklist | — | — | — | Signs off |
| 7 Application | Guides prospect through application | — | — | — | Approves |
| 8 FDD Issued | Legal-safe check-ins only | — | — | — | Issues FDD |
| 9 Mark Call | Schedules, logs financial viability | — | — | **Runs the call** | On standby |
| 10 Award | Coordinates agreement execution | Final sign-off | — | — | Signs |
| 11 Closed Won | Logs win, celebrates | — | — | — | Notified |

---

## GHL Stage Name Mapping

The actual GHL pipeline uses different stage names than our documentation names.
This table maps between them so Scout and the code always use the right one.

| Our Pipeline Name | GHL Stage Name | Owner |
|-------------------|---------------|-------|
| Stage 1 — New Lead | New Lead | Chad |
| Stage 2 — Contacted | Contacted | Chad |
| Stage 3 — Qualified | Guided Path to Ownership | Chad |
| Stage 4/5 — Discovery | Matt Call | Matt (Chad schedules) |
| Stage 6 — Validation | Sam Call | Sam (Chad schedules) |
| Stage 6.5 — Compliance Gate | Compliance Check | Chad + Leadership |
| Stage 7 — Application | Application | Chad + Leadership |
| Stage 8 — FDD Issued | Signed FDD Receipt | Admin (Chad triggers) |
| Stage 9 — Capital/Lending | Mark Call | Mark (Chad schedules) |
| Stage 10 — Award + Agreement | Matt Final/Documents Submitted | Matt + Chad |
| Stage 11 — Funds Received | Closed Won | Chad logs |

**Note:** Mark Call currently appears between Sam Call and Matt Final in GHL. In our new pipeline, Mark Call maps to the capital/lending conversation which was previously part of Validation. We are giving it its own dedicated stage because capital is the #1 objection and Mark deserves dedicated pipeline visibility.

---

## Open Items — Pending Attorney Review

The following must be resolved with NAH's franchise attorney before Stage 7 is built:

- [ ] Application fee amount and when it becomes non-refundable
- [ ] Territory reservation deposit amount and terms
- [ ] Background check process and provider
- [ ] Financial verification method and minimum thresholds
- [ ] Whether application approval needs to happen before or after FDD issuance
- [ ] Any state-specific compliance requirements for territories NAH operates in

**These items are flagged in docs/stack.md as a blocker for Stage 7 development.**

---

## 30-Day New Lead Sequence

> Full specification in docs/workflows.md. This section defines the day-by-day content plan.

**GOAL:** Call booked + Trainual opened within 30 days.
**AI AGENT:** Books calls automatically if no call scheduled by day 7.
**CHAD personal calls required at days 3, 10, 14, 20, 30.**

### Communication Rules

**Daily SMS Rule:** One SMS per day. One goal only. Short.
Either get them on the phone OR get them into Trainual. Never both in the same message.

**Email Rule:** Content emails every 2–3 days. One theme each.
Clear next step at the bottom of every email.

**Appointment Reminder Rule:**
- SMS reminder: Short, calendar confirm only.
  Example: "Hey [Name] — confirming our call tomorrow at [time]. See you then."
- Email reminder: Deeper — what the call covers, what to prepare, what happens after the call.

---

### Week 1 — Days 1–7 (Awareness and Call Booking)

| Day | Channel | Content | Goal |
|-----|---------|---------|------|
| 1 | SMS | Welcome — "Hey [Name], this is Chad from New Again Houses. Excited to connect with you about the franchise opportunity. I'll be your guide through the process." | Introduction |
| 1 | EMAIL | Intro — what to expect in the coming weeks, Trainual access link sent | Set expectations + Trainual access |
| 2 | SMS | Trainual nudge — "Did you get a chance to check out the interactive guide I sent? It walks you through everything about NAH." | Trainual open |
| 2 | EMAIL | Why a house flipping franchise beats going solo — failure rates, systems, support | Value building |
| 3 | SMS | Question — "Quick question — what got you interested in business ownership?" | Engagement |
| 3 | **CHAD CALL** | Frame Trainual importance, answer initial questions, book discovery call | Call booking |
| 4 | SMS | Franchisee story link — "Check out how [Franchisee Name] built their business with NAH" | Social proof |
| 4 | EMAIL | Franchisee success story — full case study with timeline and results | Conviction |
| 5 | SMS | Capital question — "Have you started looking into financing options? We have great partners." | Capital awareness |
| 5 | EMAIL | Investment breakdown + financing options — Guidant Financial, Alta Capital, ROBS | Financial clarity |
| 6 | SMS | Trainual progress check — "How far did you get in the guide? Any questions so far?" + direct link | Trainual completion |
| 7 | SMS | Calendar ask — "I'd love to get on a call this week to answer your questions. Here's my calendar:" | Call booking |
| 7 | EMAIL | Personal message from Chad + booking link + "Most people who talk to us feel much more confident about the opportunity" | Call booking |
| 7 | **AI AGENT** | If no call booked by day 7 — auto-schedule attempt using Chad's calendar availability | Call booking |

---

### Week 2 — Days 8–14 (Value Building and Objection Handling)

| Day | Channel | Content | Goal |
|-----|---------|---------|------|
| 8 | SMS | Momentum nudge — "Just checking in — any questions about what you've seen so far?" | Engagement |
| 9 | EMAIL | NAH vs competitors — what makes NAH different (Lowe's partnership, construction coaching, lead systems, MasterSuite) | Differentiation |
| 10 | SMS | Check-in — "Hey [Name], wanted to catch up quick. Got a few minutes today?" | Call setup |
| 10 | **CHAD CALL** | Check in, answer questions, push Trainual completion | Call + Trainual |
| 11 | EMAIL | Territory availability — how territories work, exclusivity, market analysis process | Territory interest |
| 12 | SMS | Trainual urgency — "People who finish the interactive guide make decisions faster — and more confidently." | Trainual completion |
| 13 | EMAIL | Lowe's partnership and construction support — what NAH provides that solo flippers don't get | Value building |
| 14 | SMS | Progress check — "Where are you at in your thinking? I'm here if you want to talk through anything." | Engagement |
| 14 | **CHAD CALL** | Progress check, address capital objection, confirm Trainual completion timeline | Call + objection handling |

---

### Week 3 — Days 15–21 (Social Proof and Conviction Building)

| Day | Channel | Content | Goal |
|-----|---------|---------|------|
| 15 | SMS | Social proof nudge — "Another NAH franchisee just closed their first flip — it's happening every week." | Conviction |
| 16 | EMAIL | A day in the life of a NAH franchisee — what the business actually looks like day to day | Lifestyle alignment |
| 17 | SMS | Financing nudge — "Did you know you can use retirement funds to start your franchise? No early withdrawal penalties." | Capital objection |
| 18 | EMAIL | Guidant Financial and Alta Capital intro — how other franchisees funded their investment | Financial path |
| 19 | SMS | Trainual check — if not complete, personal nudge: "You're close to finishing — let me know if you have questions on any section." | Trainual completion |
| 20 | **CHAD CALL** | Validation readiness check, answer all remaining questions, set expectation for decision timeline | Decision framing |
| 21 | EMAIL | The business you will build — revenue model overview, what the first year looks like | Vision casting |

---

### Week 4 — Days 22–30 (Re-engagement and Decision)

| Day | Channel | Content | Goal |
|-----|---------|---------|------|
| 22 | SMS | Re-engagement — "Still thinking things through? Happy to answer any questions you've been sitting on." | Re-engage |
| 23 | EMAIL | Final objection handling — addressing capital, timing, and territory concerns directly | Objection resolution |
| 24 | SMS | Urgency — "Territories are filling up — wanted to make sure yours is still available." | Territory urgency |
| 25 | EMAIL | Final Trainual push — "The guide is designed to help you make a confident decision. Finishing it is the best next step." | Trainual completion |
| 26 | SMS | Social proof — "Most people who complete the full guide move forward. It answers the questions you didn't know to ask." | Conviction |
| 27 | EMAIL | Final social proof — recent franchisee win story with territory and timeline details | Conviction |
| 28 | SMS | Decision nudge — "Where are you at in your thinking? I'd love to hear what's on your mind." | Decision |
| 29 | EMAIL | What happens after you say yes — full onboarding overview, training timeline, first flip timeline | Vision + reduce fear |
| 30 | **CHAD CALL** | Personal decision call attempt — final outreach | Decision |

**Day 30 outcomes:**
- No answer → move to Follow-up pipeline
- Positive → advance to Stage 3 Qualified
- Not ready → move to Nurture pipeline

---

### Trainual Engagement Rules

1. **No Trainual invite fires without prior Chad framing call logged.** The framing call is mandatory.
2. Scout tracks Trainual open status for every prospect.
3. 48hr no open → Scout sends automated nudge to prospect.
4. 96hr no open → Scout alerts Chad with task to follow up personally.
5. Trainual completion % visible on every lead card.
6. 75%+ completion flagged as high engagement.
7. 100% complete with no stage advance → flagged urgent, Scout alerts Chad.

**Chad framing script (use on Day 3 call or first live conversation):**

> "This is your interactive path to ownership. It shows you the full NAH business before any commitment. Most people who go through it seriously make a decision within 2 weeks. I'm sending you access now — set aside 90 minutes over the next few days. I'll check in after you finish."
