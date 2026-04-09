-- Add is_real_user flag to users table.
-- Default false. Set true only for verified, active team members.

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_real_user boolean NOT NULL DEFAULT false;

-- Set real users: Corey, Chad, Matt
UPDATE users SET is_real_user = true
  WHERE email IN (
    'corey@newagainhouses.com',
    'chad+placeholder@newagainhouses.com',
    'matt+placeholder@newagainhouses.com'
  );
