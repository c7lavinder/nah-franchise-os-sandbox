-- ============================================================
-- NAH Franchise OS — Seed Data
-- ============================================================
-- Run this AFTER 001_initial_schema.sql.
-- Creates: admin user, default settings, starter knowledge base.
-- ============================================================

-- ============================================================
-- 1. ADMIN USER
-- ============================================================
-- NOTE: This creates a user record in the app's users table.
-- You still need to create this user in Supabase Auth (Dashboard → Authentication → Users)
-- with the same email. The id here should match the Supabase Auth uid.
-- For development, you can update the id after creating the Auth user.

INSERT INTO users (email, full_name, role) VALUES
  ('admin@newagainhouses.com', 'Admin', 'leadership');

-- ============================================================
-- 2. DEFAULT APP SETTINGS
-- ============================================================
INSERT INTO app_settings (setting_key, setting_value, description) VALUES
  ('ghl_pipeline_id', '"default"'::jsonb, 'The GHL pipeline ID for the franchise sales pipeline. Set this after connecting GHL.'),
  ('scout_model', '"claude-sonnet-4-5-20250514"'::jsonb, 'The Claude model used for Scout conversations.'),
  ('scout_fast_model', '"claude-haiku-4-5-20251001"'::jsonb, 'The Claude model used for summarization and simple queries.'),
  ('scout_max_tokens', '4096'::jsonb, 'Maximum tokens for Scout responses.'),
  ('scout_conversation_window', '20'::jsonb, 'Number of recent messages to keep in the conversation window.'),
  ('accountability_enabled', 'true'::jsonb, 'Whether the accountability engine is active.'),
  ('speed_to_lead_minutes', '5'::jsonb, 'Speed-to-lead target in minutes.'),
  ('stale_lead_hours', '1'::jsonb, 'Hours before a New Lead is considered stale.'),
  ('fdd_window_days', '14'::jsonb, 'Mandatory FDD review period in days.'),
  ('nurture_archive_days', '90'::jsonb, 'Days before archiving a nurture lead with zero engagement.');

-- ============================================================
-- 3. STARTER KNOWLEDGE BASE
-- ============================================================

-- Brand overview
INSERT INTO knowledge_documents (title, category, content, priority, token_count) VALUES
(
  'New Again Houses — Brand Overview',
  'brand',
  'New Again Houses (NAH) is a house-flipping franchise company. NAH franchisees buy, renovate, and sell residential properties for profit.

Key facts:
- Founded to make house flipping accessible through a proven franchise model
- Franchisees receive training, systems, tools, and ongoing support
- Territories are exclusive — each franchisee operates in a defined geographic area
- NAH provides the brand, the playbook, and the technology platform

Value proposition for franchise candidates:
- Proven business model with documented processes
- No prior real estate experience required (training provided)
- Exclusive territory protection
- Ongoing support from the NAH corporate team
- Access to the NAH Franchise OS platform (Scout AI, pipeline management, accountability tools)

Target franchise candidate profile:
- Entrepreneurial mindset
- Access to required investment capital
- Willingness to follow the NAH system
- Interest in real estate and/or business ownership
- Coachable and growth-oriented',
  100,
  200
),

-- Pipeline overview
(
  'Franchise Sales Pipeline — Overview',
  'pipeline',
  'The NAH franchise sales pipeline has 10 stages:

1. New Lead — Lead entered the system, not yet contacted
2. Attempted Contact — Rep has made outreach attempts, no live conversation yet
3. Connected/Qualified — Live conversation happened, basic qualification confirmed
4. Discovery Call Scheduled — Formal deep-dive call is booked
5. Discovery Call Complete — Call conducted, detailed assessment done
6. Validation/Due Diligence — Lead is evaluating the opportunity, reviewing materials
7. FDD Sent — Franchise Disclosure Document delivered, 14-day mandatory review begins
8. In Closing — Both parties working toward signing the franchise agreement
9. Won (Signed) — Franchise agreement signed, fee received
10. Lost/Nurture — Lead did not convert, may be nurtured for future re-engagement

Key rules:
- Stages cannot be skipped
- Speed-to-lead: first contact within 5 minutes
- FDD has a legally required 14-day minimum review period
- Moving to Lost/Nurture requires a documented reason
- Every stage has time targets and accountability triggers',
  90,
  250
),

-- Common objections
(
  'Common Franchise Objections and Responses',
  'objections',
  'Common objections from franchise candidates and suggested responses:

1. "The franchise fee is too high."
Response: The fee covers your exclusive territory, full training program, ongoing support, access to our technology platform, and the NAH brand. Compare this to starting a house-flipping business from scratch — the fee buys you years of trial and error avoided.

2. "I don''t have real estate experience."
Response: Most of our successful franchisees came from outside real estate. Our training program covers everything from finding deals to managing renovations to selling properties. The NAH system is designed for people who are coachable, not people who already know everything.

3. "I need to think about it."
Response: Absolutely — this is a big decision and we want you to take the time you need. What specific questions or concerns can I help you work through? Sometimes it helps to talk through the parts that feel uncertain.

4. "What if my territory doesn''t have enough deals?"
Response: We perform a detailed market analysis before approving any territory. We only offer territories where the data supports a viable flipping business. I can walk you through the market data for your area.

5. "How long until I see a return on my investment?"
Response: Most franchisees complete their first flip within 90 days of finishing training. Profitability depends on your market and deal flow, but our top performers are profitable within their first year. I can share case studies from franchisees in similar markets.

IMPORTANT: Never provide specific financial projections or guarantees. Always refer to the FDD for financial performance representations.',
  80,
  350
),

-- Industry context
(
  'House Flipping Industry Context',
  'industry',
  'Key industry context for franchise sales conversations:

Market size: The US house flipping market generates billions annually. In recent years, flipped homes have accounted for 5-8% of all home sales nationally.

Why franchising works for house flipping:
- House flipping has high failure rates for solo operators (lack of systems, market knowledge, contractor networks)
- A franchise model reduces risk through proven processes, bulk purchasing power, and shared best practices
- Franchisees benefit from brand recognition and established vendor relationships

Current market conditions to be aware of:
- Interest rates affect both acquisition costs and buyer demand
- Inventory levels vary significantly by market
- Renovation costs have increased — having a system to manage contractors is critical
- Markets with population growth and housing demand are strongest for NAH franchisees

Competitive landscape:
- NAH competes with other franchise models, independent flipping courses/coaching, and the "do it yourself" approach
- NAH differentiates through its technology platform (Scout AI), exclusive territories, and hands-on corporate support
- The franchise model provides structure that courses and coaching cannot match',
  70,
  250
);
