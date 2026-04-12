-- Sprint: Calls Detail Tab Rebuild
-- New tables: call_action_items, call_action_feedback, call_data_extractions
-- New columns on calls: ai_summary, ai_summary_generated_at, coaching_score, coaching_data, coaching_generated_at

-- ═══════════════════════════════════════════════
-- 1. CALL ACTION ITEMS
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS call_action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  category text NOT NULL CHECK (category IN ('pipeline', 'apt', 'task', 'comms', 'workflow', 'data')),
  title text NOT NULL,
  description text,
  source text NOT NULL DEFAULT 'scout' CHECK (source IN ('scout', 'manual')),
  ghl_action bool NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'pushed', 'edited_pushed', 'skipped')),
  original_title text,
  original_description text,
  pushed_at timestamptz,
  skipped_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_action_items_call ON call_action_items(call_id);
CREATE INDEX IF NOT EXISTS idx_call_action_items_status ON call_action_items(status) WHERE status = 'pending';

-- ═══════════════════════════════════════════════
-- 2. CALL ACTION FEEDBACK (learning loop)
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS call_action_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_action_item_id uuid NOT NULL REFERENCES call_action_items(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('push', 'edit', 'skip')),
  edit_diff text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_action_feedback_item ON call_action_feedback(call_action_item_id);

-- ═══════════════════════════════════════════════
-- 3. CALL DATA EXTRACTIONS
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS call_data_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  field_key text NOT NULL,
  field_category text NOT NULL CHECK (field_category IN ('contact', 'territory', 'market', 'business_financials', 'business_health')),
  extracted_value text,
  confidence text CHECK (confidence IN ('high', 'medium', 'low')),
  saved_to_profile bool NOT NULL DEFAULT false,
  dismissed bool NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'scout' CHECK (source IN ('scout', 'manual')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_data_extractions_call ON call_data_extractions(call_id);
CREATE INDEX IF NOT EXISTS idx_call_data_extractions_contact ON call_data_extractions(contact_id) WHERE saved_to_profile = false;

-- ═══════════════════════════════════════════════
-- 4. ADD GENERATION COLUMNS TO CALLS TABLE
-- ═══════════════════════════════════════════════
ALTER TABLE calls ADD COLUMN IF NOT EXISTS ai_summary text;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS ai_summary_generated_at timestamptz;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS coaching_score int;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS coaching_data jsonb;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS coaching_generated_at timestamptz;
