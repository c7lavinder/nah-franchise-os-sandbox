-- ══════════════════════════════════════════════
-- Session 4 Part 3: Call Grading Rubric KB Documents
--
-- 5 coaching rubric documents for Scout call grading.
-- Idempotent: upsert on title using ON CONFLICT.
-- ══════════════════════════════════════════════

-- Need a unique constraint on title for upsert
CREATE UNIQUE INDEX IF NOT EXISTS idx_kd_title ON knowledge_documents(title);

INSERT INTO knowledge_documents (title, category, content, is_active, priority, token_count)
VALUES
(
  'Universal Call Rubric',
  'coaching',
  E'Grade every NAH call on these five dimensions (1–5 each):\n\n1. Discovery quality\nDid the caller ask open-ended questions that uncovered motivation,\ndefinition of success, and hesitations?\n5 = deep discovery, specific insights captured\n1 = surface-level, mostly talking not listening\n\n2. Active listening\nDid the caller adapt based on what the prospect said?\n5 = conversation felt natural, prospect led\n1 = mechanical, caller talked over prospect\n\n3. Objection handling\nWere concerns acknowledged and addressed directly?\n5 = objection surfaced, addressed specifically, resolved or logged\n1 = objection avoided or dismissed\n\n4. Next step clarity\nDid the call end with a clear, specific next step both parties agreed on?\n5 = clear next step, date/time agreed\n1 = vague close, no commitment\n\n5. Tone and rapport\nWas the conversation natural, warm, and trust-building?\n5 = genuine, relaxed, prospect engaged\n1 = stiff, awkward, prospect disengaged\n\nOverall grade = weighted average.\nA = 4.5–5.0 | B = 4.0–4.4 | C = 3.0–3.9 | D = 2.0–2.9 | F = below 2.0',
  true, 85, 200
)
ON CONFLICT (title) DO UPDATE SET
  content = EXCLUDED.content,
  category = EXCLUDED.category,
  priority = EXCLUDED.priority,
  updated_at = now();

INSERT INTO knowledge_documents (title, category, content, is_active, priority, token_count)
VALUES
(
  'Matt Call Rubric — Qualification',
  'coaching',
  E'Apply the Universal Call Rubric first, then grade these Matt-specific dimensions:\n\nWhy discovery\nDid Matt uncover the prospect''s primary motivation?\nDid he ask "why now" and "what does success look like in 2 years"?\nDid he get specific numbers and timeline, not just vague goals?\n\nHesitation surfacing\nDid Matt proactively ask about concerns before they became objections?\nIf Zorakle shows a Belonger profile: did he address security concerns?\n(Belongers need to connect stability to the opportunity, not just upside)\n\nCommitment progression\nDid the call move toward a decision, not just provide information?\nDid Matt gauge readiness? ("On a scale of 1–10, how ready are you?")\nDid he set clear expectations for what happens after this call?\n\nPersonality reading\nBased on the transcript, does Matt''s impression align with Zorakle data?\nNote signals that support or contradict the personality profile.',
  true, 84, 180
)
ON CONFLICT (title) DO UPDATE SET
  content = EXCLUDED.content,
  category = EXCLUDED.category,
  priority = EXCLUDED.priority,
  updated_at = now();

INSERT INTO knowledge_documents (title, category, content, is_active, priority, token_count)
VALUES
(
  'Sam Call Rubric — Discovery',
  'coaching',
  E'Apply the Universal Call Rubric first, then grade these Sam-specific dimensions:\n\nMasterSuite demo effectiveness\nDid Sam show MasterSuite clearly and connect it to daily operations?\nDid she demonstrate a real deal or realistic example?\nDid the prospect engage or seem confused?\n\nTypical deal walkthrough\nDid Sam walk through a real deal from acquisition to sale?\nWere specific numbers used (purchase price, reno cost, sale price, profit)?\nDid she connect deal numbers to the prospect''s financial goals?\n\nOperational readiness signals\nDid Sam probe for time availability, contractor access, market knowledge?\nWere any red flags about operational readiness noted or addressed?\n\nCapital conversation bridge\nDid Sam naturally set up the Mark Call?\nDoes the prospect understand capital requirements before that conversation?',
  true, 83, 170
)
ON CONFLICT (title) DO UPDATE SET
  content = EXCLUDED.content,
  category = EXCLUDED.category,
  priority = EXCLUDED.priority,
  updated_at = now();

INSERT INTO knowledge_documents (title, category, content, is_active, priority, token_count)
VALUES
(
  'Mark Call Rubric — Capital',
  'coaching',
  E'Apply the Universal Call Rubric first, then grade these Mark-specific dimensions:\n\nFinancial picture clarity\nDid Mark get a clear understanding of liquid capital available?\nDid he identify the financing path (cash, SBA, HELOC, ROBS/Guidant)?\nWas a realistic timeline for capital readiness established?\n\nFinancial resilience probe\nDid Mark assess the prospect''s ability to handle financial variance?\n(What happens if a deal takes longer or a month is slow?)\nIf Zorakle shows Belonger: did Mark validate security concerns directly?\n\nRed and yellow flags\nWere financial red flags (insufficient capital, over-leveraged) identified?\nWere yellow flags (tight capital, ROBS timeline) documented?\nWas appropriate concern communicated clearly?\n\nNext step specificity\nDoes the prospect know exactly what they need to do financially to proceed?\nWas a clear path to the franchise fee established?',
  true, 82, 170
)
ON CONFLICT (title) DO UPDATE SET
  content = EXCLUDED.content,
  category = EXCLUDED.category,
  priority = EXCLUDED.priority,
  updated_at = now();

INSERT INTO knowledge_documents (title, category, content, is_active, priority, token_count)
VALUES
(
  'John Coaching Call Rubric — Franchisee Coaching',
  'coaching',
  E'Apply the Universal Call Rubric first, then grade these John-specific dimensions:\n\nProgress accountability\nDid John review specific commitments from the last call?\nWere results discussed with specific numbers (offers, houses viewed)?\nWas underperformance addressed directly, not glossed over?\n\nObstacle identification\nDid the call surface what is actually blocking the franchisee?\nWere excuses distinguished from real obstacles?\nWas a plan made to address each real obstacle?\n\nHouse purchase velocity focus\nDid the conversation orient toward increasing houses purchased?\nIs the franchisee on track for 10+ houses in the next 12 months?\nIf not — was a specific recovery plan discussed?\n\nAction item clarity\nDid the call end with 2–3 specific, measurable commitments?\nDoes the franchisee know exactly what to do before the next call?\nWere those commitments logged in the system?',
  true, 81, 170
)
ON CONFLICT (title) DO UPDATE SET
  content = EXCLUDED.content,
  category = EXCLUDED.category,
  priority = EXCLUDED.priority,
  updated_at = now();
