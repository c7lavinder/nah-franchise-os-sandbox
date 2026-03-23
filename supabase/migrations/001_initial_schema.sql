-- ============================================================
-- NAH Franchise OS — Initial Database Schema
-- ============================================================
-- Run this in the Supabase SQL Editor to create all tables.
-- This matches the schema defined in docs/architecture.md.
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. USERS
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('rep', 'marketing', 'leadership')),
  ghl_user_id VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_ghl_user_id ON users(ghl_user_id);

-- ============================================================
-- 2. USER MEMORY — Scout's learned context per user
-- ============================================================
CREATE TABLE user_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  memory_type VARCHAR(50) NOT NULL,
  memory_key VARCHAR(255) NOT NULL,
  memory_value TEXT NOT NULL,
  confidence DECIMAL(3,2) DEFAULT 0.50,
  source VARCHAR(100) NOT NULL,
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, memory_type, memory_key)
);

CREATE INDEX idx_user_memory_user_id ON user_memory(user_id);
CREATE INDEX idx_user_memory_type ON user_memory(user_id, memory_type);

-- ============================================================
-- 3. SESSIONS — conversation tracking
-- ============================================================
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_history JSONB DEFAULT '[]'::jsonb,
  context_summary TEXT,
  ghl_contact_focus VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  started_at TIMESTAMPTZ DEFAULT now(),
  last_activity_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_active ON sessions(user_id, is_active);

-- ============================================================
-- 4. SCOUT ACTION LOGS — immutable audit trail
-- ============================================================
CREATE TABLE scout_action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL,
  action_status VARCHAR(50) NOT NULL,
  ghl_contact_id VARCHAR(255),
  draft_content JSONB NOT NULL,
  final_content JSONB,
  ghl_response JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ
);

CREATE INDEX idx_scout_logs_user_id ON scout_action_logs(user_id);
CREATE INDEX idx_scout_logs_session_id ON scout_action_logs(session_id);
CREATE INDEX idx_scout_logs_contact ON scout_action_logs(ghl_contact_id);
CREATE INDEX idx_scout_logs_status ON scout_action_logs(action_status);
CREATE INDEX idx_scout_logs_created ON scout_action_logs(created_at);

-- ============================================================
-- 5. KNOWLEDGE DOCUMENTS — franchise knowledge base
-- ============================================================
CREATE TABLE knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  token_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES users(id)
);

CREATE INDEX idx_knowledge_category ON knowledge_documents(category);
CREATE INDEX idx_knowledge_active ON knowledge_documents(is_active, priority DESC);

-- ============================================================
-- 6. APP SETTINGS — key-value configuration
-- ============================================================
CREATE TABLE app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key VARCHAR(255) UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  description TEXT,
  is_encrypted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 7. INACTIVITY ALERTS — accountability engine alerts
-- ============================================================
CREATE TABLE inactivity_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type VARCHAR(100) NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  user_id UUID REFERENCES users(id),
  ghl_contact_id VARCHAR(255),
  pipeline_stage VARCHAR(100),
  message TEXT NOT NULL,
  details JSONB,
  is_resolved BOOLEAN DEFAULT false,
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_alerts_type ON inactivity_alerts(alert_type);
CREATE INDEX idx_alerts_user ON inactivity_alerts(user_id);
CREATE INDEX idx_alerts_unresolved ON inactivity_alerts(is_resolved, severity);
CREATE INDEX idx_alerts_created ON inactivity_alerts(created_at);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scout_action_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE inactivity_alerts ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS, so these policies apply to anon/authenticated roles.
-- For MVP, the backend uses the service role key, so RLS is a safety net.

-- Users can read their own record
CREATE POLICY "users_read_own" ON users FOR SELECT USING (auth.uid()::text = id::text);
-- Leadership can read all users
CREATE POLICY "users_read_all_leadership" ON users FOR SELECT USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id::text = auth.uid()::text AND u.role = 'leadership')
);

-- Users can read/write their own memory
CREATE POLICY "memory_own" ON user_memory FOR ALL USING (user_id::text = auth.uid()::text);

-- Users can read/write their own sessions
CREATE POLICY "sessions_own" ON sessions FOR ALL USING (user_id::text = auth.uid()::text);

-- Users can read their own action logs
CREATE POLICY "logs_read_own" ON scout_action_logs FOR SELECT USING (user_id::text = auth.uid()::text);
-- Leadership can read all logs
CREATE POLICY "logs_read_all_leadership" ON scout_action_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id::text = auth.uid()::text AND u.role = 'leadership')
);
-- Insert allowed for all authenticated users (server creates logs)
CREATE POLICY "logs_insert" ON scout_action_logs FOR INSERT WITH CHECK (true);

-- Knowledge documents are readable by all authenticated users
CREATE POLICY "knowledge_read_all" ON knowledge_documents FOR SELECT USING (true);
-- Only leadership can modify knowledge documents
CREATE POLICY "knowledge_modify_leadership" ON knowledge_documents FOR ALL USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id::text = auth.uid()::text AND u.role = 'leadership')
);

-- App settings readable by all, modifiable by leadership
CREATE POLICY "settings_read_all" ON app_settings FOR SELECT USING (true);
CREATE POLICY "settings_modify_leadership" ON app_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id::text = auth.uid()::text AND u.role = 'leadership')
);

-- Alerts readable by the rep they're about + leadership
CREATE POLICY "alerts_read_own" ON inactivity_alerts FOR SELECT USING (
  user_id::text = auth.uid()::text OR
  EXISTS (SELECT 1 FROM users u WHERE u.id::text = auth.uid()::text AND u.role = 'leadership')
);
CREATE POLICY "alerts_insert" ON inactivity_alerts FOR INSERT WITH CHECK (true);
CREATE POLICY "alerts_update" ON inactivity_alerts FOR UPDATE USING (true);

-- ============================================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER user_memory_updated_at BEFORE UPDATE ON user_memory FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER knowledge_docs_updated_at BEFORE UPDATE ON knowledge_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER app_settings_updated_at BEFORE UPDATE ON app_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
