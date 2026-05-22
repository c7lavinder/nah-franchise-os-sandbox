-- Phase 9: Commitment tracking table
-- Stores promises/commitments extracted from call transcripts

CREATE TABLE commitments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
  made_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  commitment_text text NOT NULL,
  committed_by text,
  due_date date,
  commitment_type text CHECK (commitment_type IN ('document', 'follow_up', 'decision', 'consultation', 'information', 'action', 'other')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'fulfilled', 'overdue', 'cancelled')),
  source_extraction_id uuid,
  fulfilled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_commitments_contact ON commitments(contact_id);
CREATE INDEX idx_commitments_call ON commitments(call_id);
CREATE INDEX idx_commitments_status_pending ON commitments(status, due_date) WHERE status IN ('pending', 'overdue');
CREATE INDEX idx_commitments_due_date ON commitments(due_date) WHERE status = 'pending';

COMMENT ON TABLE commitments IS 'Tracks promises and commitments made during sales calls — extracted by post-call agent';
