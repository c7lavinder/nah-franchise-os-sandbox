-- Tier 1 #2: User email aliases for call participant matching.
-- Team members may use multiple emails (personal, company, alt domains).
-- The resolver checks this table alongside users.email to identify NAH team on calls.

CREATE TABLE IF NOT EXISTS user_email_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_user_email_aliases_email ON user_email_aliases (lower(email));
CREATE INDEX IF NOT EXISTS idx_user_email_aliases_user ON user_email_aliases (user_id);
