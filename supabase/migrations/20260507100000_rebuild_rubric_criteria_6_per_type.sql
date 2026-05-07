-- Rebuild rubric criteria: exactly 6 per call type.
-- Previous seeds ran twice (migration + script), creating 10+ duplicate criteria.
-- This migration wipes all criteria and re-inserts 6 concise, business-aligned
-- criteria per call type. Existing call_grades are NOT affected — they store
-- criterion data inline as JSONB.

-- Step 1: Wipe all existing criteria.
DELETE FROM rubric_criteria;

-- ═══════════════════════════════════════════════════
-- INTRO CALL (Chad) — First contact, qualify, book Matt Call
-- ═══════════════════════════════════════════════════
INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, v.name, v.description, v.weight, v.sort_order, v.pos, v.neg
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id
CROSS JOIN (VALUES
  ('Rapport & Connection',
   'Built genuine warmth; used prospect name; found personal common ground',
   0.15, 0,
   ARRAY['Used prospect name naturally', 'Found personal common ground', 'Warm confident tone'],
   ARRAY['Jumped straight to pitch', 'Sounded scripted', 'No personalization']),
  ('Discovery',
   'Explored motivation, background, timeline, partner situation, capital awareness',
   0.25, 1,
   ARRAY['Asked open-ended why questions', 'Explored timeline and capital', 'Uncovered partner dynamics'],
   ARRAY['Only yes/no questions', 'Skipped motivation', 'Talked more than listened']),
  ('NAH Differentiation',
   'Clearly communicated what makes NAH different: capital partner, Lowes, MasterSuite, coaching',
   0.20, 2,
   ARRAY['Explained 5 pillars clearly', 'Connected value to prospect goals', 'Contrasted with going solo'],
   ARRAY['Generic franchise pitch', 'Info dump with no connection to prospect', 'No differentiation']),
  ('Objection Surfacing',
   'Proactively invited concerns about capital, partner alignment, and timeline',
   0.15, 3,
   ARRAY['Asked what concerns they have', 'Addressed partner hesitation', 'Explored capital readiness'],
   ARRAY['Avoided tough questions', 'Dismissed concerns', 'Let red flags pass']),
  ('Path to Ownership Framing',
   'Positioned process as mutual vetting; set Trainual expectations',
   0.10, 4,
   ARRAY['Framed as two-way evaluation', 'Set Trainual expectations', 'Explained the process clearly'],
   ARRAY['Made it feel like a hard sell', 'Skipped process explanation', 'No Trainual mention']),
  ('Next Step Commitment',
   'Secured specific Matt Call booking with clear deliverables and follow-up date',
   0.15, 5,
   ARRAY['Booked specific next call', 'Sent materials with follow-up date', 'Clear time-bound commitment'],
   ARRAY['Ended with vague follow-up', 'No next step defined', 'Left it open-ended'])
) AS v(name, description, weight, sort_order, pos, neg)
WHERE ct.slug = 'intro_call' AND r.is_active = true;

-- ═══════════════════════════════════════════════════
-- MATT CALL (Matt Lavinder) — Discovery, assess fit, build conviction
-- ═══════════════════════════════════════════════════
INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, v.name, v.description, v.weight, v.sort_order, v.pos, v.neg
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id
CROSS JOIN (VALUES
  ('Deep Why Discovery',
   'Uncovered real motivation, fears, family support, life situation driving interest',
   0.25, 0,
   ARRAY['Got past surface answers', 'Found emotional driver', 'Explored family/partner dynamics'],
   ARRAY['Accepted first answer', 'Did not dig deeper', 'Talked about NAH instead of listening']),
  ('Culture & Vision Fit',
   'Connected NAH mission and culture to prospect specific goals and background',
   0.20, 1,
   ARRAY['Customized story to prospect', 'Used relevant franchisee examples', 'Showed genuine belief'],
   ARRAY['Generic pitch', 'One-size-fits-all', 'Did not connect to prospect goals']),
  ('Objection Handling',
   'Surfaced hidden hesitations and addressed concerns directly with honesty',
   0.20, 2,
   ARRAY['Asked what would stop them', 'Addressed capital concerns', 'Tested commitment level'],
   ARRAY['Avoided tough questions', 'Dismissed concerns', 'Got defensive']),
  ('Prospect Fit Assessment',
   'Honestly evaluated grit, capital readiness, support system, and commitment level',
   0.15, 3,
   ARRAY['Assessed decision-making style', 'Evaluated partner alignment', 'Honest about fit concerns'],
   ARRAY['Overlooked red flags', 'Assumed readiness', 'Did not assess partner buy-in']),
  ('Prospect Engagement',
   'Prospect asked questions, showed excitement, and owned the conversation',
   0.10, 4,
   ARRAY['Prospect asked good questions', 'Shifted from if to when', 'Active two-way dialog'],
   ARRAY['One-sided conversation', 'Prospect disengaged', 'No curiosity from prospect']),
  ('Next Step Clarity',
   'Clear Sam Call commitment with specific timeline',
   0.10, 5,
   ARRAY['Scheduled Sam Call', 'Set specific follow-up date', 'Clear process expectation'],
   ARRAY['Vague follow-up', 'No commitment secured', 'Left prospect without direction'])
) AS v(name, description, weight, sort_order, pos, neg)
WHERE ct.slug = 'matt_call' AND r.is_active = true;

-- ═══════════════════════════════════════════════════
-- SAM CALL (Sam Ferguson) — Validation, operations, realistic expectations
-- ═══════════════════════════════════════════════════
INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, v.name, v.description, v.weight, v.sort_order, v.pos, v.neg
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id
CROSS JOIN (VALUES
  ('Operations Walkthrough',
   'Explained day-to-day reality: deal sourcing, construction, project management',
   0.25, 0,
   ARRAY['Covered daily operations clearly', 'Used real scenarios', 'Connected ops to prospect background'],
   ARRAY['Vague about daily work', 'Skipped construction reality', 'Made it sound too easy']),
  ('Deal Economics',
   'Used real numbers: typical deal costs, ARV, margins, deal cycle timeline',
   0.25, 1,
   ARRAY['Showed real deal examples', 'Covered full deal cycle with numbers', 'Explained profit margins'],
   ARRAY['Vague about numbers', 'No concrete examples', 'Oversimplified the model']),
  ('Honest Expectations',
   'Set realistic first-year expectations; did not sugarcoat the work required',
   0.20, 2,
   ARRAY['Discussed time commitment honestly', 'Set realistic first-year goals', 'Covered challenges openly'],
   ARRAY['Made it sound effortless', 'Glossed over challenges', 'Overpromised results']),
  ('Ecosystem & Support',
   'Demonstrated Lowes partnership, contractor network, coaching, and MasterSuite',
   0.15, 3,
   ARRAY['Explained Lowes relationship', 'Showed support systems', 'Demonstrated MasterSuite value'],
   ARRAY['Skipped support overview', 'Vague about what NAH provides', 'No ecosystem discussion']),
  ('Prospect Confidence',
   'Prospect left more confident than they arrived; questions shifted from if to when',
   0.10, 4,
   ARRAY['Prospect expressed excitement', 'Questions shifted to when/how', 'Doubt visibly reduced'],
   ARRAY['Prospect more uncertain after call', 'New doubts introduced', 'Energy dropped']),
  ('Next Step Setup',
   'Clear advancement to Mark Call with timeline',
   0.05, 5,
   ARRAY['Set Mark Call expectation', 'Clear timeline communicated', 'Prospect committed to next step'],
   ARRAY['Vague about what comes next', 'No timeline set', 'Prospect left without direction'])
) AS v(name, description, weight, sort_order, pos, neg)
WHERE ct.slug = 'sam_call' AND r.is_active = true;

-- ═══════════════════════════════════════════════════
-- MARK CALL (Mark Pate) — Capital/lending deep dive
-- ═══════════════════════════════════════════════════
INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, v.name, v.description, v.weight, v.sort_order, v.pos, v.neg
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id
CROSS JOIN (VALUES
  ('Financial Assessment',
   'Thoroughly reviewed prospect financial position: PFS, liquid capital, net worth',
   0.25, 0,
   ARRAY['Reviewed PFS in detail', 'Identified all capital sources', 'Asked about debt load'],
   ARRAY['Surface-level review', 'Took prospects word at face value', 'Missed key financial gaps']),
  ('Lending Options',
   'Presented viable funding paths matched to situation: SBA, ROBS, Alta Capital, conventional',
   0.25, 1,
   ARRAY['Matched options to prospect situation', 'Explained ROBS clearly', 'Covered SBA process'],
   ARRAY['One-size-fits-all approach', 'Did not explain options', 'Confused the prospect']),
  ('Gap Identification',
   'Honestly flagged financial shortfalls with proposed bridge solutions',
   0.20, 2,
   ARRAY['Flagged shortfall with solution', 'Set realistic funding timeline', 'Honest about gaps'],
   ARRAY['Ignored obvious gaps', 'Overpromised on approval', 'Did not probe inconsistencies']),
  ('Risk & Resilience',
   'Tested financial stamina; discussed worst-case scenarios and runway',
   0.15, 3,
   ARRAY['Asked about runway if deals slow', 'Discussed worst case', 'Tested commitment level'],
   ARRAY['Only talked best case', 'Did not test financial stamina', 'Avoided tough scenarios']),
  ('Go/No-Go Recommendation',
   'Gave clear honest assessment of financial viability',
   0.10, 4,
   ARRAY['Clear recommendation given', 'Honest assessment shared', 'Prospect knows where they stand'],
   ARRAY['Ambiguous assessment', 'Left prospect confused', 'No clear recommendation']),
  ('Next Steps',
   'Clear action items with deadlines: application, PFS review, lending timeline',
   0.05, 5,
   ARRAY['Set specific action items', 'Clear deadlines', 'Prospect knows what to do next'],
   ARRAY['Vague follow-up', 'No deadlines set', 'Prospect left without direction'])
) AS v(name, description, weight, sort_order, pos, neg)
WHERE ct.slug = 'mark_call' AND r.is_active = true;

-- ═══════════════════════════════════════════════════
-- MATT FINAL CALL — Close, agreement walkthrough, decision
-- ═══════════════════════════════════════════════════
INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, v.name, v.description, v.weight, v.sort_order, v.pos, v.neg
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id
CROSS JOIN (VALUES
  ('Agreement Walkthrough',
   'Clearly explained key franchise agreement terms and obligations',
   0.25, 0,
   ARRAY['Covered key terms clearly', 'Answered questions thoroughly', 'No legal jargon confusion'],
   ARRAY['Rushed through documents', 'Assumed prospect read everything', 'Skipped important terms']),
  ('Final Objection Resolution',
   'Surfaced and resolved any remaining hesitations before commitment',
   0.25, 1,
   ARRAY['Asked about remaining concerns', 'Addressed final hesitations', 'Patient with questions'],
   ARRAY['Ignored lingering concerns', 'Applied pressure', 'Rushed to close']),
  ('Decision Confirmation',
   'Secured clear commitment to proceed; prospect feels confident in decision',
   0.20, 2,
   ARRAY['Clear verbal commitment', 'Prospect expressed confidence', 'Decision felt right'],
   ARRAY['Prospect still hedging', 'No clear decision', 'Pressure-induced agreement']),
  ('Investment Recap',
   'Final clarity on financial commitment, franchise fee, and timeline',
   0.15, 3,
   ARRAY['Confirmed total investment', 'Timeline expectations clear', 'No financial surprises'],
   ARRAY['Skipped financial recap', 'Prospect unclear on costs', 'Hidden fee surprise']),
  ('Onboarding Transition',
   'Set clear expectations for what happens after signing',
   0.10, 4,
   ARRAY['Outlined onboarding steps', 'Introduced key contacts', 'Set first-week expectations'],
   ARRAY['Abrupt ending after signature', 'No mention of what comes next', 'Left prospect in the dark']),
  ('Energy & Conviction',
   'Prospect left excited, confident, and ready to start their franchise journey',
   0.05, 5,
   ARRAY['Prospect expressed excitement', 'High energy close', 'Clear enthusiasm for getting started'],
   ARRAY['Prospect seemed deflated', 'Low energy', 'Buyer remorse signals'])
) AS v(name, description, weight, sort_order, pos, neg)
WHERE ct.slug = 'matt_final_call' AND r.is_active = true;

-- ═══════════════════════════════════════════════════
-- FDD REVIEW — Franchise Disclosure Document review
-- ═══════════════════════════════════════════════════
INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, v.name, v.description, v.weight, v.sort_order, v.pos, v.neg
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id
CROSS JOIN (VALUES
  ('Document Clarity',
   'Walked through key FDD sections clearly and thoroughly',
   0.25, 0,
   ARRAY['Covered key sections systematically', 'Explained terms in plain language', 'Well organized walkthrough'],
   ARRAY['Rushed through FDD', 'Used confusing legal jargon', 'Skipped important sections']),
  ('Question Handling',
   'Answered all prospect questions with legal-safe language',
   0.25, 1,
   ARRAY['Thorough answers', 'Redirected legal questions to attorney', 'No earnings claims made'],
   ARRAY['Dodged questions', 'Made inappropriate claims', 'Left questions unanswered']),
  ('Key Terms Emphasis',
   'Highlighted important obligations, territory exclusivity, royalties, and restrictions',
   0.20, 2,
   ARRAY['Called out key obligations', 'Explained territory terms', 'Covered royalty structure clearly'],
   ARRAY['Glossed over obligations', 'Did not explain restrictions', 'Prospect blindsided later']),
  ('Attorney Recommendation',
   'Encouraged independent legal review of the FDD',
   0.10, 3,
   ARRAY['Recommended franchise attorney', 'Suggested independent review', 'No pressure to skip legal counsel'],
   ARRAY['Discouraged attorney review', 'Applied time pressure', 'Skipped attorney recommendation']),
  ('Timeline & Process',
   'Clear on 14-day cooling period, next steps, and signing timeline',
   0.10, 4,
   ARRAY['Explained 14-day requirement', 'Set realistic timeline', 'Clear next steps'],
   ARRAY['Rushed the cooling period', 'Vague about timeline', 'Prospect confused about process']),
  ('Commitment Check',
   'Verified prospect commitment level without applying pressure',
   0.10, 5,
   ARRAY['Checked in on comfort level', 'Assessed readiness without pressure', 'Left door open for questions'],
   ARRAY['High pressure close', 'Did not check in', 'Ignored hesitation signals'])
) AS v(name, description, weight, sort_order, pos, neg)
WHERE ct.slug = 'fdd_review' AND r.is_active = true;

-- ═══════════════════════════════════════════════════
-- COACHING CALL — Active franchisee performance coaching
-- ═══════════════════════════════════════════════════
INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, v.name, v.description, v.weight, v.sort_order, v.pos, v.neg
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id
CROSS JOIN (VALUES
  ('Accountability Review',
   'Reviewed commitments from last session; held franchisee to their word',
   0.20, 0,
   ARRAY['Reviewed last session actions', 'Tracked progress with numbers', 'Held accountable on misses'],
   ARRAY['Skipped review', 'Let missed commitments slide', 'No reference to past goals']),
  ('Pipeline & Deal Velocity',
   'Reviewed active deals, offer volume, and deal pipeline health',
   0.25, 1,
   ARRAY['Reviewed deal pipeline', 'Pushed for more offers', 'Set deal count targets'],
   ARRAY['Did not discuss deals', 'No urgency created', 'Accepted slow pace']),
  ('Obstacle Removal',
   'Identified and addressed current blockers with specific solutions',
   0.20, 2,
   ARRAY['Asked about challenges', 'Found root causes', 'Offered specific solutions'],
   ARRAY['Ignored problems', 'Surface-level discussion', 'No actionable solutions']),
  ('Skill Development',
   'Taught or coached on specific skills: construction, lead gen, negotiation, systems',
   0.15, 3,
   ARRAY['Taught a specific skill', 'Used real examples', 'Connected skill to franchisee needs'],
   ARRAY['No coaching moment', 'Generic advice only', 'Did not address skill gaps']),
  ('Action Items',
   'Set specific, time-bound next actions with clear ownership',
   0.15, 4,
   ARRAY['3+ specific actions set', 'Each had a deadline', 'Clear ownership on each'],
   ARRAY['Vague takeaways', 'No deadlines', 'Too many items to track']),
  ('Energy & Motivation',
   'Franchisee left energized, focused, and motivated',
   0.05, 5,
   ARRAY['Celebrated wins', 'Showed empathy for challenges', 'Left franchisee energized'],
   ARRAY['Only focused on negatives', 'Felt transactional', 'Franchisee seemed deflated'])
) AS v(name, description, weight, sort_order, pos, neg)
WHERE ct.slug = 'coaching_call' AND r.is_active = true;

-- ═══════════════════════════════════════════════════
-- ONBOARDING CALL — New franchisee setup
-- ═══════════════════════════════════════════════════
INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, v.name, v.description, v.weight, v.sort_order, v.pos, v.neg
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id
CROSS JOIN (VALUES
  ('Systems Setup',
   'Walked through GHL, MasterSuite, Trainual, and key operational tools',
   0.20, 0,
   ARRAY['Covered all key tools', 'Verified logins work', 'Hands-on walkthrough'],
   ARRAY['Skipped system setup', 'Left franchisee confused', 'No hands-on demo']),
  ('30/60/90 Expectations',
   'Set clear milestones, deal count targets, and timeline expectations',
   0.25, 1,
   ARRAY['Covered 30/60/90 milestones', 'Set deal count expectations', 'Explained support cadence'],
   ARRAY['No timeline shared', 'Vague expectations', 'No milestones set']),
  ('Territory Orientation',
   'Reviewed territory, market conditions, and initial target areas',
   0.20, 2,
   ARRAY['Reviewed territory boundaries', 'Discussed market conditions', 'Identified target areas'],
   ARRAY['No territory discussion', 'Generic market overview', 'No strategy connection']),
  ('Support Structure',
   'Introduced coach, weekly call schedule, key contacts, and escalation path',
   0.15, 3,
   ARRAY['Introduced coach by name', 'Explained weekly calls', 'Covered who to contact for what'],
   ARRAY['No team intro', 'Skipped support resources', 'Franchisee does not know who to call']),
  ('First Deal Readiness',
   'Equipped franchisee to start: lead gen basics, deal analysis, construction intro',
   0.15, 4,
   ARRAY['Covered lead generation basics', 'Explained deal analysis process', 'Set first deal expectations'],
   ARRAY['No discussion of getting started', 'Franchisee unsure how to find first deal', 'Skipped practical steps']),
  ('Confidence & Energy',
   'Franchisee left confident, excited, and clear on their first steps',
   0.05, 5,
   ARRAY['Franchisee expressed excitement', 'Questions answered thoroughly', 'Clear enthusiasm'],
   ARRAY['Franchisee overwhelmed', 'Unanswered questions lingered', 'Low energy'])
) AS v(name, description, weight, sort_order, pos, neg)
WHERE ct.slug = 'onboarding_call' AND r.is_active = true;

-- ═══════════════════════════════════════════════════
-- GROUP CALL — Multi-participant training/cohort session
-- ═══════════════════════════════════════════════════
INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, v.name, v.description, v.weight, v.sort_order, v.pos, v.neg
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id
CROSS JOIN (VALUES
  ('Content Quality',
   'Valuable, actionable content with real examples from the field',
   0.25, 0,
   ARRAY['Shared specific tactics', 'Used real deal examples', 'Content matched audience needs'],
   ARRAY['Generic content', 'Too theoretical', 'Not relevant to attendees']),
  ('Participant Engagement',
   'Multiple participants actively contributing; strong Q&A',
   0.25, 1,
   ARRAY['Multiple people spoke', 'Q&A was active', 'Peer sharing happened'],
   ARRAY['One-way presentation', 'Low participation', 'Attendees disengaged']),
  ('Facilitation',
   'Good pacing, time management, and balanced participation',
   0.15, 2,
   ARRAY['Stayed on agenda', 'Managed dominant speakers', 'Good pacing throughout'],
   ARRAY['Went off track', 'One person dominated', 'Ran over time significantly']),
  ('Real Deal Examples',
   'Used actual deals, numbers, or real situations to illustrate points',
   0.15, 3,
   ARRAY['Referenced specific deals', 'Showed real numbers', 'Concrete not abstract'],
   ARRAY['All theory no practice', 'No specific examples', 'Vague generalities']),
  ('Actionable Takeaways',
   'Clear action items for participants to implement this week',
   0.15, 4,
   ARRAY['Summarized key points', 'Set group action items', 'Clear next session topic'],
   ARRAY['No summary', 'No action items', 'Ended abruptly without takeaways']),
  ('Energy & Momentum',
   'High energy session that left participants motivated',
   0.05, 5,
   ARRAY['High energy throughout', 'Participants left motivated', 'Positive group dynamic'],
   ARRAY['Low energy', 'Felt like a chore', 'Group seemed checked out'])
) AS v(name, description, weight, sort_order, pos, neg)
WHERE ct.slug = 'group_call' AND r.is_active = true;

-- ═══════════════════════════════════════════════════
-- COHORT CALL — Same criteria as group call
-- ═══════════════════════════════════════════════════
INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, v.name, v.description, v.weight, v.sort_order, v.pos, v.neg
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id
CROSS JOIN (VALUES
  ('Content Quality',
   'Valuable, actionable content with real examples from the field',
   0.25, 0,
   ARRAY['Shared specific tactics', 'Used real deal examples', 'Content matched audience needs'],
   ARRAY['Generic content', 'Too theoretical', 'Not relevant to attendees']),
  ('Participant Engagement',
   'Multiple participants actively contributing; strong Q&A',
   0.25, 1,
   ARRAY['Multiple people spoke', 'Q&A was active', 'Peer sharing happened'],
   ARRAY['One-way presentation', 'Low participation', 'Attendees disengaged']),
  ('Facilitation',
   'Good pacing, time management, and balanced participation',
   0.15, 2,
   ARRAY['Stayed on agenda', 'Managed dominant speakers', 'Good pacing throughout'],
   ARRAY['Went off track', 'One person dominated', 'Ran over time significantly']),
  ('Real Deal Examples',
   'Used actual deals, numbers, or real situations to illustrate points',
   0.15, 3,
   ARRAY['Referenced specific deals', 'Showed real numbers', 'Concrete not abstract'],
   ARRAY['All theory no practice', 'No specific examples', 'Vague generalities']),
  ('Actionable Takeaways',
   'Clear action items for participants to implement this week',
   0.15, 4,
   ARRAY['Summarized key points', 'Set group action items', 'Clear next session topic'],
   ARRAY['No summary', 'No action items', 'Ended abruptly without takeaways']),
  ('Energy & Momentum',
   'High energy session that left participants motivated',
   0.05, 5,
   ARRAY['High energy throughout', 'Participants left motivated', 'Positive group dynamic'],
   ARRAY['Low energy', 'Felt like a chore', 'Group seemed checked out'])
) AS v(name, description, weight, sort_order, pos, neg)
WHERE ct.slug = 'cohort_call' AND r.is_active = true;

-- ═══════════════════════════════════════════════════
-- TEAM CALL — Internal NAH meetings
-- ═══════════════════════════════════════════════════
INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, v.name, v.description, v.weight, v.sort_order, v.pos, v.neg
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id
CROSS JOIN (VALUES
  ('Agenda Clarity',
   'Clear agenda communicated; meeting stayed on track',
   0.15, 0,
   ARRAY['Agenda stated upfront', 'Stayed on topic', 'Organized flow'],
   ARRAY['No agenda', 'Wandered off topic', 'No structure']),
  ('Decision Quality',
   'Clear decisions made, not just discussion; outcomes documented',
   0.25, 1,
   ARRAY['Decisions clearly stated', 'Consensus reached', 'Outcomes documented'],
   ARRAY['All discussion no decisions', 'Issues rehashed without resolution', 'Ambiguous outcomes']),
  ('Action Item Clarity',
   'Specific actions assigned with owners and deadlines',
   0.25, 2,
   ARRAY['Each action had an owner', 'Deadlines set', 'Written down during meeting'],
   ARRAY['Vague takeaways', 'No deadlines', 'Unclear who owns what']),
  ('Information Sharing',
   'Key updates communicated effectively to the right people',
   0.15, 3,
   ARRAY['Updates were concise', 'Relevant to attendees', 'No unnecessary detail'],
   ARRAY['Key info missed', 'Updates too long', 'Wrong audience for the content']),
  ('Problem Solving',
   'Issues identified and addressed with concrete solutions',
   0.10, 4,
   ARRAY['Root causes explored', 'Solutions proposed and agreed', 'Blockers removed'],
   ARRAY['Problems raised but not solved', 'Blame without solutions', 'Issues ignored']),
  ('Time Efficiency',
   'Efficient use of everyone time; no unnecessary tangents',
   0.10, 5,
   ARRAY['Ended on time or early', 'No unnecessary tangents', 'Every minute productive'],
   ARRAY['Ran over significantly', 'Long tangents', 'Could have been an email'])
) AS v(name, description, weight, sort_order, pos, neg)
WHERE ct.slug = 'team_call' AND r.is_active = true;
