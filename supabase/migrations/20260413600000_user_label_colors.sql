-- Add label_color to users — persistent color for user pills across the site
ALTER TABLE users ADD COLUMN IF NOT EXISTS label_color text;

-- Pre-assign colors to existing team members
UPDATE users SET label_color = '#E86826' WHERE email = 'chad@newagainhouses.com';       -- orange
UPDATE users SET label_color = '#2563EB' WHERE email = 'matt@newagainhouses.com';       -- blue
UPDATE users SET label_color = '#7C3AED' WHERE email = 'corey@newagainhouses.com';      -- purple
UPDATE users SET label_color = '#059669' WHERE email ILIKE 'sam%@newagainhouses.com';    -- green
UPDATE users SET label_color = '#DC2626' WHERE email ILIKE 'mark%@newagainhouses.com';   -- red
UPDATE users SET label_color = '#D97706' WHERE email = 'rylyn@newagainhouses.com';       -- amber
UPDATE users SET label_color = '#0891B2' WHERE email ILIKE 'john%@newagainhouses.com';   -- cyan
UPDATE users SET label_color = '#DB2777' WHERE email ILIKE 'nora%@newagainhouses.com';   -- pink
UPDATE users SET label_color = '#4F46E5' WHERE email = 'admin@newagainhouses.com';       -- indigo
