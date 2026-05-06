-- Fix: create rubrics for call types that were added after the original
-- rubric seed ran. Without a rubric row, the criteria seed (20260429100000)
-- silently inserted 0 rows for coaching_call, group_call, etc.

-- Step 1: Create rubrics for any call_type that doesn't have one yet.
INSERT INTO rubrics (call_type_id, name, description, is_active)
SELECT ct.id, ct.name || ' — Default Rubric', 'Admin-configured rubric for ' || ct.name, true
FROM call_types ct
WHERE NOT EXISTS (
  SELECT 1 FROM rubrics r WHERE r.call_type_id = ct.id
)
ON CONFLICT DO NOTHING;

-- Step 2: Re-seed criteria for all call types. ON CONFLICT DO NOTHING
-- ensures existing criteria (like onboarding_call's) aren't duplicated.

-- ── INTRO CALL ──
INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, v.name, v.description, v.weight, v.sort_order, v.positive_examples, v.negative_examples
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id
CROSS JOIN (VALUES
  ('Rapport Building', 'Did the rep establish a personal connection and set a warm tone?', 0.20, 0,
    ARRAY['Used prospect''s name naturally', 'Referenced their background', 'Found common ground'],
    ARRAY['Jumped straight to pitch', 'Sounded scripted', 'No personalization']),
  ('Discovery Questions', 'Did the rep ask open-ended questions to understand motivation, timeline, and capital?', 0.25, 1,
    ARRAY['Asked why franchising', 'Explored timeline', 'Asked about capital readiness'],
    ARRAY['Only asked yes/no questions', 'Talked more than listened', 'Skipped motivation']),
  ('NAH Value Proposition', 'Did the rep clearly communicate what makes NAH different?', 0.20, 2,
    ARRAY['Explained the model clearly', 'Used real examples', 'Connected value to prospect''s goals'],
    ARRAY['Generic pitch', 'No differentiation from competitors', 'Overwhelmed with info']),
  ('Objection Surfacing', 'Did the rep invite and address concerns rather than avoid them?', 0.15, 3,
    ARRAY['Asked "what concerns do you have?"', 'Addressed spouse/partner hesitation', 'Handled capital worry'],
    ARRAY['Avoided difficult topics', 'Dismissed concerns', 'Got defensive']),
  ('Next Steps & Momentum', 'Did the rep secure a clear next step with a date/time?', 0.20, 4,
    ARRAY['Scheduled the Matt Call on the spot', 'Sent NDA during the call', 'Set specific follow-up date'],
    ARRAY['Ended with "I''ll follow up"', 'No next step defined', 'Left it open-ended'])
) AS v(name, description, weight, sort_order, positive_examples, negative_examples)
WHERE ct.slug = 'intro_call' AND r.is_active = true
ON CONFLICT DO NOTHING;

-- ── MATT CALL ──
INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, v.name, v.description, v.weight, v.sort_order, v.positive_examples, v.negative_examples
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id
CROSS JOIN (VALUES
  ('Why Discovery', 'Did Matt uncover the deep "why" behind the prospect''s interest?', 0.25, 0,
    ARRAY['Got past surface answers', 'Found emotional driver', 'Connected why to franchise fit'],
    ARRAY['Accepted first answer', 'Didn''t dig deeper', 'Talked about NAH instead of listening']),
  ('Personality Read', 'Did Matt assess communication style, decision-making approach, and partner dynamics?', 0.20, 1,
    ARRAY['Identified decision-making style', 'Read spouse/partner dynamics', 'Adapted communication to prospect'],
    ARRAY['One-size-fits-all approach', 'Missed spouse influence', 'Didn''t adjust to prospect''s style']),
  ('Hesitation Surfacing', 'Did Matt surface and address hidden objections?', 0.20, 2,
    ARRAY['Asked "what would stop you?"', 'Surfaced timeline concerns', 'Addressed capital fears directly'],
    ARRAY['Avoided tough questions', 'Let silence fill with pitch', 'Missed red flags']),
  ('Commitment Progression', 'Did Matt move the prospect closer to a decision?', 0.20, 3,
    ARRAY['Got verbal commitment to next step', 'Tested urgency', 'Set expectation for timeline'],
    ARRAY['Ended without advancing', 'Left prospect uncommitted', 'No urgency created']),
  ('Process Clarity', 'Did Matt explain what happens next in the process?', 0.15, 4,
    ARRAY['Explained Sam Call purpose', 'Set timeline expectations', 'Covered NDA/Zorakle if needed'],
    ARRAY['Prospect left confused about process', 'Skipped next steps', 'No timeline'])
) AS v(name, description, weight, sort_order, positive_examples, negative_examples)
WHERE ct.slug = 'matt_call' AND r.is_active = true
ON CONFLICT DO NOTHING;

-- ── SAM CALL ──
INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, v.name, v.description, v.weight, v.sort_order, v.positive_examples, v.negative_examples
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id
CROSS JOIN (VALUES
  ('Operational Readiness', 'Did Sam assess the prospect''s ability to run a business?', 0.25, 0,
    ARRAY['Explored business experience', 'Assessed management capability', 'Checked time commitment'],
    ARRAY['Assumed readiness', 'Skipped experience questions', 'Didn''t verify availability']),
  ('Deal Walkthrough', 'Did Sam explain the house-flipping model with real numbers?', 0.25, 1,
    ARRAY['Used actual deal examples', 'Showed profit margins', 'Explained the full deal cycle'],
    ARRAY['Vague about numbers', 'No concrete examples', 'Oversimplified the model']),
  ('Capital Bridge', 'Did Sam connect the prospect''s financial situation to what''s needed?', 0.25, 2,
    ARRAY['Discussed liquid capital', 'Explained lending options', 'Connected capital to timeline'],
    ARRAY['Avoided money talk', 'Didn''t verify capital', 'Made assumptions about finances']),
  ('MasterSuite Demo', 'Did Sam effectively demonstrate the technology platform?', 0.15, 3,
    ARRAY['Showed relevant features', 'Connected tech to daily ops', 'Prospect engaged with demo'],
    ARRAY['Skipped demo', 'Demo felt rushed', 'Didn''t connect to prospect needs']),
  ('Next Step Specificity', 'Did Sam set a specific next step with date?', 0.10, 4,
    ARRAY['Scheduled Mark Call', 'Set background check expectation', 'Clear timeline communicated'],
    ARRAY['Vague follow-up', 'No specific date', 'Left prospect without direction'])
) AS v(name, description, weight, sort_order, positive_examples, negative_examples)
WHERE ct.slug = 'sam_call' AND r.is_active = true
ON CONFLICT DO NOTHING;

-- ── MARK CALL ──
INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, v.name, v.description, v.weight, v.sort_order, v.positive_examples, v.negative_examples
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id
CROSS JOIN (VALUES
  ('Financial Clarity', 'Did Mark clearly explain lending requirements and options?', 0.30, 0,
    ARRAY['Explained SBA/conventional options', 'Covered credit requirements', 'Discussed down payment'],
    ARRAY['Vague about requirements', 'Skipped important details', 'Confused the prospect']),
  ('Capital Assessment', 'Did Mark accurately assess the prospect''s financial position?', 0.25, 1,
    ARRAY['Asked about liquid capital', 'Verified credit score range', 'Assessed net worth'],
    ARRAY['Took prospect''s word at face value', 'Didn''t verify numbers', 'Missed debt load']),
  ('Red/Yellow Flag Detection', 'Did Mark identify and flag financial risks?', 0.20, 2,
    ARRAY['Flagged credit issues early', 'Identified capital gaps', 'Communicated risks to team'],
    ARRAY['Missed obvious red flags', 'Didn''t probe inconsistencies', 'Overly optimistic']),
  ('Resilience Probe', 'Did Mark test the prospect''s financial resilience and runway?', 0.15, 3,
    ARRAY['Asked about runway if deals slow', 'Discussed worst-case scenarios', 'Tested commitment level'],
    ARRAY['Only talked best case', 'Didn''t test financial stamina', 'Avoided tough questions']),
  ('Next Steps', 'Did Mark set clear financial next steps?', 0.10, 4,
    ARRAY['Scheduled PFS review', 'Set lending application timeline', 'Clear action items'],
    ARRAY['No next step defined', 'Left financial questions open', 'Vague follow-up'])
) AS v(name, description, weight, sort_order, positive_examples, negative_examples)
WHERE ct.slug = 'mark_call' AND r.is_active = true
ON CONFLICT DO NOTHING;

-- ── COACHING CALL ──
INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, v.name, v.description, v.weight, v.sort_order, v.positive_examples, v.negative_examples
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id
CROSS JOIN (VALUES
  ('Progress Accountability', 'Did the coach review progress on goals and action items from last session?', 0.25, 0,
    ARRAY['Reviewed last session''s commitments', 'Tracked goal progress with numbers', 'Held franchisee accountable'],
    ARRAY['Skipped review', 'Didn''t reference past goals', 'Let missed commitments slide']),
  ('Obstacle Identification', 'Did the coach help identify and address current blockers?', 0.25, 1,
    ARRAY['Asked about challenges', 'Identified root causes', 'Offered specific solutions'],
    ARRAY['Ignored problems', 'Surface-level discussion', 'Didn''t dig into blockers']),
  ('Deal Velocity', 'Did the coach push toward more deals, faster execution?', 0.20, 2,
    ARRAY['Reviewed active deal pipeline', 'Pushed for more offers', 'Set deal count targets'],
    ARRAY['Didn''t discuss deals', 'No urgency created', 'Accepted slow pace']),
  ('Action Clarity', 'Did the session end with specific, time-bound action items?', 0.20, 3,
    ARRAY['Set 3+ specific actions', 'Each action had a deadline', 'Clear ownership on each'],
    ARRAY['Vague takeaways', 'No deadlines set', 'Too many items to track']),
  ('Relationship & Motivation', 'Did the coach maintain a supportive, motivating relationship?', 0.10, 4,
    ARRAY['Celebrated wins', 'Showed empathy for challenges', 'Left franchisee energized'],
    ARRAY['Only focused on negatives', 'Felt transactional', 'Franchisee seemed deflated'])
) AS v(name, description, weight, sort_order, positive_examples, negative_examples)
WHERE ct.slug = 'coaching_call' AND r.is_active = true
ON CONFLICT DO NOTHING;

-- ── ONBOARDING CALL ──
INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, v.name, v.description, v.weight, v.sort_order, v.positive_examples, v.negative_examples
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id
CROSS JOIN (VALUES
  ('Systems Setup', 'Were technology and operational systems properly introduced?', 0.25, 0,
    ARRAY['Covered GHL/MasterSuite access', 'Walked through key tools', 'Verified logins work'],
    ARRAY['Skipped system setup', 'Left franchisee confused about tools', 'No hands-on walkthrough']),
  ('Expectation Setting', 'Were first 30/60/90 day expectations clearly communicated?', 0.25, 1,
    ARRAY['Covered 30/60/90 milestones', 'Set deal count expectations', 'Explained support cadence'],
    ARRAY['No timeline shared', 'Vague about expectations', 'Didn''t set milestones']),
  ('Territory Orientation', 'Was the franchisee oriented to their territory and market?', 0.20, 2,
    ARRAY['Reviewed territory boundaries', 'Discussed market conditions', 'Identified initial target areas'],
    ARRAY['No territory discussion', 'Generic market overview', 'Didn''t connect territory to strategy']),
  ('Support Structure', 'Was the franchisee introduced to their support team and resources?', 0.15, 3,
    ARRAY['Introduced coach', 'Explained Trainual', 'Covered weekly call schedule'],
    ARRAY['No team intro', 'Skipped resources', 'Franchisee doesn''t know who to call']),
  ('Energy & Confidence', 'Did the franchisee leave the call confident and excited?', 0.15, 4,
    ARRAY['Franchisee expressed excitement', 'Questions were answered thoroughly', 'Clear enthusiasm for getting started'],
    ARRAY['Franchisee seemed overwhelmed', 'Unanswered questions lingered', 'Low energy'])
) AS v(name, description, weight, sort_order, positive_examples, negative_examples)
WHERE ct.slug = 'onboarding_call' AND r.is_active = true
ON CONFLICT DO NOTHING;

-- ── GROUP CALL ──
INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, v.name, v.description, v.weight, v.sort_order, v.positive_examples, v.negative_examples
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id
CROSS JOIN (VALUES
  ('Content Quality', 'Was the content shared valuable and actionable?', 0.30, 0,
    ARRAY['Shared specific tactics', 'Used real deal examples', 'Content matched audience needs'],
    ARRAY['Generic content', 'Too theoretical', 'Not relevant to attendees']),
  ('Participant Engagement', 'Were participants actively engaged and contributing?', 0.25, 1,
    ARRAY['Multiple participants spoke', 'Q&A was active', 'Peer sharing happened'],
    ARRAY['One-way presentation', 'Low participation', 'Participants seemed disengaged']),
  ('Facilitation', 'Was the session well-facilitated and time-managed?', 0.20, 2,
    ARRAY['Stayed on agenda', 'Managed dominant speakers', 'Good pacing'],
    ARRAY['Went off track', 'One person dominated', 'Ran over time']),
  ('Takeaways & Actions', 'Did the session end with clear takeaways for participants?', 0.25, 3,
    ARRAY['Summarized key points', 'Set group action items', 'Clear next session topic'],
    ARRAY['No summary', 'No action items', 'Ended abruptly'])
) AS v(name, description, weight, sort_order, positive_examples, negative_examples)
WHERE ct.slug = 'group_call' AND r.is_active = true
ON CONFLICT DO NOTHING;

-- ── COHORT CALL (same criteria as group) ──
INSERT INTO rubric_criteria (rubric_id, name, description, weight, sort_order, positive_examples, negative_examples)
SELECT r.id, v.name, v.description, v.weight, v.sort_order, v.positive_examples, v.negative_examples
FROM rubrics r JOIN call_types ct ON r.call_type_id = ct.id
CROSS JOIN (VALUES
  ('Content Quality', 'Was the content shared valuable and actionable?', 0.30, 0,
    ARRAY['Shared specific tactics', 'Used real deal examples', 'Content matched audience needs'],
    ARRAY['Generic content', 'Too theoretical', 'Not relevant to attendees']),
  ('Participant Engagement', 'Were participants actively engaged and contributing?', 0.25, 1,
    ARRAY['Multiple participants spoke', 'Q&A was active', 'Peer sharing happened'],
    ARRAY['One-way presentation', 'Low participation', 'Participants seemed disengaged']),
  ('Facilitation', 'Was the session well-facilitated and time-managed?', 0.20, 2,
    ARRAY['Stayed on agenda', 'Managed dominant speakers', 'Good pacing'],
    ARRAY['Went off track', 'One person dominated', 'Ran over time']),
  ('Takeaways & Actions', 'Did the session end with clear takeaways for participants?', 0.25, 3,
    ARRAY['Summarized key points', 'Set group action items', 'Clear next session topic'],
    ARRAY['No summary', 'No action items', 'Ended abruptly'])
) AS v(name, description, weight, sort_order, positive_examples, negative_examples)
WHERE ct.slug = 'cohort_call' AND r.is_active = true
ON CONFLICT DO NOTHING;
