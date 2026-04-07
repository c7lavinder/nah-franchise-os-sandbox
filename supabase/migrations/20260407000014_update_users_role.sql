-- Sprint 1: Update users.role to support new permission model (§1.15)
-- Old roles: 'rep', 'marketing', 'leadership'
-- New roles: 'admin', 'operator', 'specialist', 'member'
--
-- Migration strategy: drop old CHECK, map existing values, add new CHECK
-- Per §1.15:
--   leadership → admin
--   rep → member
--   marketing → member (no marketing role in new model)

-- Drop the old CHECK constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Map old roles to new roles
UPDATE users SET role = 'admin' WHERE role = 'leadership';
UPDATE users SET role = 'member' WHERE role IN ('rep', 'marketing');

-- Add new CHECK constraint
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'operator', 'specialist', 'member'));
