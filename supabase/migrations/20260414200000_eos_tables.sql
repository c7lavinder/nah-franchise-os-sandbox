-- ═══════════════════════════════════════════════════════════════════
-- EOS (Entrepreneurial Operating System) Tables
-- 3 contact-scoped + 8 territory-scoped = 11 tables
-- ═══════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────
-- CONTACT-SCOPED EOS TABLES (sales intelligence per prospect)
-- ───────────────────────────────────────────────────────────────────

-- Contact goals (candidate's personal goals during sales process)
CREATE TABLE IF NOT EXISTS eos_contact_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  income_goal TEXT,
  lifestyle_goal TEXT,
  qol_goal TEXT,
  source TEXT DEFAULT 'manual',
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (contact_id)
);

-- Contact issues (objections / concerns flagged during sales calls)
CREATE TABLE IF NOT EXISTS eos_contact_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  issue_text TEXT NOT NULL,
  is_done BOOLEAN DEFAULT false,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Contact to-dos (internal next steps for this specific candidate)
CREATE TABLE IF NOT EXISTS eos_contact_todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  todo_text TEXT NOT NULL,
  is_done BOOLEAN DEFAULT false,
  owner_user_id UUID REFERENCES users(id),
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ───────────────────────────────────────────────────────────────────
-- TERRITORY-SCOPED EOS TABLES (franchisee operating system)
-- ───────────────────────────────────────────────────────────────────

-- Territory goals (Actual / Current Year / Year 5 / Year 25)
CREATE TABLE IF NOT EXISTS eos_territory_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_slug TEXT NOT NULL,
  goal_type TEXT NOT NULL,
  actual TEXT,
  current_year_goal TEXT,
  year_5_goal TEXT,
  year_25_goal TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (territory_slug, goal_type)
);

-- Territory scorecard goal targets (actuals come from MasterSuite — blank at MVP)
CREATE TABLE IF NOT EXISTS eos_territory_scorecard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_slug TEXT NOT NULL,
  metric_key TEXT NOT NULL,
  metric_label TEXT NOT NULL,
  goal_value TEXT,
  sort_order INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (territory_slug, metric_key)
);

-- Territory marketing budget line items
CREATE TABLE IF NOT EXISTS eos_territory_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_slug TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC DEFAULT 0,
  sort_order INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Territory lead generation channel checkboxes
CREATE TABLE IF NOT EXISTS eos_territory_lead_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_slug TEXT NOT NULL,
  channel_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (territory_slug, channel_name)
);

-- Territory habits (A/B/C/D/F grading)
CREATE TABLE IF NOT EXISTS eos_territory_habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_slug TEXT NOT NULL,
  habit_key TEXT NOT NULL,
  habit_label TEXT NOT NULL,
  grade TEXT CHECK (grade IN ('A','B','C','D','F')),
  sort_order INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (territory_slug, habit_key)
);

-- Territory rocks (90-day priorities)
CREATE TABLE IF NOT EXISTS eos_territory_rocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_slug TEXT NOT NULL,
  rock_text TEXT NOT NULL,
  status TEXT DEFAULT 'not_done'
    CHECK (status IN ('not_done','on_track','off_track','complete')),
  quarter INT,
  year INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Territory issues (operational problems)
CREATE TABLE IF NOT EXISTS eos_territory_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_slug TEXT NOT NULL,
  issue_text TEXT NOT NULL,
  is_done BOOLEAN DEFAULT false,
  source TEXT DEFAULT 'manual',
  origin_contact_id UUID REFERENCES contacts(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Territory to-dos (action items)
CREATE TABLE IF NOT EXISTS eos_territory_todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_slug TEXT NOT NULL,
  todo_text TEXT NOT NULL,
  is_done BOOLEAN DEFAULT false,
  owner_user_id UUID REFERENCES users(id),
  source TEXT DEFAULT 'manual',
  origin_contact_id UUID REFERENCES contacts(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ───────────────────────────────────────────────────────────────────
-- INDEXES
-- ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_eos_contact_goals_contact ON eos_contact_goals(contact_id);
CREATE INDEX IF NOT EXISTS idx_eos_contact_issues_contact ON eos_contact_issues(contact_id);
CREATE INDEX IF NOT EXISTS idx_eos_contact_todos_contact ON eos_contact_todos(contact_id);

CREATE INDEX IF NOT EXISTS idx_eos_territory_goals_slug ON eos_territory_goals(territory_slug);
CREATE INDEX IF NOT EXISTS idx_eos_territory_scorecard_slug ON eos_territory_scorecard(territory_slug);
CREATE INDEX IF NOT EXISTS idx_eos_territory_budgets_slug ON eos_territory_budgets(territory_slug);
CREATE INDEX IF NOT EXISTS idx_eos_territory_lead_channels_slug ON eos_territory_lead_channels(territory_slug);
CREATE INDEX IF NOT EXISTS idx_eos_territory_habits_slug ON eos_territory_habits(territory_slug);
CREATE INDEX IF NOT EXISTS idx_eos_territory_rocks_slug ON eos_territory_rocks(territory_slug);
CREATE INDEX IF NOT EXISTS idx_eos_territory_issues_slug ON eos_territory_issues(territory_slug);
CREATE INDEX IF NOT EXISTS idx_eos_territory_todos_slug ON eos_territory_todos(territory_slug);

-- ───────────────────────────────────────────────────────────────────
-- SEED DATA FUNCTION — call once per territory at creation
-- Usage: SELECT seed_eos_territory('territory-slug-here');
-- ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION seed_eos_territory(p_slug TEXT) RETURNS void AS $$
BEGIN
  -- Scorecard metrics
  INSERT INTO eos_territory_scorecard (territory_slug, metric_key, metric_label, sort_order)
  VALUES
    (p_slug, 't3_leads_entered',      'T3 Leads Entered',       1),
    (p_slug, 't3_s1_to_s4_pct',       'T3 S1 to S4 %',          2),
    (p_slug, 't3_purchased',          'T3 Purchased',            3),
    (p_slug, 't3_avg_inventory',      'T3 AVG Inventory',        4),
    (p_slug, 't12_median_cycle_days', 'T12 Median Cycle Days',   5),
    (p_slug, 't3_gross_profit',       'T3 Gross Profit',         6),
    (p_slug, 't3_compliance_score',   'T3 Compliance Score',     7)
  ON CONFLICT (territory_slug, metric_key) DO NOTHING;

  -- Habits
  INSERT INTO eos_territory_habits (territory_slug, habit_key, habit_label, sort_order)
  VALUES
    (p_slug, 'daily_tasks',              'Daily Tasks',               1),
    (p_slug, 'weekly_contractor_meeting','Weekly Contractor Meeting',  2),
    (p_slug, 'biweekly_agent_meeting',   'Bi-weekly Agent Meeting',   3),
    (p_slug, 'weekly_accounting',        'Weekly Accounting',         4),
    (p_slug, 'monthly_lead_manager',     'Monthly Lead Manager',      5)
  ON CONFLICT (territory_slug, habit_key) DO NOTHING;

  -- Lead channels (35 total — mirrors MasterSuite exactly)
  INSERT INTO eos_territory_lead_channels (territory_slug, channel_name, sort_order)
  VALUES
    (p_slug,'Bulk Lists',1),(p_slug,'Lead Mining',2),(p_slug,'Listed Auctions',3),
    (p_slug,'Referral Partners',4),(p_slug,'Digital Prospect Now',5),
    (p_slug,'Vacants',6),(p_slug,'High Equity',7),(p_slug,'Absentee Owners',8),
    (p_slug,'Probates',9),(p_slug,'Evictions',10),(p_slug,'City Citations',11),
    (p_slug,'Distressed Rentals',12),(p_slug,'Divorces',13),
    (p_slug,'Social Platforms',14),(p_slug,'Birddogs',15),
    (p_slug,'Agent Listed',16),(p_slug,'FSBO',17),(p_slug,'Foreclosures',18),
    (p_slug,'Brokered Auctions',19),(p_slug,'Wholesalers',20),
    (p_slug,'Agents Industry Network',21),(p_slug,'Homelight',22),
    (p_slug,'Asset Managers',23),(p_slug,'Facebook Ads',24),
    (p_slug,'Google Ads',25),(p_slug,'Google Retargeting',26),
    (p_slug,'Organic Search',27),(p_slug,'Google Map Pack',28),
    (p_slug,'Google Business',29),(p_slug,'Facebook',30),
    (p_slug,'Instagram',31),(p_slug,'TikTok',32),
    (p_slug,'YouTube',33),(p_slug,'Google Business Profile',34),
    (p_slug,'Other Social Media',35)
  ON CONFLICT (territory_slug, channel_name) DO NOTHING;

  -- Goal rows (3 types — blank by default)
  INSERT INTO eos_territory_goals (territory_slug, goal_type)
  VALUES
    (p_slug, 'houses_purchased'),
    (p_slug, 'gross_profit'),
    (p_slug, 'quality_of_life')
  ON CONFLICT (territory_slug, goal_type) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- ───────────────────────────────────────────────────────────────────
-- Seed all existing territories
-- ───────────────────────────────────────────────────────────────────

DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN SELECT ms_slug FROM territories LOOP
    PERFORM seed_eos_territory(t.ms_slug);
  END LOOP;
END;
$$;
