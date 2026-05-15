-- Add label_color for team members who were missing colors
-- Ben, Jeff, Ray, Jess, Amber, Erin, and Mark's alt email

UPDATE users SET label_color = '#10B981' WHERE email ILIKE 'ben%@newagainhouses.com' AND label_color IS NULL;   -- emerald
UPDATE users SET label_color = '#6366F1' WHERE email ILIKE 'jeff%@newagainhouses.com' AND label_color IS NULL;  -- indigo
UPDATE users SET label_color = '#F59E0B' WHERE email ILIKE 'ray%@newagainhouses.com' AND label_color IS NULL;   -- amber
UPDATE users SET label_color = '#F59E0B' WHERE email ILIKE 'ray%@hirambuild.com' AND label_color IS NULL;       -- amber (alt email)
UPDATE users SET label_color = '#EC4899' WHERE email ILIKE 'jess%@newagainhouses.com' AND label_color IS NULL;  -- pink
UPDATE users SET label_color = '#8B5CF6' WHERE email ILIKE 'amber%@newagainhouses.com' AND label_color IS NULL; -- violet
UPDATE users SET label_color = '#14B8A6' WHERE email ILIKE 'erin%@newagainhouses.com' AND label_color IS NULL;  -- teal
UPDATE users SET label_color = '#EF4444' WHERE email ILIKE 'joekraus%@newagainhouses.com' AND label_color IS NULL; -- red

-- Mark uses altacapitalmanagement.com — original migration only matched @newagainhouses.com
UPDATE users SET label_color = '#DC2626' WHERE email ILIKE 'mark%@altacapitalmanagement.com' AND label_color IS NULL; -- red
UPDATE users SET label_color = '#DC2626' WHERE email = 'markjpate@gmail.com' AND label_color IS NULL;                 -- red
