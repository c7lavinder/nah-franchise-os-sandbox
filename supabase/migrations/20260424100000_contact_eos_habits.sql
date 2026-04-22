-- ═══════════════════════════════════════════════════════════════════
-- Contact-scoped EOS habits: user-authored recurring practices that
-- follow the person across every journey. Unlike territory habits
-- (which are seeded from a fixed template), contact habits are
-- add/edit/delete per user intent.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS eos_contact_habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  habit_text TEXT NOT NULL,
  cadence TEXT NOT NULL DEFAULT 'weekly'
    CHECK (cadence IN ('daily','weekly','biweekly','monthly','quarterly')),
  grade TEXT CHECK (grade IN ('A','B','C','D','F')),
  sort_order INT DEFAULT 0,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eos_contact_habits_contact ON eos_contact_habits(contact_id);
