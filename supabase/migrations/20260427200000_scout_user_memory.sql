-- ═══════════════════════════════════════════════════════════════════
-- Scout user memory — one rolling memory blob per user.
--
-- Each chat session resets the UI, but Scout stays continuous in
-- understanding by reading from this table at the start of every turn
-- and merging new durable facts into it at the end of every turn.
--
-- Memory extraction is done by Haiku in the chat route; this table
-- just stores the merged blob keyed on user_id.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS scout_user_memory (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  -- Merged free-text memory. Bullet-style entries — facts, ongoing work,
  -- preferences, recent decisions, contacts under active focus. Capped
  -- by application logic (~4KB) to keep system-prompt tokens bounded.
  content text NOT NULL DEFAULT '',
  -- Number of turns folded into this memory — useful for diagnostics
  -- and for deciding when to compact.
  turn_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER scout_user_memory_updated_at
  BEFORE UPDATE ON scout_user_memory
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime(updated_at);

COMMENT ON TABLE scout_user_memory IS
  'Per-user persistent memory for Scout. Survives across chat sessions; UI still mounts fresh each time.';

COMMENT ON COLUMN scout_user_memory.content IS
  'Free-text bullet list of durable facts. Merged in by the chat route after each turn. ~4KB cap enforced in app.';
