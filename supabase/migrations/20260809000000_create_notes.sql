-- ══════════════════════════════════════════════
-- notes — the human written record for FranDev
-- ══════════════════════════════════════════════
-- The Notes panel has sat on all three record pages (journey, territory,
-- contact) with Wired = false since the record-page rebuild, because FranDev
-- had nowhere to put a note a PERSON wrote. It still doesn't:
--
--   ⚠ contact_journals is the AI's daily summary, not this.
--   ⚠ contacts.notes / territory_stakeholders.notes are single free-text
--     columns on the parent row — one blob, no author, no history, no delete.
--
-- Corey settled the model on 2026-08-08:
--   "journey / territory / contact triangle, journey holds everything"
--   "anyone can edit or delete"
--
-- ONE TABLE, NOT THREE. A note has exactly one home — the record someone was
-- looking at when they wrote it — held in `scope` plus the matching id. Three
-- tables would need three of every read, three replay handlers and three
-- delete paths to say the same thing.
--
-- THE ROLLUP IS DERIVED, NOT STORED. "A territory or contact note also appears
-- in that person's ACTIVE journeys" is a JOIN at read time, not a second row.
-- Storing a copy per journey would mean an edit or a delete has to fan out to
-- every copy, and copies that must be kept in step are the single most
-- expensive recurring bug in this project. Derived also self-heals: move a
-- contact to another territory and the rollup follows with no backfill.
-- 3,151 of 3,155 people have exactly one active journey, so the fan-out is ~1.
--
-- ⚠ DELETES ARE SOFT, AND THIS IS NOT A STYLE CHOICE. The nightly push into
-- MasterSuite (lib/mastersuite/push-frandev.ts) is an upsert-by-primary-key and
-- has no way to express "this row is gone" — a hard-deleted note would vanish
-- here and live in frandev_note forever. Same reasoning, same shape as
-- ghl_appointments.deleted_at (20260713120000).
--
-- Rollback:
--   DROP TABLE IF EXISTS notes;

CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Which record this note was written on. The CHECK below makes exactly one
  -- of the three target columns non-null and forces it to agree with `scope`,
  -- so a row can never be both ambiguous and readable.
  scope text NOT NULL CHECK (scope IN ('journey', 'territory', 'contact')),

  journey_id uuid REFERENCES journeys(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
  -- ⚠ PascalCase deliberately. Migration 20260509000000 renamed ms_slug ->
  -- "TerritorySlug" across seventeen tables to match MasterSuite; every sibling
  -- that points at a territory spells it this way today and every replay
  -- handler reads it this way. Verified against the live schema, not inferred
  -- from the migration that created territory_stakeholders — that one still
  -- says ms_slug and is three months stale.
  "TerritorySlug" text REFERENCES territories("TerritorySlug") ON DELETE CASCADE,

  body text NOT NULL CHECK (btrim(body) <> ''),

  -- Attribution by EMAIL, not by user id. A note can be written from either
  -- side of the fold and the two user tables are different id spaces — the
  -- MasterSuite journal already carries RequestedBy as an email address, so
  -- this is the one key both sides can actually supply. author_name is the
  -- display copy so a read needs no join.
  author_email text NOT NULL,
  author_name text,

  -- 'manual' today. Reserved so an agent-written note can join later without a
  -- migration, matching eos_contact_issues.source.
  source text NOT NULL DEFAULT 'manual',

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- "anyone can edit or delete" (Corey) — so the interesting question is not
  -- WHETHER but WHO, and both are recorded rather than trusted to an audit log
  -- that does not exist.
  edited_at timestamptz,
  edited_by text,
  deleted_at timestamptz,
  deleted_by text,

  CONSTRAINT notes_exactly_one_target CHECK (
    (scope = 'journey'   AND journey_id IS NOT NULL AND contact_id IS NULL     AND "TerritorySlug" IS NULL) OR
    (scope = 'contact'   AND contact_id IS NOT NULL AND journey_id IS NULL     AND "TerritorySlug" IS NULL) OR
    (scope = 'territory' AND "TerritorySlug" IS NOT NULL AND journey_id IS NULL AND contact_id IS NULL)
  )
);

-- One index per target, each partial on the live rows: every read is
-- "the notes on this record that are not deleted", so the filter belongs in
-- the index rather than being applied after it.
CREATE INDEX IF NOT EXISTS idx_notes_journey   ON notes(journey_id)       WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notes_contact   ON notes(contact_id)       WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notes_territory ON notes("TerritorySlug")  WHERE deleted_at IS NULL;

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS read_notes ON notes;
CREATE POLICY read_notes ON notes FOR SELECT TO authenticated USING (true);
