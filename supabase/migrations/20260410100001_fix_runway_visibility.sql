-- Fix: Runway pipeline was not visible in nav
UPDATE pipelines SET is_visible_in_nav = true WHERE slug = 'runway';
