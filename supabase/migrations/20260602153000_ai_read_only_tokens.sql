-- Read-only AI access tokens for external agents such as Hermes.

CREATE TABLE IF NOT EXISTS ai_api_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  name text NOT NULL DEFAULT 'Read-only AI token',
  token_hash text NOT NULL UNIQUE,
  token_prefix text NOT NULL,
  scope text NOT NULL DEFAULT 'AI_READ_ONLY' CHECK (scope = 'AI_READ_ONLY'),
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_api_tokens_user_id ON ai_api_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_api_tokens_active ON ai_api_tokens(user_id, revoked_at);

DROP TRIGGER IF EXISTS ai_api_tokens_updated_at ON ai_api_tokens;
CREATE TRIGGER ai_api_tokens_updated_at
  BEFORE UPDATE ON ai_api_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS ai_api_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid REFERENCES ai_api_tokens(id) ON DELETE SET NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  token_prefix text,
  endpoint text NOT NULL,
  resource text NOT NULL,
  method text NOT NULL DEFAULT 'GET',
  status_code integer NOT NULL DEFAULT 200,
  request_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_api_activity_created_at ON ai_api_activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_api_activity_user_id ON ai_api_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_api_activity_resource ON ai_api_activity(resource);

ALTER TABLE ai_api_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_api_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_tokens_admin_read" ON ai_api_tokens;
CREATE POLICY "ai_tokens_admin_read" ON ai_api_tokens FOR SELECT USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id::text = auth.uid()::text AND u.role = 'admin')
);

DROP POLICY IF EXISTS "ai_activity_admin_read" ON ai_api_activity;
CREATE POLICY "ai_activity_admin_read" ON ai_api_activity FOR SELECT USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id::text = auth.uid()::text AND u.role = 'admin')
);
