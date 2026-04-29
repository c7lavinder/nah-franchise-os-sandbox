-- Tier 1 #5: Seed rubric criteria for per-call-type grading.
-- Each call type's rubric gets criteria tuned to what matters for that call.
-- Weights sum to ~1.0 per rubric. Sort order drives display sequence.
--
-- Categories:
--   Sales prospect calls: intro_call, matt_call, sam_call, mark_call, territory_call, fdd_review, matt_final_call
--   Coaching calls: coaching_call
--   Onboarding calls: onboarding_call
--   Group/cohort calls: group_call, cohort_call
--   Internal/team calls: team_call (no grading)
--   Unclassified: unclassified (no grading)

-- ═══════════════════════════════════════════════════
-- INTRO CALL (Chad's first outreach — build rapport, qualify interest)
-- ═══════════════════════════════════════════════════

INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, 'Rapport Building', 'Did the rep establish a personal connection and set a warm tone?', 0.20, 0,
  ARRAY['Used prospect''s name naturally', 'Referenced their background', 'Found common ground'],
  ARRAY['Jumped straight to pitch', 'Sounded scripted', 'No personalization']
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id WHERE ct.slug = 'intro_call' AND r.is_active = true
ON CONFLICT DO NOTHING;

INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, 'Discovery Questions', 'Did the rep ask open-ended questions to understand motivation, timeline, and capital?', 0.25, 1,
  ARRAY['Asked why franchising', 'Explored timeline', 'Asked about capital readiness'],
  ARRAY['Only asked yes/no questions', 'Talked more than listened', 'Skipped motivation']
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id WHERE ct.slug = 'intro_call' AND r.is_active = true
ON CONFLICT DO NOTHING;

INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, 'NAH Value Proposition', 'Did the rep clearly communicate what makes NAH different?', 0.20, 2,
  ARRAY['Explained the model clearly', 'Used real examples', 'Connected value to prospect''s goals'],
  ARRAY['Generic pitch', 'No differentiation from competitors', 'Overwhelmed with info']
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id WHERE ct.slug = 'intro_call' AND r.is_active = true
ON CONFLICT DO NOTHING;

INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, 'Objection Surfacing', 'Did the rep invite and address concerns rather than avoid them?', 0.15, 3,
  ARRAY['Asked "what concerns do you have?"', 'Addressed spouse/partner hesitation', 'Handled capital worry'],
  ARRAY['Avoided difficult topics', 'Dismissed concerns', 'Got defensive']
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id WHERE ct.slug = 'intro_call' AND r.is_active = true
ON CONFLICT DO NOTHING;

INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, 'Next Steps & Momentum', 'Did the rep secure a clear next step with a date/time?', 0.20, 4,
  ARRAY['Scheduled the Matt Call on the spot', 'Sent NDA during the call', 'Set specific follow-up date'],
  ARRAY['Ended with "I''ll follow up"', 'No next step defined', 'Left it open-ended']
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id WHERE ct.slug = 'intro_call' AND r.is_active = true
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════
-- MATT CALL (Qualification — deep why, personality read, commitment)
-- ═══════════════════════════════════════════════════

INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, 'Why Discovery', 'Did Matt uncover the deep "why" behind the prospect''s interest?', 0.25, 0,
  ARRAY['Got past surface answers', 'Found emotional driver', 'Connected why to franchise fit'],
  ARRAY['Accepted first answer', 'Didn''t dig deeper', 'Talked about NAH instead of listening']
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id WHERE ct.slug = 'matt_call' AND r.is_active = true
ON CONFLICT DO NOTHING;

INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, 'Personality Read', 'Did Matt assess communication style, decision-making approach, and partner dynamics?', 0.20, 1,
  ARRAY['Identified decision-making style', 'Read spouse/partner dynamics', 'Adapted communication to prospect'],
  ARRAY['One-size-fits-all approach', 'Missed spouse influence', 'Didn''t adjust to prospect''s style']
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id WHERE ct.slug = 'matt_call' AND r.is_active = true
ON CONFLICT DO NOTHING;

INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, 'Hesitation Surfacing', 'Did Matt surface and address hidden objections?', 0.20, 2,
  ARRAY['Asked "what would stop you?"', 'Surfaced timeline concerns', 'Addressed capital fears directly'],
  ARRAY['Avoided tough questions', 'Let silence fill with pitch', 'Missed red flags']
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id WHERE ct.slug = 'matt_call' AND r.is_active = true
ON CONFLICT DO NOTHING;

INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, 'Commitment Progression', 'Did Matt move the prospect closer to a decision?', 0.20, 3,
  ARRAY['Got verbal commitment to next step', 'Tested urgency', 'Set expectation for timeline'],
  ARRAY['Ended without advancing', 'Left prospect uncommitted', 'No urgency created']
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id WHERE ct.slug = 'matt_call' AND r.is_active = true
ON CONFLICT DO NOTHING;

INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, 'Process Clarity', 'Did Matt explain what happens next in the process?', 0.15, 4,
  ARRAY['Explained Sam Call purpose', 'Set timeline expectations', 'Covered NDA/Zorakle if needed'],
  ARRAY['Prospect left confused about process', 'Skipped next steps', 'No timeline']
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id WHERE ct.slug = 'matt_call' AND r.is_active = true
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════
-- SAM CALL (Discovery — operational readiness, deal walkthrough, capital)
-- ═══════════════════════════════════════════════════

INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, 'Operational Readiness', 'Did Sam assess the prospect''s ability to run a business?', 0.25, 0,
  ARRAY['Explored business experience', 'Assessed management capability', 'Checked time commitment'],
  ARRAY['Assumed readiness', 'Skipped experience questions', 'Didn''t verify availability']
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id WHERE ct.slug = 'sam_call' AND r.is_active = true
ON CONFLICT DO NOTHING;

INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, 'Deal Walkthrough', 'Did Sam explain the house-flipping model with real numbers?', 0.25, 1,
  ARRAY['Used actual deal examples', 'Showed profit margins', 'Explained the full deal cycle'],
  ARRAY['Vague about numbers', 'No concrete examples', 'Oversimplified the model']
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id WHERE ct.slug = 'sam_call' AND r.is_active = true
ON CONFLICT DO NOTHING;

INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, 'Capital Bridge', 'Did Sam connect the prospect''s financial situation to what''s needed?', 0.25, 2,
  ARRAY['Discussed liquid capital', 'Explained lending options', 'Connected capital to timeline'],
  ARRAY['Avoided money talk', 'Didn''t verify capital', 'Made assumptions about finances']
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id WHERE ct.slug = 'sam_call' AND r.is_active = true
ON CONFLICT DO NOTHING;

INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, 'MasterSuite Demo', 'Did Sam effectively demonstrate the technology platform?', 0.15, 3,
  ARRAY['Showed relevant features', 'Connected tech to daily ops', 'Prospect engaged with demo'],
  ARRAY['Skipped demo', 'Demo felt rushed', 'Didn''t connect to prospect needs']
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id WHERE ct.slug = 'sam_call' AND r.is_active = true
ON CONFLICT DO NOTHING;

INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, 'Next Step Specificity', 'Did Sam set a specific next step with date?', 0.10, 4,
  ARRAY['Scheduled Mark Call', 'Set background check expectation', 'Clear timeline communicated'],
  ARRAY['Vague follow-up', 'No specific date', 'Left prospect without direction']
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id WHERE ct.slug = 'sam_call' AND r.is_active = true
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════
-- MARK CALL (Capital/Lending — financial clarity, red flags)
-- ═══════════════════════════════════════════════════

INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, 'Financial Clarity', 'Did Mark clearly explain lending requirements and options?', 0.30, 0,
  ARRAY['Explained SBA/conventional options', 'Covered credit requirements', 'Discussed down payment'],
  ARRAY['Vague about requirements', 'Skipped important details', 'Confused the prospect']
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id WHERE ct.slug = 'mark_call' AND r.is_active = true
ON CONFLICT DO NOTHING;

INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, 'Capital Assessment', 'Did Mark accurately assess the prospect''s financial position?', 0.25, 1,
  ARRAY['Asked about liquid capital', 'Verified credit score range', 'Assessed net worth'],
  ARRAY['Took prospect''s word at face value', 'Didn''t verify numbers', 'Missed debt load']
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id WHERE ct.slug = 'mark_call' AND r.is_active = true
ON CONFLICT DO NOTHING;

INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, 'Red/Yellow Flag Detection', 'Did Mark identify and flag financial risks?', 0.20, 2,
  ARRAY['Flagged credit issues early', 'Identified capital gaps', 'Communicated risks to team'],
  ARRAY['Missed obvious red flags', 'Didn''t probe inconsistencies', 'Overly optimistic']
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id WHERE ct.slug = 'mark_call' AND r.is_active = true
ON CONFLICT DO NOTHING;

INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, 'Resilience Probe', 'Did Mark test the prospect''s financial resilience and runway?', 0.15, 3,
  ARRAY['Asked about runway if deals slow', 'Discussed worst-case scenarios', 'Tested commitment level'],
  ARRAY['Only talked best case', 'Didn''t test financial stamina', 'Avoided tough questions']
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id WHERE ct.slug = 'mark_call' AND r.is_active = true
ON CONFLICT DO NOTHING;

INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, 'Next Steps', 'Did Mark set clear financial next steps?', 0.10, 4,
  ARRAY['Scheduled PFS review', 'Set lending application timeline', 'Clear action items'],
  ARRAY['No next step defined', 'Left financial questions open', 'Vague follow-up']
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id WHERE ct.slug = 'mark_call' AND r.is_active = true
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════
-- TERRITORY CALL (Territory selection and market analysis)
-- ═══════════════════════════════════════════════════

INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, 'Market Education', 'Did the call educate the prospect on their territory''s market dynamics?', 0.30, 0,
  ARRAY['Shared population/growth data', 'Explained deal flow expectations', 'Connected market to strategy'],
  ARRAY['No market data shared', 'Generic territory overview', 'Didn''t tailor to prospect']
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id WHERE ct.slug = 'territory_call' AND r.is_active = true
ON CONFLICT DO NOTHING;

INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, 'Competitive Landscape', 'Was the competitive environment in the territory addressed?', 0.20, 1,
  ARRAY['Discussed local competitors', 'Addressed investor activity', 'Covered pricing dynamics'],
  ARRAY['Ignored competition', 'Oversimplified market', 'No competitive context']
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id WHERE ct.slug = 'territory_call' AND r.is_active = true
ON CONFLICT DO NOTHING;

INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, 'Prospect Engagement', 'Did the prospect actively participate in territory evaluation?', 0.25, 2,
  ARRAY['Prospect asked questions', 'Discussed local knowledge', 'Expressed preferences'],
  ARRAY['One-sided presentation', 'Prospect seemed disengaged', 'No questions from prospect']
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id WHERE ct.slug = 'territory_call' AND r.is_active = true
ON CONFLICT DO NOTHING;

INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, 'Decision Clarity', 'Did the call move toward a territory selection decision?', 0.25, 3,
  ARRAY['Narrowed to top territories', 'Set decision timeline', 'Clear next step on selection'],
  ARRAY['Left options too open', 'No narrowing happened', 'Prospect more confused after call']
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id WHERE ct.slug = 'territory_call' AND r.is_active = true
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════
-- FDD REVIEW (Compliance — legal clarity without legal advice)
-- ═══════════════════════════════════════════════════

INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, 'FDD Walkthrough', 'Did the call cover key FDD sections clearly?', 0.30, 0,
  ARRAY['Covered Items 5, 7, 19, 21', 'Explained financial performance', 'Addressed territory rights'],
  ARRAY['Skipped key items', 'Rushed through FDD', 'Prospect confused by legal language']
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id WHERE ct.slug = 'fdd_review' AND r.is_active = true
ON CONFLICT DO NOTHING;

INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, 'Question Handling', 'Were prospect questions answered thoroughly without providing legal advice?', 0.25, 1,
  ARRAY['Answered factually', 'Redirected legal questions to attorney', 'Encouraged independent review'],
  ARRAY['Gave legal opinions', 'Dismissed questions', 'Provided advice beyond scope']
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id WHERE ct.slug = 'fdd_review' AND r.is_active = true
ON CONFLICT DO NOTHING;

INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, 'Compliance Adherence', 'Did the call follow FDD disclosure rules (14-day waiting period, no pressure)?', 0.25, 2,
  ARRAY['Reminded of 14-day waiting period', 'No pressure to sign', 'Encouraged attorney review'],
  ARRAY['Pressured to move fast', 'Minimized waiting period', 'Discouraged attorney review']
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id WHERE ct.slug = 'fdd_review' AND r.is_active = true
ON CONFLICT DO NOTHING;

INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, 'Momentum Maintenance', 'Did the call maintain excitement while being compliant?', 0.20, 3,
  ARRAY['Balanced excitement with process', 'Kept prospect engaged', 'Set next step within compliance window'],
  ARRAY['Killed momentum with bureaucracy', 'Lost prospect interest', 'No next step set']
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id WHERE ct.slug = 'fdd_review' AND r.is_active = true
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════
-- MATT FINAL CALL (Award decision — commitment, celebration, handoff)
-- ═══════════════════════════════════════════════════

INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, 'Decision Confirmation', 'Did Matt confirm the prospect''s commitment to move forward?', 0.30, 0,
  ARRAY['Got explicit "yes"', 'Addressed last-minute concerns', 'Confirmed timeline'],
  ARRAY['Assumed commitment', 'Skipped confirmation', 'Left ambiguity']
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id WHERE ct.slug = 'matt_final_call' AND r.is_active = true
ON CONFLICT DO NOTHING;

INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, 'Celebration & Vision', 'Did Matt celebrate the decision and paint the future vision?', 0.20, 1,
  ARRAY['Expressed genuine excitement', 'Painted first-year vision', 'Made prospect feel welcomed'],
  ARRAY['Transactional tone', 'Rushed past the moment', 'No celebration']
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id WHERE ct.slug = 'matt_final_call' AND r.is_active = true
ON CONFLICT DO NOTHING;

INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, 'Onboarding Handoff', 'Did Matt clearly explain what happens after signing?', 0.25, 2,
  ARRAY['Explained onboarding timeline', 'Introduced onboarding team', 'Set first 30-day expectations'],
  ARRAY['Vague about next steps', 'No handoff plan', 'Prospect left uncertain']
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id WHERE ct.slug = 'matt_final_call' AND r.is_active = true
ON CONFLICT DO NOTHING;

INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, 'Administrative Clarity', 'Were FA, FF, and signing logistics clearly communicated?', 0.25, 3,
  ARRAY['Explained franchise fee', 'Covered FA process', 'Set signing date/logistics'],
  ARRAY['Skipped financial details', 'Confused signing process', 'Left admin questions unanswered']
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id WHERE ct.slug = 'matt_final_call' AND r.is_active = true
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════
-- COACHING CALL (Franchisee coaching — accountability, progress, velocity)
-- ═══════════════════════════════════════════════════

INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, 'Progress Accountability', 'Did the coach review progress on goals and action items from last session?', 0.25, 0,
  ARRAY['Reviewed last session''s commitments', 'Tracked goal progress with numbers', 'Held franchisee accountable'],
  ARRAY['Skipped review', 'Didn''t reference past goals', 'Let missed commitments slide']
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id WHERE ct.slug = 'coaching_call' AND r.is_active = true
ON CONFLICT DO NOTHING;

INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, 'Obstacle Identification', 'Did the coach help identify and address current blockers?', 0.25, 1,
  ARRAY['Asked about challenges', 'Identified root causes', 'Offered specific solutions'],
  ARRAY['Ignored problems', 'Surface-level discussion', 'Didn''t dig into blockers']
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id WHERE ct.slug = 'coaching_call' AND r.is_active = true
ON CONFLICT DO NOTHING;

INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, 'Deal Velocity', 'Did the coach push toward more deals, faster execution?', 0.20, 2,
  ARRAY['Reviewed active deal pipeline', 'Pushed for more offers', 'Set deal count targets'],
  ARRAY['Didn''t discuss deals', 'No urgency created', 'Accepted slow pace']
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id WHERE ct.slug = 'coaching_call' AND r.is_active = true
ON CONFLICT DO NOTHING;

INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, 'Action Clarity', 'Did the session end with specific, time-bound action items?', 0.20, 3,
  ARRAY['Set 3+ specific actions', 'Each action had a deadline', 'Clear ownership on each'],
  ARRAY['Vague takeaways', 'No deadlines set', 'Too many items to track']
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id WHERE ct.slug = 'coaching_call' AND r.is_active = true
ON CONFLICT DO NOTHING;

INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, 'Relationship & Motivation', 'Did the coach maintain a supportive, motivating relationship?', 0.10, 4,
  ARRAY['Celebrated wins', 'Showed empathy for challenges', 'Left franchisee energized'],
  ARRAY['Only focused on negatives', 'Felt transactional', 'Franchisee seemed deflated']
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id WHERE ct.slug = 'coaching_call' AND r.is_active = true
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════
-- ONBOARDING CALL (New franchisee setup — systems, expectations, support)
-- ═══════════════════════════════════════════════════

INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, 'Systems Setup', 'Were technology and operational systems properly introduced?', 0.25, 0,
  ARRAY['Covered GHL/MasterSuite access', 'Walked through key tools', 'Verified logins work'],
  ARRAY['Skipped system setup', 'Left franchisee confused about tools', 'No hands-on walkthrough']
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id WHERE ct.slug = 'onboarding_call' AND r.is_active = true
ON CONFLICT DO NOTHING;

INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, 'Expectation Setting', 'Were first 30/60/90 day expectations clearly communicated?', 0.25, 1,
  ARRAY['Covered 30/60/90 milestones', 'Set deal count expectations', 'Explained support cadence'],
  ARRAY['No timeline shared', 'Vague about expectations', 'Didn''t set milestones']
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id WHERE ct.slug = 'onboarding_call' AND r.is_active = true
ON CONFLICT DO NOTHING;

INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, 'Territory Orientation', 'Was the franchisee oriented to their territory and market?', 0.20, 2,
  ARRAY['Reviewed territory boundaries', 'Discussed market conditions', 'Identified initial target areas'],
  ARRAY['No territory discussion', 'Generic market overview', 'Didn''t connect territory to strategy']
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id WHERE ct.slug = 'onboarding_call' AND r.is_active = true
ON CONFLICT DO NOTHING;

INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, 'Support Structure', 'Was the franchisee introduced to their support team and resources?', 0.15, 3,
  ARRAY['Introduced coach', 'Explained Trainual', 'Covered weekly call schedule'],
  ARRAY['No team intro', 'Skipped resources', 'Franchisee doesn''t know who to call']
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id WHERE ct.slug = 'onboarding_call' AND r.is_active = true
ON CONFLICT DO NOTHING;

INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, 'Energy & Confidence', 'Did the franchisee leave the call confident and excited?', 0.15, 4,
  ARRAY['Franchisee expressed excitement', 'Questions were answered thoroughly', 'Clear enthusiasm for getting started'],
  ARRAY['Franchisee seemed overwhelmed', 'Unanswered questions lingered', 'Low energy']
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id WHERE ct.slug = 'onboarding_call' AND r.is_active = true
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════
-- GROUP CALL / COHORT CALL (Knowledge sharing, engagement, action items)
-- ═══════════════════════════════════════════════════

INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, 'Content Quality', 'Was the content shared valuable and actionable?', 0.30, 0,
  ARRAY['Shared specific tactics', 'Used real deal examples', 'Content matched audience needs'],
  ARRAY['Generic content', 'Too theoretical', 'Not relevant to attendees']
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id WHERE ct.slug = 'group_call' AND r.is_active = true
ON CONFLICT DO NOTHING;

INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, 'Participant Engagement', 'Were participants actively engaged and contributing?', 0.25, 1,
  ARRAY['Multiple participants spoke', 'Q&A was active', 'Peer sharing happened'],
  ARRAY['One-way presentation', 'Low participation', 'Participants seemed disengaged']
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id WHERE ct.slug = 'group_call' AND r.is_active = true
ON CONFLICT DO NOTHING;

INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, 'Facilitation', 'Was the session well-facilitated and time-managed?', 0.20, 2,
  ARRAY['Stayed on agenda', 'Managed dominant speakers', 'Good pacing'],
  ARRAY['Went off track', 'One person dominated', 'Ran over time']
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id WHERE ct.slug = 'group_call' AND r.is_active = true
ON CONFLICT DO NOTHING;

INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, 'Takeaways & Actions', 'Did the session end with clear takeaways for participants?', 0.25, 3,
  ARRAY['Summarized key points', 'Set group action items', 'Clear next session topic'],
  ARRAY['No summary', 'No action items', 'Ended abruptly']
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id WHERE ct.slug = 'group_call' AND r.is_active = true
ON CONFLICT DO NOTHING;

-- Copy group criteria to cohort (same rubric structure)
INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, rc.name, rc.description, rc.weight, rc.sort_order, rc.positive_examples, rc.negative_examples
FROM rubric_criteria rc
JOIN rubrics gr ON rc.rubric_id = gr.id
JOIN call_types gct ON gr.call_type_id = gct.id AND gct.slug = 'group_call'
JOIN rubrics r ON true
JOIN call_types ct ON r.call_type_id = ct.id AND ct.slug = 'cohort_call'
WHERE gr.is_active = true AND r.is_active = true
ON CONFLICT DO NOTHING;
